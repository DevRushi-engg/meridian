"""
End-to-End Pipeline integration tests for MERIDIAN.
"""
from pathlib import Path
from src.main import run_pipeline
from src.drift_detector import DriftDetector
from src.llm_analyzer import LLMAnalyzer
from src.patch_generator import PatchGenerator
from src.validator import TerraformValidator
from src.github_manager import GitHubManager

FIXTURES_DIR = Path(__file__).parent / "fixtures"


def test_full_pipeline_no_drift():
    plan_file = FIXTURES_DIR / "no_drift_plan.json"
    exit_code = run_pipeline(plan_json_path=plan_file, dry_run=True, llm_provider="mock")
    assert exit_code == 0


def test_full_pipeline_update_drift():
    plan_file = FIXTURES_DIR / "update_plan.json"
    exit_code = run_pipeline(plan_json_path=plan_file, dry_run=True, llm_provider="mock")
    assert exit_code == 0


def test_full_pipeline_destructive_drift_blocked():
    plan_file = FIXTURES_DIR / "delete_plan.json"
    exit_code = run_pipeline(plan_json_path=plan_file, dry_run=True, llm_provider="mock")
    # Destructive plan triggers guardrails and exits with code 1 (blocking PR)
    assert exit_code == 1


def test_e2e_components_integration():
    # 1. Detect
    plan_file = FIXTURES_DIR / "update_plan.json"
    report = DriftDetector.detect_drift(plan_file)
    assert report.has_drift is True

    # 2. Analyze
    analyzer = LLMAnalyzer(provider="mock")
    proposal = analyzer.analyze_drift(report)
    assert proposal.confidence >= 0.90

    # 3. Patch sandbox
    patch_gen = PatchGenerator()
    workspace = patch_gen.create_isolated_workspace()
    try:
        modified = patch_gen.apply_proposal_to_workspace(workspace, proposal)
        assert len(modified) > 0

        # 4. Validate
        validator = TerraformValidator()
        val_res = validator.validate_workspace(workspace, proposal=proposal)
        assert val_res.is_valid is True

        # 5. GitHub PR Simulation
        gh = GitHubManager()
        pr_res = gh.create_or_update_pr(report, proposal, val_res, dry_run=True)
        assert pr_res["action"] == "SIMULATED_PR"
        assert f"[{report.fingerprint}]" in pr_res["title"]
        assert "## Drift detected" in pr_res["body"]
    finally:
        patch_gen.cleanup_workspace(workspace)
