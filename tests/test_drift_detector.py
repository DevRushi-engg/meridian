"""
Unit tests for deterministic drift detector and risk classification.
"""
from pathlib import Path
import pytest
from src.drift_detector import DriftDetector
from src.drift_model import DriftType, RiskLevel

FIXTURES_DIR = Path(__file__).parent / "fixtures"


def test_detect_no_drift():
    plan_file = FIXTURES_DIR / "no_drift_plan.json"
    report = DriftDetector.detect_drift(plan_file)

    assert not report.has_drift
    assert report.total_resources_drifted == 0
    assert report.overall_risk == RiskLevel.LOW
    assert len(report.resources) == 0


def test_detect_update_drift():
    plan_file = FIXTURES_DIR / "update_plan.json"
    report = DriftDetector.detect_drift(plan_file)

    assert report.has_drift
    assert report.total_resources_drifted == 1
    assert report.overall_risk == RiskLevel.LOW  # Tag drift is LOW risk

    res = report.resources[0]
    assert res.address == "aws_s3_bucket.meridian_demo"
    assert res.drift_type == DriftType.ATTRIBUTE_UPDATE
    assert res.risk == RiskLevel.LOW
    assert len(res.differences) >= 1
    assert len(report.fingerprint) == 16


def test_detect_critical_delete_drift():
    plan_file = FIXTURES_DIR / "delete_plan.json"
    report = DriftDetector.detect_drift(plan_file)

    assert report.has_drift
    assert report.overall_risk == RiskLevel.CRITICAL
    assert report.resources[0].drift_type == DriftType.RESOURCE_DELETE


def test_detect_critical_replace_drift():
    plan_file = FIXTURES_DIR / "replace_plan.json"
    report = DriftDetector.detect_drift(plan_file)

    assert report.has_drift
    assert report.overall_risk == RiskLevel.CRITICAL
    assert report.resources[0].drift_type == DriftType.RESOURCE_REPLACEMENT


def test_detect_multiple_changes_high_risk():
    plan_file = FIXTURES_DIR / "multiple_changes_plan.json"
    report = DriftDetector.detect_drift(plan_file)

    assert report.has_drift
    assert report.total_resources_drifted == 2
    # Because security group changes are classified as HIGH risk, overall risk escalates to HIGH
    assert report.overall_risk == RiskLevel.HIGH


def test_fingerprint_idempotency():
    plan_file = FIXTURES_DIR / "update_plan.json"
    report1 = DriftDetector.detect_drift(plan_file)
    report2 = DriftDetector.detect_drift(plan_file)

    assert report1.fingerprint == report2.fingerprint
    assert len(report1.fingerprint) > 0
