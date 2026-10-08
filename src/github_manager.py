"""
GitHub REST API and Git Automation Manager for MERIDIAN.
Handles branch creation, commit staging, PR generation, and duplicate PR prevention.
"""
from __future__ import annotations
import os
import requests
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from src.config import Config
from src.drift_model import DriftReport, LLMRemediationProposal, ValidationResult
from src.exceptions import GitHubAutomationError
from src.audit_logger import audit_logger


class GitHubManager:
    """Manages GitHub PR operations and prevents duplicate PR creation for identical drift."""

    def __init__(
        self,
        token: Optional[str] = None,
        repository: Optional[str] = None,
        base_branch: Optional[str] = None,
    ):
        self.token = token or Config.GITHUB_TOKEN
        self.repository = repository or Config.GITHUB_REPOSITORY
        self.base_branch = base_branch or Config.GITHUB_BASE_BRANCH
        self.api_url = "https://api.github.com"
        self.headers = {
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "MERIDIAN-Drift-Remediation",
        }
        if self.token:
            self.headers["Authorization"] = f"Bearer {self.token}"

    def build_pr_body(
        self,
        report: DriftReport,
        proposal: LLMRemediationProposal,
        validation: ValidationResult,
    ) -> str:
        """
        Formats the Pull Request body conforming to the MERIDIAN specification.
        """
        lines = [
            "## Drift detected",
            "",
        ]

        for r in report.resources:
            lines.append(f"**Resource:** `{r.address}`")
            lines.append("")
            lines.append("### Difference")
            lines.append("")
            lines.append("| Attribute | Desired (Terraform) | Actual (Live AWS) |")
            lines.append("|---|---|---|")
            for diff in r.differences:
                lines.append(f"| `{diff.attribute}` | `{diff.desired}` | `{diff.actual}` |")
            lines.append("")

        lines.extend([
            "### Explanation",
            proposal.summary,
            "",
            f"**Root Cause Hypothesis:** {proposal.root_cause_hypothesis}",
            "",
            "### Proposed remediation",
            proposal.recommended_action,
            "",
            "```diff",
            proposal.patch or "# See modified files in PR",
            "```",
            "",
            "### Validation",
            f"- **terraform fmt:** {'PASS' if validation.format_pass else 'FAIL'}",
            f"- **terraform validate:** {'PASS' if validation.validate_pass else 'FAIL'}",
            f"- **terraform plan:** {'PASS' if validation.plan_pass else 'FAIL'}",
            f"- **unexpected destroy:** {'YES (BLOCKED)' if validation.unexpected_destroy else 'NO'}",
            "",
            "### Risk",
            f"`{report.overall_risk.value}`",
            "",
            "### AI assistance",
            f"This remediation was generated with LLM assistance (Confidence: {proposal.confidence:.0%}) and deterministically validated by Terraform.",
            "",
            "### Approval",
            "Human review is **mandatory** before merge.",
            "",
            "---",
            f"*MERIDIAN Fingerprint:* `[{report.fingerprint}]`",
            f"*Generated at:* `{datetime.now(timezone.utc).isoformat()}`",
        ])

        return "\n".join(lines)

    def check_for_existing_pr(self, fingerprint: str) -> Optional[Dict[str, Any]]:
        """
        Checks if an open MERIDIAN PR already exists for the same drift fingerprint.
        Prevents duplicate PR spamming from recurring scheduled runs.
        """
        if not self.token or not self.repository:
            # Mock mode / Local run
            return None

        url = f"{self.api_url}/repos/{self.repository}/pulls"
        params = {"state": "open", "per_page": 50}

        try:
            resp = requests.get(url, headers=self.headers, params=params, timeout=15)
            if resp.status_code != 200:
                audit_logger.log_event("GITHUB_API_ERROR", {"status": resp.status_code, "text": resp.text}, level="WARNING")
                return None

            prs = resp.json()
            for pr in prs:
                body = pr.get("body", "")
                if f"[{fingerprint}]" in body:
                    return {
                        "number": pr["number"],
                        "html_url": pr["html_url"],
                        "title": pr["title"],
                        "head_ref": pr["head"]["ref"],
                    }
            return None
        except Exception as e:
            audit_logger.log_event("GITHUB_API_EXCEPTION", {"error": str(e)}, level="WARNING")
            return None

    def create_or_update_pr(
        self,
        report: DriftReport,
        proposal: LLMRemediationProposal,
        validation: ValidationResult,
        dry_run: bool = False,
    ) -> Dict[str, Any]:
        """
        Creates or updates a GitHub PR. In dry-run mode, generates complete payload without sending network requests.
        """
        pr_title = f"MERIDIAN: Reconcile detected infrastructure drift [{report.fingerprint}]"
        pr_body = self.build_pr_body(report, proposal, validation)
        branch_name = f"{Config.PR_BRANCH_PREFIX}/{report.fingerprint}"

        # 1. Check for duplicate open PR
        existing_pr = self.check_for_existing_pr(report.fingerprint)
        if existing_pr:
            audit_logger.log_event("DUPLICATE_PR_SUPPRESSED", {
                "fingerprint": report.fingerprint,
                "existing_pr_number": existing_pr["number"],
                "existing_pr_url": existing_pr["html_url"],
            })
            return {
                "action": "SUPPRESSED_DUPLICATE",
                "pr_url": existing_pr["html_url"],
                "pr_number": existing_pr["number"],
                "branch": existing_pr["head_ref"],
                "body": pr_body,
            }

        if dry_run or not self.token or not self.repository:
            audit_logger.log_event("PR_DRY_RUN_GENERATED", {
                "title": pr_title,
                "branch": branch_name,
                "fingerprint": report.fingerprint,
            })
            return {
                "action": "SIMULATED_PR",
                "pr_url": f"https://github.com/{self.repository or 'owner/meridian'}/pull/simulated-pr",
                "pr_number": 999,
                "branch": branch_name,
                "title": pr_title,
                "body": pr_body,
            }

        # 2. Live GitHub API PR Creation
        url = f"{self.api_url}/repos/{self.repository}/pulls"
        payload = {
            "title": pr_title,
            "head": branch_name,
            "base": self.base_branch,
            "body": pr_body,
            "draft": False,
        }

        try:
            resp = requests.post(url, headers=self.headers, json=payload, timeout=20)
            if resp.status_code in (200, 201):
                data = resp.json()
                audit_logger.log_event("PR_CREATED_SUCCESSFULLY", {
                    "pr_number": data["number"],
                    "pr_url": data["html_url"],
                    "branch": branch_name,
                })
                return {
                    "action": "CREATED_PR",
                    "pr_url": data["html_url"],
                    "pr_number": data["number"],
                    "branch": branch_name,
                    "body": pr_body,
                }
            else:
                raise GitHubAutomationError(f"GitHub PR creation failed ({resp.status_code}): {resp.text}")
        except Exception as e:
            audit_logger.log_event("PR_CREATION_FAILED", {"error": str(e)}, level="ERROR")
            raise GitHubAutomationError(f"Failed to communicate with GitHub API: {e}")
