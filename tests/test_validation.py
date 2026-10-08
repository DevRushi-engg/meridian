"""
Unit tests for deterministic validator and safety guardrails.
"""
from pathlib import Path
from src.drift_model import LLMProposalStatus, LLMRemediationProposal, RiskLevel
from src.patch_generator import PatchGenerator
from src.validator import TerraformValidator


def test_validator_clean_workspace():
    gen = PatchGenerator()
    workspace = gen.create_isolated_workspace()
    validator = TerraformValidator()

    result = validator.validate_workspace(workspace)
    assert result.format_pass is True
    assert result.validate_pass is True
    assert result.unexpected_destroy is False
    assert result.is_valid is True

    gen.cleanup_workspace(workspace)


def test_validator_blocks_critical_destructive_proposal():
    gen = PatchGenerator()
    workspace = gen.create_isolated_workspace()
    validator = TerraformValidator()

    critical_proposal = LLMRemediationProposal(
        status=LLMProposalStatus.NEEDS_HUMAN_REVIEW,
        summary="Destroy database",
        root_cause_hypothesis="Accidental drift",
        risk=RiskLevel.CRITICAL,
        recommended_action="Delete resource",
        files_to_modify=["terraform/main.tf"],
        patch="# Delete everything",
        confidence=0.99,
        requires_human_review=True,
    )

    result = validator.validate_workspace(workspace, proposal=critical_proposal)
    assert result.unexpected_destroy is True
    assert result.is_valid is False
    assert any("Guardrail Triggered" in err for err in result.errors)

    gen.cleanup_workspace(workspace)


def test_validator_detects_malformed_syntax():
    gen = PatchGenerator()
    workspace = gen.create_isolated_workspace()
    validator = TerraformValidator()

    # Write invalid HCL syntax (unclosed braces)
    (workspace / "bad.tf").write_text('resource "aws_s3_bucket" "oops" {', encoding="utf-8")

    result = validator.validate_workspace(workspace)
    assert result.format_pass is False or result.validate_pass is False
    assert result.is_valid is False

    gen.cleanup_workspace(workspace)
