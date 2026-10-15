"""
FastAPI Pydantic Schemas for MERIDIAN API.
"""
from __future__ import annotations
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from src.drift_model import DriftReport, LLMRemediationProposal, ValidationResult, RiskLevel


class PipelineRunRequest(BaseModel):
    fixture_name: Optional[str] = Field(default=None, description="Preset fixture name, e.g. update_plan.json")
    plan_json_path: Optional[str] = Field(default=None, description="Absolute or relative path to plan json")
    plan_content: Optional[Dict[str, Any]] = Field(default=None, description="Raw JSON object of terraform plan")
    llm_provider: Optional[str] = Field(default="mock", description="AI provider (mock, gemini, openai)")
    dry_run: bool = Field(default=True, description="Whether to simulate PR creation")


class PipelineStageUpdate(BaseModel):
    run_id: str
    stage: int
    stage_name: str
    status: str  # pending | running | completed | failed | skipped
    progress: float  # 0.0 to 1.0
    message: str
    timestamp: str
    data: Optional[Dict[str, Any]] = None


class PipelineRunRecord(BaseModel):
    id: str
    status: str  # QUEUED | RUNNING | SUCCESS | FAILED | NO_DRIFT
    created_at: str
    completed_at: Optional[str] = None
    plan_name: str
    llm_provider: str
    dry_run: bool
    drift_report: Optional[DriftReport] = None
    proposal: Optional[LLMRemediationProposal] = None
    validation: Optional[ValidationResult] = None
    pr_result: Optional[Dict[str, Any]] = None
    logs: List[str] = Field(default_factory=list)
    error: Optional[str] = None


class ConfigResponse(BaseModel):
    llm_provider: str
    llm_model: str
    github_repository: str
    github_base_branch: str
    pr_branch_prefix: str
    has_github_token: bool
    has_gemini_key: bool
    has_openai_key: bool
    high_risk_resources: List[str]
    critical_actions: List[str]


class ConfigUpdateRequest(BaseModel):
    llm_provider: Optional[str] = None
    llm_model: Optional[str] = None
    github_repository: Optional[str] = None
    github_token: Optional[str] = None
    gemini_api_key: Optional[str] = None
    openai_api_key: Optional[str] = None


class SystemStats(BaseModel):
    total_runs: int
    total_drift_detected: int
    critical_risks: int
    prs_generated: int
    uptime_seconds: float
