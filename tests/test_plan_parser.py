"""
Unit tests for the Terraform plan parser.
"""
from pathlib import Path
import pytest
from src.plan_parser import PlanParser
from src.exceptions import PlanParsingError

FIXTURES_DIR = Path(__file__).parent / "fixtures"


def test_parse_no_drift():
    plan_file = FIXTURES_DIR / "no_drift_plan.json"
    result = PlanParser.parse_plan(plan_file)
    assert result["format_version"] == "1.2"
    assert result["terraform_version"] == "1.7.0"
    assert len(result["resource_changes"]) == 0  # No-op resources filtered out


def test_parse_update_plan():
    plan_file = FIXTURES_DIR / "update_plan.json"
    result = PlanParser.parse_plan(plan_file)
    assert len(result["resource_changes"]) == 1

    rc = result["resource_changes"][0]
    assert rc["address"] == "aws_s3_bucket.meridian_demo"
    assert rc["type"] == "aws_s3_bucket"
    assert rc["actions"] == ["update"]

    diffs = rc["differences"]
    tag_diff = next(d for d in diffs if d.attribute == "tags.Environment")
    assert tag_diff.desired == "development"
    assert tag_diff.actual == "production"


def test_parse_delete_plan():
    plan_file = FIXTURES_DIR / "delete_plan.json"
    result = PlanParser.parse_plan(plan_file)
    assert len(result["resource_changes"]) == 1
    assert result["resource_changes"][0]["actions"] == ["delete"]


def test_parse_invalid_path():
    with pytest.raises(PlanParsingError):
        PlanParser.parse_plan("non_existent_file.json")


def test_parse_invalid_json():
    with pytest.raises(PlanParsingError):
        PlanParser.parse_plan("{ invalid json string")
