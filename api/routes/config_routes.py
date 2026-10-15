"""
Configuration retrieval and runtime update router for MERIDIAN.
"""
from __future__ import annotations
import os
from fastapi import APIRouter
from src.config import Config
from api.schemas import ConfigResponse, ConfigUpdateRequest

router = APIRouter(prefix="/api/config", tags=["config"])


@router.get("", response_model=ConfigResponse)
async def get_config():
    return ConfigResponse(
        llm_provider=Config.LLM_PROVIDER,
        llm_model=Config.LLM_MODEL,
        github_repository=Config.GITHUB_REPOSITORY,
        github_base_branch=Config.GITHUB_BASE_BRANCH,
        pr_branch_prefix=Config.PR_BRANCH_PREFIX,
        has_github_token=bool(Config.GITHUB_TOKEN),
        has_gemini_key=bool(Config.GEMINI_API_KEY),
        has_openai_key=bool(Config.OPENAI_API_KEY),
        high_risk_resources=sorted(list(Config.HIGH_RISK_RESOURCES)),
        critical_actions=sorted(list(Config.CRITICAL_ACTIONS)),
    )


@router.post("", response_model=ConfigResponse)
async def update_config(update: ConfigUpdateRequest):
    if update.llm_provider:
        Config.LLM_PROVIDER = update.llm_provider
    if update.llm_model:
        Config.LLM_MODEL = update.llm_model
    if update.github_repository:
        Config.GITHUB_REPOSITORY = update.github_repository
    if update.github_token:
        Config.GITHUB_TOKEN = update.github_token
    if update.gemini_api_key:
        Config.GEMINI_API_KEY = update.gemini_api_key
    if update.openai_api_key:
        Config.OPENAI_API_KEY = update.openai_api_key

    return await get_config()
