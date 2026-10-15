"""
Granular drift operations router for MERIDIAN (Stages 1-6 standalone).
"""
from __future__ import annotations
from typing import Any, Dict, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from src.config import Config
from src.drift_detector import DriftDetector
from src.llm_analyzer import LLMAnalyzer
from src.patch_generator import PatchGenerator
from src.validator import TerraformValidator
from src.github_manager import GitHubManager
from src.drift_model import DriftReport, LLMRemediationProposal, ValidationResult

router = APIRouter(prefix="/api/drift", tags=["drift"])


class DetectRequest(BaseModel):
    plan_json: Dict[str, Any]


class AnalyzeRequest(BaseModel):
    drift_report: DriftReport
    provider: Optional[str] = "mock"
    terraform_code: Optional[str] = None


class ValidateRequest(BaseModel):
    proposal: LLMRemediationProposal


class CreatePRRequest(BaseModel):
    drift_report: DriftReport
    proposal: LLMRemediationProposal
    validation: ValidationResult
    dry_run: bool = True


@router.post("/detect", response_model=DriftReport)
async def detect_drift_endpoint(payload: DetectRequest):
    try:
        report = DriftDetector.detect_drift(payload.plan_json)
        return report
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse or detect drift: {str(e)}")


@router.post("/analyze", response_model=LLMRemediationProposal)
async def analyze_drift_endpoint(payload: AnalyzeRequest):
    try:
        analyzer = LLMAnalyzer(provider=payload.provider or Config.LLM_PROVIDER)
        hcl_code = payload.terraform_code
        if not hcl_code:
            main_tf = Config.TERRAFORM_DIR / "main.tf"
            if main_tf.exists():
                hcl_code = main_tf.read_text(encoding="utf-8")

        proposal = analyzer.analyze_drift(payload.drift_report, relevant_terraform_code=hcl_code or "")
        return proposal
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM analysis failed: {str(e)}")


@router.post("/validate", response_model=ValidationResult)
async def validate_patch_endpoint(payload: ValidateRequest):
    patch_gen = PatchGenerator()
    workspace = patch_gen.create_isolated_workspace()
    try:
        patch_gen.apply_proposal_to_workspace(workspace, payload.proposal)
        validator = TerraformValidator()
        result = validator.validate_workspace(workspace, proposal=payload.proposal)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Validation failed: {str(e)}")
    finally:
        patch_gen.cleanup_workspace(workspace)


@router.post("/create-pr")
async def create_pr_endpoint(payload: CreatePRRequest):
    try:
        gh_manager = GitHubManager()
        result = gh_manager.create_or_update_pr(
            payload.drift_report,
            payload.proposal,
            payload.validation,
            dry_run=payload.dry_run,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"GitHub PR action failed: {str(e)}")
