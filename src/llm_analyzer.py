"""
LLM Analyzer module for MERIDIAN.
Generates human-readable drift explanations, root-cause hypotheses, and candidate patches.
Supports Google Gemini, OpenAI, and a deterministic Mock engine for testing.
"""
from __future__ import annotations
import json
import re
from pathlib import Path
from typing import Any, Dict, Optional
from src.config import Config
from src.drift_model import (
    DriftReport,
    LLMProposalStatus,
    LLMRemediationProposal,
    RiskLevel,
)
from src.exceptions import LLMAnalysisError
from src.audit_logger import audit_logger


class LLMAnalyzer:
    """Invokes LLM to explain drift and propose candidate Terraform remediation patches."""

    def __init__(
        self,
        provider: Optional[str] = None,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        prompt_template_path: Optional[Path] = None,
    ):
        self.provider = (provider or Config.LLM_PROVIDER).lower()
        self.api_key = api_key or (Config.GEMINI_API_KEY if self.provider == "gemini" else Config.OPENAI_API_KEY)
        self.model = model or Config.LLM_MODEL
        self.prompt_template_path = prompt_template_path or (Config.PROMPTS_DIR / "drift_remediation.txt")
        self._prompt_template = self._load_prompt_template()

    def _load_prompt_template(self) -> str:
        """Load prompt template from file or fallback to embedded prompt."""
        if self.prompt_template_path.exists():
            return self.prompt_template_path.read_text(encoding="utf-8")
        return (
            "You are MERIDIAN IaC Assistant. Given the drift report and relevant Terraform config, "
            "explain the drift and propose a minimal remediation patch conforming to the JSON schema."
        )

    def analyze_drift(self, report: DriftReport, relevant_terraform_code: str = "") -> LLMRemediationProposal:
        """
        Analyze a DriftReport and produce a validated LLMRemediationProposal.
        """
        if not report.has_drift or not report.resources:
            return LLMRemediationProposal(
                status=LLMProposalStatus.INSUFFICIENT_CONTEXT,
                summary="No infrastructure drift detected in the provided report.",
                root_cause_hypothesis="Cloud infrastructure is aligned with Terraform desired state.",
                risk=RiskLevel.LOW,
                recommended_action="No remediation needed.",
                files_to_modify=[],
                patch="",
                confidence=1.0,
                requires_human_review=False,
            )

        # Build prompt payload
        user_message = self._build_prompt_payload(report, relevant_terraform_code)

        raw_response = ""
        try:
            if self.provider == "mock" or not self.api_key:
                raw_response = self._generate_mock_response(report, relevant_terraform_code)
            elif self.provider == "gemini":
                raw_response = self._call_gemini(user_message)
            elif self.provider == "openai":
                raw_response = self._call_openai(user_message)
            else:
                raise LLMAnalysisError(f"Unsupported LLM provider: {self.provider}")

            # Parse and validate against Pydantic schema
            proposal = self._parse_and_validate_response(raw_response)

            audit_logger.log_event("LLM_ANALYSIS_COMPLETED", {
                "status": proposal.status.value,
                "risk": proposal.risk.value,
                "confidence": proposal.confidence,
                "summary": proposal.summary,
            })

            return proposal

        except Exception as e:
            audit_logger.log_event("LLM_ANALYSIS_FAILED", {
                "error": str(e),
                "provider": self.provider,
            }, level="ERROR")
            # Fallback safe response so pipeline doesn't crash silently
            return LLMRemediationProposal(
                status=LLMProposalStatus.NEEDS_HUMAN_REVIEW,
                summary=f"Automated AI analysis encountered an issue: {str(e)}",
                root_cause_hypothesis="Drift detected but automated reasoning requires manual human triage.",
                risk=report.overall_risk,
                recommended_action="Manually inspect the Terraform plan and apply necessary corrections.",
                files_to_modify=["terraform/main.tf"],
                patch="",
                confidence=0.0,
                requires_human_review=True,
            )

    def _build_prompt_payload(self, report: DriftReport, relevant_terraform_code: str) -> str:
        """Construct user message combining drift details and existing HCL."""
        drift_summary = []
        for r in report.resources:
            drift_summary.append({
                "resource": r.address,
                "type": r.resource_type,
                "actions": r.actions,
                "risk": r.risk.value,
                "differences": [{"attribute": d.attribute, "desired": d.desired, "actual": d.actual} for d in r.differences]
            })

        return (
            f"{self._prompt_template}\n\n"
            f"=== DETECTED DRIFT REPORT ===\n"
            f"{json.dumps(drift_summary, indent=2)}\n\n"
            f"=== CURRENT TERRAFORM CODE ===\n"
            f"{relevant_terraform_code or '# No local terraform code provided'}\n\n"
            f"Generate strictly the JSON response conforming to the schema:"
        )

    def _call_gemini(self, prompt: str) -> str:
        """Call Google Gemini API."""
        try:
            from google import genai
            client = genai.Client(api_key=self.api_key)
            response = client.models.generate_content(
                model=self.model,
                contents=prompt,
            )
            return response.text or ""
        except Exception as e:
            raise LLMAnalysisError(f"Gemini API request failed: {e}")

    def _call_openai(self, prompt: str) -> str:
        """Call OpenAI API."""
        try:
            from openai import OpenAI
            client = OpenAI(api_key=self.api_key)
            response = client.chat.completions.create(
                model=self.model if "gpt" in self.model else "gpt-4o-mini",
                messages=[
                    {"role": "system", "content": self._prompt_template},
                    {"role": "user", "content": prompt}
                ],
                temperature=Config.LLM_TEMPERATURE,
            )
            return response.choices[0].message.content or ""
        except Exception as e:
            raise LLMAnalysisError(f"OpenAI API request failed: {e}")

    def _generate_mock_response(self, report: DriftReport, relevant_terraform_code: str) -> str:
        """Deterministic mock response generator for offline and CI testing."""
        resource = report.resources[0] if report.resources else None
        if not resource:
            return json.dumps({
                "status": "INSUFFICIENT_CONTEXT",
                "summary": "No resource drift found.",
                "root_cause_hypothesis": "Infrastructure in sync.",
                "risk": "LOW",
                "recommended_action": "None",
                "files_to_modify": [],
                "patch": "",
                "confidence": 1.0,
                "requires_human_review": False
            })

        if resource.risk == RiskLevel.CRITICAL or "delete" in resource.actions:
            return json.dumps({
                "status": "NEEDS_HUMAN_REVIEW",
                "summary": f"Destructive change detected on {resource.address}.",
                "root_cause_hypothesis": "The resource was deleted or marked for destructive replacement in the live environment.",
                "risk": "CRITICAL",
                "recommended_action": "Manual review is strictly required before restoring or deleting infrastructure.",
                "files_to_modify": ["terraform/main.tf"],
                "patch": "# CRITICAL: Destructive action detected. Requires manual review.",
                "confidence": 0.99,
                "requires_human_review": True
            })

        # Tag or Attribute update mock
        diff_desc = ", ".join(f"{d.attribute}: {d.actual} -> {d.desired}" for d in resource.differences)
        diff_patch = (
            f"--- a/terraform/main.tf\n"
            f"+++ b/terraform/main.tf\n"
            f"@@ -5,3 +5,3 @@\n"
            f"-    Environment = \"production\"\n"
            f"+    Environment = \"development\"\n"
        )
        return json.dumps({
            "status": "PROPOSED",
            "summary": f"Configuration drift detected on {resource.address} ({diff_desc or 'attribute mismatch'}).",
            "root_cause_hypothesis": "Live cloud configuration was modified manually outside of Terraform.",
            "risk": resource.risk.value,
            "recommended_action": f"Restore Terraform desired state for {resource.address}.",
            "files_to_modify": ["terraform/main.tf"],
            "patch": diff_patch,
            "confidence": 0.95,
            "requires_human_review": True
        })

    def _parse_and_validate_response(self, raw_text: str) -> LLMRemediationProposal:
        """Extract and validate JSON matching the LLMRemediationProposal schema."""
        cleaned = raw_text.strip()
        # Strip markdown code fencing if returned by model
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```[a-zA-Z]*\n", "", cleaned)
            cleaned = re.sub(r"\n```$", "", cleaned)
            cleaned = cleaned.strip()

        # Find JSON object boundaries if preamble exists
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start != -1 and end != -1:
            cleaned = cleaned[start:end+1]

        try:
            data = json.loads(cleaned)
            return LLMRemediationProposal.model_validate(data)
        except Exception as e:
            raise LLMAnalysisError(f"Failed to validate LLM response schema: {e}\nRaw: {raw_text[:200]}")
