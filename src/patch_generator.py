"""
Patch Generator and Isolated Worktree Manager for MERIDIAN.
Safely applies proposed candidate changes in an isolated workspace.
"""
from __future__ import annotations
import shutil
import tempfile
from pathlib import Path
from typing import List, Optional
from src.config import Config
from src.drift_model import LLMRemediationProposal
from src.exceptions import PatchApplicationError
from src.audit_logger import audit_logger


class PatchGenerator:
    """Manages isolated workspaces and applies candidate remediation patches."""

    def __init__(self, source_terraform_dir: Optional[Path] = None):
        self.source_dir = source_terraform_dir or Config.TERRAFORM_DIR

    def create_isolated_workspace(self) -> Path:
        """Create a temporary isolated directory copying the current Terraform code."""
        temp_dir = Path(tempfile.mkdtemp(prefix="meridian_tf_"))
        try:
            if self.source_dir.exists():
                shutil.copytree(self.source_dir, temp_dir, dirs_exist_ok=True)
            else:
                temp_dir.mkdir(parents=True, exist_ok=True)
            return temp_dir
        except Exception as e:
            raise PatchApplicationError(f"Failed to create isolated workspace: {e}")

    def apply_proposal_to_workspace(
        self,
        workspace: Path,
        proposal: LLMRemediationProposal
    ) -> List[Path]:
        """
        Apply proposed candidate changes to the isolated workspace.
        Enforces strict boundary check: only files inside the workspace are allowed.
        """
        modified_files: List[Path] = []

        if not proposal.patch or not proposal.files_to_modify:
            audit_logger.log_event("PATCH_SKIPPED", {
                "reason": "No patch or files to modify provided",
                "status": proposal.status.value,
            })
            return modified_files

        for file_rel in proposal.files_to_modify:
            # Normalize path
            clean_rel = file_rel.replace("\\", "/")
            if clean_rel.startswith("terraform/"):
                clean_rel = clean_rel[len("terraform/"):]

            target_file = (workspace / clean_rel).resolve()

            # Security check: Ensure target_file is strictly inside workspace
            if not str(target_file).startswith(str(workspace.resolve())):
                raise PatchApplicationError(f"Illegal path escape detected: {file_rel}")

            # Apply patch
            self._apply_patch_to_file(target_file, proposal.patch)
            modified_files.append(target_file)

        audit_logger.log_event("PATCH_APPLIED_TO_WORKSPACE", {
            "workspace": str(workspace),
            "modified_files": [str(f.name) for f in modified_files],
        })

        return modified_files

    def _apply_patch_to_file(self, target_file: Path, patch_content: str) -> None:
        """Apply unified diff or raw block content to target file."""
        target_file.parent.mkdir(parents=True, exist_ok=True)

        # Check if patch is unified diff
        if patch_content.startswith("---") or "\n+++" in patch_content:
            self._apply_unified_diff(target_file, patch_content)
        else:
            # If it's a replacement HCL block / file content, write directly if target exists or is created
            with open(target_file, "w", encoding="utf-8") as f:
                f.write(patch_content)

    def _apply_unified_diff(self, target_file: Path, diff_text: str) -> None:
        """Parse and apply simple unified diff additions/deletions."""
        if not target_file.exists():
            original_lines = []
        else:
            with open(target_file, "r", encoding="utf-8") as f:
                original_lines = f.readlines()

        new_lines: List[str] = []
        for line in diff_text.splitlines(keepends=True):
            if line.startswith("---") or line.startswith("+++") or line.startswith("@@"):
                continue
            if line.startswith("-"):
                # Deleted line from target
                continue
            elif line.startswith("+"):
                # Added line to target
                new_lines.append(line[1:])
            else:
                # Context line (leading space if formatted diff)
                if line.startswith(" "):
                    new_lines.append(line[1:])
                else:
                    new_lines.append(line)

        # If diff parsing produced content, write it; otherwise keep original
        if new_lines:
            with open(target_file, "w", encoding="utf-8") as f:
                f.writelines(new_lines)
        elif not target_file.exists():
            with open(target_file, "w", encoding="utf-8") as f:
                f.write(diff_text)

    @staticmethod
    def cleanup_workspace(workspace: Path) -> None:
        """Safely delete isolated workspace after validation."""
        try:
            if workspace.exists() and "meridian_tf_" in str(workspace):
                shutil.rmtree(workspace, ignore_errors=True)
        except Exception as e:
            audit_logger.log_event("WORKSPACE_CLEANUP_FAILED", {"path": str(workspace), "error": str(e)}, level="WARNING")
