"""
Terraform Plan JSON Parser.
Extracts structured resource changes, attribute-level differences, and actions.
"""
from __future__ import annotations
import json
from pathlib import Path
from typing import Any, Dict, List, Tuple, Union
from src.drift_model import AttributeDifference
from src.exceptions import PlanParsingError
from src.audit_logger import audit_logger


class PlanParser:
    """Parses Terraform show -json output into normalized raw change structures."""

    @staticmethod
    def load_json(source: Union[str, Path, Dict[str, Any]]) -> Dict[str, Any]:
        """Load JSON plan from file path, JSON string, or dictionary."""
        if isinstance(source, dict):
            return source
        if isinstance(source, Path) or (isinstance(source, str) and (Path(source).exists() or source.endswith(".json"))):
            path = Path(source)
            if not path.exists():
                raise PlanParsingError(f"Terraform plan JSON file not found: {path}")
            try:
                with open(path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:
                raise PlanParsingError(f"Failed to read/parse JSON from {path}: {e}")
        elif isinstance(source, str):
            try:
                return json.loads(source)
            except Exception as e:
                raise PlanParsingError(f"Failed to parse JSON string: {e}")
        else:
            raise PlanParsingError(f"Unsupported plan source type: {type(source)}")

    @classmethod
    def parse_plan(cls, plan_data: Union[str, Path, Dict[str, Any]]) -> Dict[str, Any]:
        """
        Parse terraform show -json dict.
        Returns metadata and list of non-noop resource changes.
        """
        data = cls.load_json(plan_data)

        format_version = data.get("format_version")
        terraform_version = data.get("terraform_version")
        raw_changes = data.get("resource_changes", [])

        parsed_resources: List[Dict[str, Any]] = []

        for rc in raw_changes:
            address = rc.get("address", "")
            resource_type = rc.get("type", "")
            name = rc.get("name", "")
            change = rc.get("change", {})
            actions = change.get("actions", [])

            # Ignore pure no-op resources
            if actions == ["no-op"] or actions == ["read"]:
                continue

            before = change.get("before") or {}
            after = change.get("after") or {}

            # Extract detailed field diffs
            differences = cls._diff_dicts(before, after)

            parsed_resources.append({
                "address": address,
                "type": resource_type,
                "name": name,
                "actions": actions,
                "before": before,
                "after": after,
                "differences": differences,
            })

        audit_logger.log_event("PLAN_PARSED", {
            "format_version": format_version,
            "terraform_version": terraform_version,
            "total_changes": len(parsed_resources),
        })

        return {
            "format_version": format_version,
            "terraform_version": terraform_version,
            "resource_changes": parsed_resources,
        }

    @classmethod
    def _diff_dicts(
        cls,
        before: Any,
        after: Any,
        prefix: str = ""
    ) -> List[AttributeDifference]:
        """Recursively compute attribute differences between before and after states."""
        diffs: List[AttributeDifference] = []

        if isinstance(before, dict) and isinstance(after, dict):
            all_keys = set(before.keys()).union(set(after.keys()))
            for key in sorted(all_keys):
                curr_prefix = f"{prefix}.{key}" if prefix else key
                val_before = before.get(key)
                val_after = after.get(key)

                if val_before != val_after:
                    if isinstance(val_before, dict) and isinstance(val_after, dict):
                        diffs.extend(cls._diff_dicts(val_before, val_after, curr_prefix))
                    else:
                        diffs.append(AttributeDifference(
                            attribute=curr_prefix,
                            desired=val_after,
                            actual=val_before,
                        ))
        elif before != after:
            diffs.append(AttributeDifference(
                attribute=prefix or "value",
                desired=after,
                actual=before,
            ))

        return diffs
