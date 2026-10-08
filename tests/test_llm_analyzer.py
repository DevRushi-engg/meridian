"""
Unit tests for the LLM Analyzer module.
"""
from pathlib import Path
import pytest
from src.drift_detector import DriftDetector
from src.drift_model import LLMProposalStatus, RiskLevel
from src.llm_analyzer import LLMAnalyzer

FIXTURES_DIR = Path(__file__).parent / "fixtures"


def test_mock_llm_analysis_update_drift():
    plan_file = FIXTURES_DIR / "update_plan.json"
    report = DriftDetector.detect_drift(plan_file)

    analyzer = LLMAnalyzer(provider="mock")
    proposal = analyzer.analyze_drift(report)

    assert proposal.status == LLMProposalStatus.PROPOSED
    assert proposal.risk == RiskLevel.LOW
    assert proposal.confidence >= 0.90
    assert proposal.requires_human_review is True
    assert len(proposal.files_to_modify) > 0
    assert "Environment" in proposal.summary


def test_mock_llm_analysis_critical_drift():
    plan_file = FIXTURES_DIR / "delete_plan.json"
    report = DriftDetector.detect_drift(plan_file)

    analyzer = LLMAnalyzer(provider="mock")
    proposal = analyzer.analyze_drift(report)

    assert proposal.status == LLMProposalStatus.NEEDS_HUMAN_REVIEW
    assert proposal.risk == RiskLevel.CRITICAL
    assert proposal.requires_human_review is True


def test_mock_llm_analysis_no_drift():
    plan_file = FIXTURES_DIR / "no_drift_plan.json"
    report = DriftDetector.detect_drift(plan_file)

    analyzer = LLMAnalyzer(provider="mock")
    proposal = analyzer.analyze_drift(report)

    assert proposal.status == LLMProposalStatus.INSUFFICIENT_CONTEXT
    assert proposal.requires_human_review is False


def test_response_validation_with_markdown_fences():
    analyzer = LLMAnalyzer(provider="mock")
    raw_markdown_json = """```json
    {
      "status": "PROPOSED",
      "summary": "Fix tag drift.",
      "root_cause_hypothesis": "Manual change.",
      "risk": "LOW",
      "recommended_action": "Apply tag.",
      "files_to_modify": ["terraform/main.tf"],
      "patch": "Environment = \\"development\\"",
      "confidence": 0.98,
      "requires_human_review": true
    }
    ```"""
    parsed = analyzer._parse_and_validate_response(raw_markdown_json)
    assert parsed.status == LLMProposalStatus.PROPOSED
    assert parsed.confidence == 0.98
