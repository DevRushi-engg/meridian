"""
Configuration management for MERIDIAN.
"""
from __future__ import annotations
import os
from pathlib import Path
from typing import Dict, List, Set
from dotenv import load_dotenv

# Load .env file if present
load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

class Config:
    """MERIDIAN Global Configuration Settings."""

    # Project paths
    BASE_DIR: Path = BASE_DIR
    TERRAFORM_DIR: Path = Path(os.getenv("MERIDIAN_TERRAFORM_DIR", BASE_DIR / "terraform"))
    PROMPTS_DIR: Path = Path(os.getenv("MERIDIAN_PROMPTS_DIR", BASE_DIR / "prompts"))
    LOGS_DIR: Path = Path(os.getenv("MERIDIAN_LOGS_DIR", BASE_DIR / "logs"))

    # GitHub Settings
    GITHUB_TOKEN: str = os.getenv("GITHUB_TOKEN", "")
    GITHUB_REPOSITORY: str = os.getenv("GITHUB_REPOSITORY", "")  # e.g. "owner/repo"
    GITHUB_BASE_BRANCH: str = os.getenv("GITHUB_BASE_BRANCH", "main")
    PR_BRANCH_PREFIX: str = os.getenv("PR_BRANCH_PREFIX", "meridian/drift")

    # LLM Settings
    LLM_PROVIDER: str = os.getenv("LLM_PROVIDER", "gemini")  # "gemini" | "openai" | "mock"
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    LLM_MODEL: str = os.getenv("LLM_MODEL", "gemini-2.5-flash")
    LLM_TEMPERATURE: float = float(os.getenv("LLM_TEMPERATURE", "0.1"))
    LLM_MAX_RETRIES: int = int(os.getenv("LLM_MAX_RETRIES", "3"))

    # Policy & Risk Mapping
    # Resources that carry inherently high risk on modification
    HIGH_RISK_RESOURCES: Set[str] = {
        "aws_security_group",
        "aws_security_group_rule",
        "aws_iam_policy",
        "aws_iam_role",
        "aws_iam_user_policy",
        "aws_db_instance",
        "aws_rds_cluster",
        "aws_kms_key",
    }

    # Attribute keys that represent low risk (metadata/tags)
    LOW_RISK_ATTRIBUTES: Set[str] = {
        "tags",
        "tags_all",
        "description",
        "comment",
    }

    # Medium risk attributes
    MEDIUM_RISK_ATTRIBUTES: Set[str] = {
        "instance_type",
        "versioning",
        "lifecycle_rule",
        "cors_rule",
    }

    # Destructive actions that mandate CRITICAL classification
    CRITICAL_ACTIONS: Set[str] = {"delete", "replace"}

    @classmethod
    def ensure_directories(cls) -> None:
        """Ensure necessary output and log directories exist."""
        cls.LOGS_DIR.mkdir(parents=True, exist_ok=True)
