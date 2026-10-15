"""
In-memory store for MERIDIAN historical runs, drift reports, and live pipeline status.
Pre-seeds realistic initial data from test fixtures so the dashboard looks alive immediately.
"""
from __future__ import annotations
import datetime
import json
import time
import uuid
from pathlib import Path
from typing import Dict, List, Optional

from src.config import Config
from src.drift_detector import DriftDetector
from src.drift_model import RiskLevel
from api.schemas import PipelineRunRecord


class ReportStore:
    def __init__(self):
        self._runs: Dict[str, PipelineRunRecord] = {}
        self._start_time = time.time()
        self._seed_initial_data()

    def _seed_initial_data(self):
        """Pre-populate sample historical runs using test fixtures."""
        fixtures = [
            ("multiple_changes_plan.json", "Production Multi-Service Drift", "mock", False),
            ("update_plan.json", "Staging S3 Bucket Drift", "mock", True),
            ("replace_plan.json", "Database RDS Security Group Replacement", "mock", True),
            ("delete_plan.json", "Unauthorized IAM Role Deletion", "mock", True),
        ]

        now = datetime.datetime.now(datetime.timezone.utc)
        for i, (fname, label, provider, dry_run) in enumerate(fixtures):
            fixture_path = Config.BASE_DIR / "tests" / "fixtures" / fname
            if not fixture_path.exists():
                continue

            try:
                report = DriftDetector.detect_drift(fixture_path)
                run_id = f"run-{uuid.uuid4().hex[:8]}"
                created_time = (now - datetime.timedelta(hours=(i * 3 + 1), minutes=12 * i)).isoformat()
                completed_time = (now - datetime.timedelta(hours=(i * 3 + 1), minutes=12 * i - 2)).isoformat()

                # Generate mock proposal
                summary = f"Detected {report.total_resources_drifted} out-of-band drift changes in {fname}."
                root_cause = "Out-of-band console modifications or ad-hoc CLI script executed in cloud environment."
                recommended_action = "Review Terraform HCL updates to bring IaC state into parity with live cloud resources."

                from src.drift_model import LLMRemediationProposal, LLMProposalStatus, ValidationResult

                proposal = LLMRemediationProposal(
                    status=LLMProposalStatus.PROPOSED,
                    summary=summary,
                    root_cause_hypothesis=root_cause,
                    risk=report.overall_risk,
                    recommended_action=recommended_action,
                    files_to_modify=["terraform/main.tf"],
                    patch="""--- a/terraform/main.tf
+++ b/terraform/main.tf
@@ -10,3 +10,4 @@ resource "aws_s3_bucket" "demo" {
-  tags = { Environment = "Dev" }
+  tags = { Environment = "Production", ManagedBy = "Meridian" }
 }""",
                    confidence=0.96,
                    requires_human_review=True,
                )

                validation = ValidationResult(
                    format_pass=True,
                    validate_pass=True,
                    plan_pass=True,
                    unexpected_destroy=(report.overall_risk == RiskLevel.CRITICAL),
                    details="Deterministic validation executed with isolated sandbox terraform fmt & validate checks.",
                    errors=["Unexpected resource destruction detected without explicit human approval"] if report.overall_risk == RiskLevel.CRITICAL else []
                )

                pr_result = {
                    "action": "CREATED" if not validation.unexpected_destroy else "ABORTED_UNSAFE",
                    "pr_url": f"https://github.com/DevRushi-engg/meridian/pull/{101 + i}",
                    "branch": f"meridian/drift-{report.fingerprint[:8]}",
                    "fingerprint": report.fingerprint,
                    "body": f"## IaC Sentinal Drift Remediation\n\nAutomated remediation candidate for `{fname}`.\n\n### Risk: {report.overall_risk.value}"
                }

                record = PipelineRunRecord(
                    id=run_id,
                    status="SUCCESS" if validation.is_valid else "FAILED",
                    created_at=created_time,
                    completed_at=completed_time,
                    plan_name=fname,
                    llm_provider=provider,
                    dry_run=dry_run,
                    drift_report=report,
                    proposal=proposal,
                    validation=validation,
                    pr_result=pr_result,
                    logs=[
                        f"Ingested {fname}",
                        f"Detected {report.total_resources_drifted} drifted resources",
                        f"Calculated overall risk: {report.overall_risk.value}",
                        "Synthesized candidate remediation patch with isolated sandbox",
                        f"Validation status: {'PASSED' if validation.is_valid else 'BLOCKED_BY_GUARDRAIL'}",
                        f"PR generated: {pr_result['pr_url']}"
                    ]
                )
                self._runs[run_id] = record
            except Exception as e:
                pass

    def add_run(self, record: PipelineRunRecord):
        self._runs[record.id] = record

    def update_run(self, record: PipelineRunRecord):
        self._runs[record.id] = record

    def get_run(self, run_id: str) -> Optional[PipelineRunRecord]:
        return self._runs.get(run_id)

    def list_runs(self) -> List[PipelineRunRecord]:
        return sorted(self._runs.values(), key=lambda r: r.created_at, reverse=True)

    def delete_run(self, run_id: str) -> bool:
        if run_id in self._runs:
            del self._runs[run_id]
            return True
        return False

    def get_stats(self) -> Dict[str, Any]:
        runs = list(self._runs.values())
        total_runs = len(runs)
        drift_count = sum(r.drift_report.total_resources_drifted for r in runs if r.drift_report)
        critical_count = sum(1 for r in runs if r.drift_report and r.drift_report.overall_risk == RiskLevel.CRITICAL)
        pr_count = sum(1 for r in runs if r.pr_result and r.pr_result.get("action") == "CREATED")
        uptime = time.time() - self._start_time

        return {
            "total_runs": total_runs,
            "total_drift_detected": drift_count,
            "critical_risks": critical_count,
            "prs_generated": pr_count,
            "uptime_seconds": round(uptime, 1),
        }


# Singleton instance
store = ReportStore()
