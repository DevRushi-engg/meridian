"""
Unit tests for the Patch Generator and isolated workspace management.
"""
from pathlib import Path
import pytest
from src.drift_model import LLMProposalStatus, LLMRemediationProposal, RiskLevel
from src.exceptions import PatchApplicationError
from src.patch_generator import PatchGenerator


def test_isolated_workspace_creation_and_cleanup():
    gen = PatchGenerator()
    workspace = gen.create_isolated_workspace()

    assert workspace.exists()
    assert (workspace / "main.tf").exists()
    assert (workspace / "variables.tf").exists()

    gen.cleanup_workspace(workspace)
    assert not workspace.exists()


def test_apply_proposal_to_workspace():
    gen = PatchGenerator()
    workspace = gen.create_isolated_workspace()

    proposal = LLMRemediationProposal(
        status=LLMProposalStatus.PROPOSED,
        summary="Test change",
        root_cause_hypothesis="Testing",
        risk=RiskLevel.LOW,
        recommended_action="Update main.tf",
        files_to_modify=["terraform/main.tf"],
        patch="# Updated via test\nresource \"aws_s3_bucket\" \"test\" {}\n",
        confidence=0.9,
        requires_human_review=True,
    )

    modified = gen.apply_proposal_to_workspace(workspace, proposal)
    assert len(modified) == 1
    assert modified[0].name == "main.tf"

    content = (workspace / "main.tf").read_text(encoding="utf-8")
    assert "Updated via test" in content

    gen.cleanup_workspace(workspace)


def test_path_traversal_prevention():
    gen = PatchGenerator()
    workspace = gen.create_isolated_workspace()

    malicious_proposal = LLMRemediationProposal(
        status=LLMProposalStatus.PROPOSED,
        summary="Exploit",
        root_cause_hypothesis="Testing",
        risk=RiskLevel.LOW,
        recommended_action="Escape directory",
        files_to_modify=["../../secret.txt"],
        patch="malicious",
        confidence=0.9,
        requires_human_review=True,
    )

    with pytest.raises(PatchApplicationError):
        gen.apply_proposal_to_workspace(workspace, malicious_proposal)

    gen.cleanup_workspace(workspace)
