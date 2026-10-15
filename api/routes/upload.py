"""
File upload and fixture selection router for MERIDIAN.
"""
from __future__ import annotations
import json
from pathlib import Path
from typing import Any, Dict, List
from fastapi import APIRouter, File, HTTPException, UploadFile
from src.config import Config

router = APIRouter(prefix="/api/upload", tags=["upload"])


@router.post("/plan")
async def upload_plan_file(file: UploadFile = File(...)):
    """Upload a Terraform show -json output file."""
    if not file.filename.endswith(".json"):
        raise HTTPException(status_code=400, detail="Uploaded file must be a JSON file")

    try:
        content = await file.read()
        parsed_json = json.loads(content.decode("utf-8"))

        # Verify minimal terraform plan structure
        if "format_version" not in parsed_json and "resource_changes" not in parsed_json:
            raise HTTPException(status_code=400, detail="JSON file does not appear to be a valid Terraform plan")

        return {
            "filename": file.filename,
            "size": len(content),
            "format_version": parsed_json.get("format_version", "unknown"),
            "terraform_version": parsed_json.get("terraform_version", "unknown"),
            "plan_content": parsed_json,
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to process plan JSON: {str(e)}")


@router.get("/fixtures")
async def list_available_fixtures() -> List[Dict[str, Any]]:
    """List bundled fixture plans with metadata for easy one-click testing."""
    fixtures_dir = Config.BASE_DIR / "tests" / "fixtures"
    result = []
    if fixtures_dir.exists():
        for f in sorted(fixtures_dir.glob("*.json")):
            try:
                data = json.loads(f.read_text(encoding="utf-8"))
                changes = data.get("resource_changes", [])
                result.append({
                    "filename": f.name,
                    "resource_count": len(changes),
                    "terraform_version": data.get("terraform_version", "unknown"),
                    "description": {
                        "update_plan.json": "Standard S3 Bucket attribute drift (Medium Risk)",
                        "replace_plan.json": "Database RDS Security Group replacement (Critical Risk)",
                        "delete_plan.json": "Unauthorized IAM Role deletion (Critical Risk)",
                        "multiple_changes_plan.json": "Multi-resource production drift (High Risk)",
                        "no_drift_plan.json": "Clean synchronized infrastructure (No Drift)",
                    }.get(f.name, "Custom Terraform plan fixture")
                })
            except Exception:
                pass
    return result
