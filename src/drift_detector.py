"""
Deterministic Drift Detector and Risk Classifier.
Converts parsed plan resources into structured DriftReport with risk evaluation.
"""
from __future__ import annotations
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Union
from src.config import Config
from src.drift_model import (
    DriftReport,
    DriftType,
    ResourceDrift,
    RiskLevel,
)
from src.plan_parser import PlanParser
from src.audit_logger import audit_logger


class DriftDetector:
    """Classifies drift and calculates deterministic risk levels."""

    @classmethod
    def classify_action(cls, actions: List[str]) -> DriftType:
        """Map Terraform action list to a DriftType enum."""
        if not actions or actions == ["no-op"] or actions == ["read"]:
            return DriftType.NO_DRIFT
        if actions == ["create"]:
            return DriftType.RESOURCE_CREATE
        if actions == ["update"]:
            return DriftType.ATTRIBUTE_UPDATE
        if actions == ["delete"]:
            return DriftType.RESOURCE_DELETE
        if set(actions) == {"delete", "create"}:
            return DriftType.RESOURCE_REPLACEMENT
        return DriftType.UNKNOWN

    @classmethod
    def calculate_risk(cls, resource_type: str, drift_type: DriftType, diff_attributes: List[str]) -> RiskLevel:
        """
        Deterministic Risk Calculation Matrix:
        - Deletion / Replacement -> CRITICAL
        - High-Risk Resources (IAM, Security Groups, RDS) -> HIGH
        - Non-metadata resource attributes -> MEDIUM
        - Tags / metadata -> LOW
        """
        # 1. Any destructive change is CRITICAL
        if drift_type in (DriftType.RESOURCE_DELETE, DriftType.RESOURCE_REPLACEMENT):
            return RiskLevel.CRITICAL

        # 2. Changes on high-risk infrastructure components
        if resource_type in Config.HIGH_RISK_RESOURCES:
            return RiskLevel.HIGH

        # 3. Assess attributes
        if not diff_attributes:
            return RiskLevel.MEDIUM

        # Check if all changed attributes are in LOW_RISK_ATTRIBUTES
        all_low = True
        for attr in diff_attributes:
            top_attr = attr.split(".")[0]
            if top_attr not in Config.LOW_RISK_ATTRIBUTES:
                all_low = False
                break

        if all_low:
            return RiskLevel.LOW

        # Check medium risk
        for attr in diff_attributes:
            top_attr = attr.split(".")[0]
            if top_attr in Config.MEDIUM_RISK_ATTRIBUTES:
                return RiskLevel.MEDIUM

        return RiskLevel.MEDIUM

    @classmethod
    def detect_drift(cls, plan_source: Union[str, Path, Dict[str, Any]]) -> DriftReport:
        """Execute deterministic drift detection and return a full DriftReport."""
        parsed = PlanParser.parse_plan(plan_source)
        resource_changes = parsed.get("resource_changes", [])

        drifted_resources: List[ResourceDrift] = []
        highest_risk = RiskLevel.LOW
        risk_precedence = {
            RiskLevel.LOW: 1,
            RiskLevel.MEDIUM: 2,
            RiskLevel.HIGH: 3,
            RiskLevel.CRITICAL: 4,
        }

        for item in resource_changes:
            actions = item.get("actions", [])
            drift_type = cls.classify_action(actions)

            if drift_type == DriftType.NO_DRIFT:
                continue

            diffs = item.get("differences", [])
            diff_attrs = [d.attribute for d in diffs]
            risk = cls.calculate_risk(item.get("type", ""), drift_type, diff_attrs)

            # Update highest observed risk
            if risk_precedence[risk] > risk_precedence[highest_risk]:
                highest_risk = risk

            drifted_resources.append(ResourceDrift(
                address=item.get("address", ""),
                resource_type=item.get("type", ""),
                name=item.get("name", ""),
                actions=actions,
                drift_type=drift_type,
                risk=risk,
                differences=diffs,
                before_state=item.get("before"),
                after_state=item.get("after"),
            ))

        has_drift = len(drifted_resources) > 0
        report = DriftReport(
            timestamp=datetime.now(timezone.utc).isoformat(),
            terraform_version=parsed.get("terraform_version"),
            format_version=parsed.get("format_version"),
            has_drift=has_drift,
            total_resources_drifted=len(drifted_resources),
            overall_risk=highest_risk if has_drift else RiskLevel.LOW,
            resources=drifted_resources,
        )
        report.fingerprint = report.compute_fingerprint()

        audit_logger.log_event("DRIFT_DETECTION_COMPLETED", {
            "has_drift": report.has_drift,
            "total_drifted": report.total_resources_drifted,
            "overall_risk": report.overall_risk.value,
            "fingerprint": report.fingerprint,
        })

        return report
