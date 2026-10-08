"""
Custom exceptions for the MERIDIAN drift detection and remediation system.
"""

class MeridianError(Exception):
    """Base exception for all MERIDIAN errors."""
    pass


class PlanParsingError(MeridianError):
    """Raised when parsing a Terraform JSON plan fails."""
    pass


class DriftClassificationError(MeridianError):
    """Raised when classifying infrastructure drift fails."""
    pass


class LLMAnalysisError(MeridianError):
    """Raised when LLM analysis, explanation, or patch synthesis fails."""
    pass


class PatchApplicationError(MeridianError):
    """Raised when applying a candidate patch to a worktree fails."""
    pass


class ValidationFailedError(MeridianError):
    """Raised when Terraform validation checks (fmt/validate/plan) fail."""
    pass


class DestructiveChangeError(MeridianError):
    """Raised when a candidate change contains unexpected destructive actions."""
    pass


class GitHubAutomationError(MeridianError):
    """Raised when GitHub API operations (branch/commit/PR) fail."""
    pass
