"""
Historical reports and telemetry statistics router.
"""
from __future__ import annotations
from fastapi import APIRouter, HTTPException
from api.schemas import PipelineRunRecord, SystemStats
from api.store import store

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("", response_model=list[PipelineRunRecord])
async def list_reports():
    return store.list_runs()


@router.get("/stats", response_model=SystemStats)
async def get_system_stats():
    return store.get_stats()


@router.get("/{run_id}", response_model=PipelineRunRecord)
async def get_report(run_id: str):
    record = store.get_run(run_id)
    if not record:
        raise HTTPException(status_code=404, detail="Report not found")
    return record


@router.delete("/{run_id}")
async def delete_report(run_id: str):
    success = store.delete_run(run_id)
    if not success:
        raise HTTPException(status_code=404, detail="Report not found")
    return {"status": "deleted", "id": run_id}
