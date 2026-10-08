"""
Pydantic data models for MERIDIAN drift detection, classification, and remediation.
"""
from __future__ import annotations
from enum import Enum
from typing import Any, Dict, List, Optional
import hashlib
import json
from pydantic import BaseModel, Field


class DriftType(str, Enum):
    NO_DRIFT = "NO_DRIFT"
    ATTRIBUTE_UPDATE = "ATTRIBUTE_UPDATE"
    RESOURCE_CREATE = "RESOURCE_CREATE"
    RESOURCE_DELETE = "RESOURCE_DELETE"
    RESOURCE_REPLACEMENT = "RESOURCE_REPLACEMENT"
    UNKNOWN = "UNKNOWN"


class RiskLevel(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class LLMProposalStatus(str, Enum):
    PROPOSED = "PROPOSED"
    NEEDS_HUMAN_REVIEW = "NEEDS_HUMAN_REVIEW"
    UNSAFE = "UNSAFE"
    INSUFFICIENT_CONTEXT = "INSUFFICIENT_CONTEXT"


class AttributeDifference(BaseModel):
    """Represents a specific attribute drift between desired (Git) and actual (live cloud)."""
    attribute: str = Field(description="Dotted attribute path (e.g., tags.Environment)")
    desired: Any = Field(description="Desired value specified in Terraform / state")
    actual: Any = Field(description="Actual live cloud value detected during refresh")


class ResourceDrift(BaseModel):
    """Detailed drift model for a single Terraform resource."""
    address: str = Field(description="Resource address, e.g. aws_s3_bucket.meridian_demo")
    resource_type: str = Field(description="Terraform resource type, e.g. aws_s3_bucket")
    name: str = Field(description="Resource local name, e.g. meridian_demo")
    actions: List[str] = Field(description="Terraform planned actions, e.g. ['update'], ['delete', 'create']")
    drift_type: DriftType = Field(default=DriftType.UNKNOWN)
    risk: RiskLevel = Field(default=RiskLevel.LOW)
    differences: List[AttributeDifference] = Field(default_factory=list)
    before_state: Optional[Dict[str, Any]] = Field(default=None, description="Actual live state before plan")
    after_state: Optional[Dict[str, Any]] = Field(default=None, description="Desired state after plan")


class DriftReport(BaseModel):
    """Complete structured report across all inspected resources."""
    timestamp: str = Field(description="ISO-8601 timestamp of drift report generation")
    terraform_version: Optional[str] = Field(default=None)
    format_version: Optional[str] = Field(default=None)
    has_drift: bool = Field(default=False)
    total_resources_drifted: int = Field(default=0)
    overall_risk: RiskLevel = Field(default=RiskLevel.LOW)
    resources: List[ResourceDrift] = Field(default_factory=list)
    fingerprint: str = Field(default="", description="Deterministic SHA256 fingerprint of the drift payload")

    def compute_fingerprint(self) -> str:
        """Compute an idempotent SHA256 fingerprint for duplicate PR prevention."""
        payload = []
        for r in sorted(self.resources, key=lambda x: x.address):
            payload.append({
                "address": r.address,
                "type": r.resource_type,
                "actions": sorted(r.actions),
                "differences": [
                    {"attr": d.attribute, "desired": str(d.desired), "actual": str(d.actual)}
                    for d in sorted(r.differences, key=lambda x: x.attribute)
                ]
            })
        raw_str = json.dumps(payload, sort_keys=True)
        return hashlib.sha256(raw_str.encode("utf-8")).hexdigest()[:16]


class LLMRemediationProposal(BaseModel):
    """Structured response schema strictly required from the LLM."""
    status: LLMProposalStatus = Field(description="Outcome status of the AI reasoning")
    summary: str = Field(description="Concise English explanation of the detected drift")
    root_cause_hypothesis: str = Field(description="Explanation of how/why the drift occurred")
    risk: RiskLevel = Field(description="AI evaluated risk level")
    recommended_action: str = Field(description="Action recommended for the human reviewer")
    files_to_modify: List[str] = Field(default_factory=list, description="Target Terraform file paths")
    patch: str = Field(default="", description="Unified diff or minimal HCL snippet")
    confidence: float = Field(ge=0.0, le=1.0, description="Confidence score between 0.0 and 1.0")
    requires_human_review: bool = Field(default=True, description="Strictly true for all IaC changes")


class ValidationResult(BaseModel):
    """Result of deterministic Terraform validation on proposed changes."""
    format_pass: bool = False
    validate_pass: bool = False
    plan_pass: bool = False
    unexpected_destroy: bool = False
    details: str = ""
    errors: List[str] = Field(default_factory=list)

    @property
    def is_valid(self) -> bool:
        return self.format_pass and self.validate_pass and self.plan_pass and not self.unexpected_destroy
