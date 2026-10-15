"""
Pipeline execution router for MERIDIAN.
Coordinates stages, publishes real-time WebSocket telemetry, and saves records.
"""
from __future__ import annotations
import asyncio
import datetime
import uuid
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException

from src.config import Config
from src.drift_detector import DriftDetector
from src.llm_analyzer import LLMAnalyzer
from src.patch_generator import PatchGenerator
from src.validator import TerraformValidator
from src.github_manager import GitHubManager
from api.schemas import PipelineRunRequest, PipelineRunRecord
from api.store import store
from api.websocket import ws_manager

router = APIRouter(prefix="/api/pipeline", tags=["pipeline"])


async def execute_pipeline_task(run_id: str, request: PipelineRunRequest):
    record = store.get_run(run_id)
    if not record:
        return

    record.status = "RUNNING"
    store.update_run(record)

    try:
        # Resolve plan source
        plan_source = None
        plan_name = "custom_plan.json"

        if request.plan_content:
            plan_source = request.plan_content
            plan_name = "uploaded_plan.json"
        elif request.fixture_name:
            fixture_path = Config.BASE_DIR / "tests" / "fixtures" / request.fixture_name
            if not fixture_path.exists():
                raise FileNotFoundError(f"Fixture {request.fixture_name} not found")
            plan_source = fixture_path
            plan_name = request.fixture_name
        elif request.plan_json_path:
            plan_path = Path(request.plan_json_path)
            if not plan_path.exists():
                raise FileNotFoundError(f"Plan file {request.plan_json_path} not found")
            plan_source = plan_path
            plan_name = plan_path.name
        else:
            default_path = Config.BASE_DIR / "tests" / "fixtures" / "update_plan.json"
            plan_source = default_path
            plan_name = default_path.name

        record.plan_name = plan_name

        # Helper to broadcast stage updates
        async def broadcast(stage: int, name: str, status: str, progress: float, msg: str, data=None):
            payload = {
                "run_id": run_id,
                "stage": stage,
                "stage_name": name,
                "status": status,
                "progress": progress,
                "message": msg,
                "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                "data": data or {},
            }
            record.logs.append(f"[{status.upper()}] Stage {stage}: {msg}")
            store.update_run(record)
            await ws_manager.broadcast_stage(run_id, payload)
            await asyncio.sleep(0.4)  # Small pacing for smooth real-time visual feedback

        # --- Stage 1 & 2: Plan Ingestion & Drift Detection ---
        await broadcast(1, "Plan Ingestion", "running", 0.1, f"Ingesting Terraform plan: {plan_name}")
        report = DriftDetector.detect_drift(plan_source)
        record.drift_report = report

        await broadcast(1, "Plan Ingestion", "completed", 0.2, "Plan parsed successfully")
        await broadcast(2, "Risk Scoring", "running", 0.3, "Evaluating deterministic risk matrix and computing fingerprint")

        if not report.has_drift:
            await broadcast(2, "Risk Scoring", "completed", 1.0, "Infrastructure in sync. No drift detected.", report.model_dump())
            record.status = "NO_DRIFT"
            record.completed_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
            store.update_run(record)
            return

        await broadcast(2, "Risk Scoring", "completed", 0.4, f"Found {report.total_resources_drifted} drifted resources. Risk: {report.overall_risk.value}", report.model_dump())

        # --- Stage 3: LLM Reasoning & Patch Synthesis ---
        await broadcast(3, "AI Reasoning", "running", 0.5, f"Synthesizing remediation proposal via {request.llm_provider}")

        # Relevant HCL
        hcl_content = ""
        main_tf = Config.TERRAFORM_DIR / "main.tf"
        if main_tf.exists():
            hcl_content = main_tf.read_text(encoding="utf-8")

        analyzer = LLMAnalyzer(provider=request.llm_provider or "mock")
        # Run blocking LLM analyzer in thread pool
        proposal = await asyncio.to_thread(analyzer.analyze_drift, report, relevant_terraform_code=hcl_content)
        record.proposal = proposal

        await broadcast(3, "AI Reasoning", "completed", 0.65, f"Remediation proposal generated (Confidence: {int(proposal.confidence * 100)}%)", proposal.model_dump())

        # --- Stage 4: Sandbox Patch Staging ---
        await broadcast(4, "Sandbox Isolation", "running", 0.72, "Creating ephemeral isolated sandbox workspace")
        patch_gen = PatchGenerator()
        temp_workspace = patch_gen.create_isolated_workspace()

        try:
            modified_files = patch_gen.apply_proposal_to_workspace(temp_workspace, proposal)
            await broadcast(4, "Sandbox Isolation", "completed", 0.80, f"Candidate patch staged in sandbox ({len(modified_files)} files modified)")

            # --- Stage 5: Deterministic Validation & Guardrails ---
            await broadcast(5, "Deterministic Validation", "running", 0.85, "Executing terraform fmt, validate, and destroy guardrails")
            validator = TerraformValidator()
            val_result = await asyncio.to_thread(validator.validate_workspace, temp_workspace, proposal=proposal)
            record.validation = val_result

            if not val_result.is_valid:
                err_msg = ", ".join(val_result.errors) if val_result.errors else "Guardrail violation"
                await broadcast(5, "Deterministic Validation", "failed", 0.90, f"Validation failed: {err_msg}", val_result.model_dump())
                record.status = "FAILED"
                record.error = err_msg
                record.completed_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
                store.update_run(record)
                return

            await broadcast(5, "Deterministic Validation", "completed", 0.92, "Deterministic checks passed. Destructive guardrails verified.", val_result.model_dump())

            # --- Stage 6: GitHub PR Creation & Idempotency ---
            await broadcast(6, "GitHub PR Automation", "running", 0.95, "Checking for existing pull requests and preparing review")
            gh_manager = GitHubManager()
            pr_result = await asyncio.to_thread(gh_manager.create_or_update_pr, report, proposal, val_result, dry_run=request.dry_run)
            record.pr_result = pr_result

            status_msg = "Duplicate PR suppressed (idempotent)" if pr_result.get("action") == "SUPPRESSED_DUPLICATE" else f"Pull request ready: {pr_result.get('pr_url')}"
            await broadcast(6, "GitHub PR Automation", "completed", 1.0, status_msg, pr_result)

            record.status = "SUCCESS"
            record.completed_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
            store.update_run(record)

        finally:
            patch_gen.cleanup_workspace(temp_workspace)

    except Exception as e:
        record.status = "FAILED"
        record.error = str(e)
        record.completed_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
        store.update_run(record)
        await ws_manager.broadcast_stage(run_id, {
            "run_id": run_id,
            "stage": 0,
            "stage_name": "Pipeline Error",
            "status": "failed",
            "progress": 1.0,
            "message": f"Execution error: {str(e)}",
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        })


@router.post("/run", response_model=PipelineRunRecord)
async def run_pipeline_endpoint(request: PipelineRunRequest, background_tasks: BackgroundTasks):
    run_id = f"run-{uuid.uuid4().hex[:8]}"
    record = PipelineRunRecord(
        id=run_id,
        status="QUEUED",
        created_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),
        plan_name=request.fixture_name or "custom_plan.json",
        llm_provider=request.llm_provider or "mock",
        dry_run=request.dry_run,
        logs=[f"Run queued at {datetime.datetime.now(datetime.timezone.utc).isoformat()}"]
    )
    store.add_run(record)
    background_tasks.add_task(execute_pipeline_task, run_id, request)
    return record


@router.get("/runs", response_model=list[PipelineRunRecord])
async def list_runs():
    return store.list_runs()


@router.get("/runs/{run_id}", response_model=PipelineRunRecord)
async def get_run(run_id: str):
    record = store.get_run(run_id)
    if not record:
        raise HTTPException(status_code=404, detail="Run not found")
    return record


@router.delete("/runs/{run_id}")
async def delete_run(run_id: str):
    success = store.delete_run(run_id)
    if not success:
        raise HTTPException(status_code=404, detail="Run not found")
    return {"status": "deleted", "id": run_id}
