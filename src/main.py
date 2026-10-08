"""
MERIDIAN - AI-Assisted Terraform Drift Detection & Human-Approved Remediation.
Main CLI entrypoint and pipeline orchestrator.
"""
from __future__ import annotations
import argparse
import json
import sys
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from typing import Optional

from rich.console import Console
from rich.panel import Panel
from rich.table import Table

from src.config import Config
from src.drift_detector import DriftDetector
from src.llm_analyzer import LLMAnalyzer
from src.patch_generator import PatchGenerator
from src.validator import TerraformValidator
from src.github_manager import GitHubManager
from src.audit_logger import audit_logger, logger
from src.drift_model import RiskLevel

# Ensure UTF-8 output where possible
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

console = Console(highlight=False)


def run_pipeline(
    plan_json_path: Optional[Path] = None,
    dry_run: bool = True,
    llm_provider: Optional[str] = None,
    output_report_path: Optional[Path] = None,
) -> int:
    """
    Executes the complete MERIDIAN 6-stage remediation loop:
    1. Plan Ingestion & Drift Detection
    2. Risk Scoring & Classification
    3. AI Reasoning & Patch Synthesis
    4. Isolated Workspace Patching
    5. Deterministic Validation & Guardrails
    6. GitHub Pull Request Creation (with duplicate suppression)
    """
    console.print(Panel.fit(
        "[bold cyan]MERIDIAN[/bold cyan] - [italic]AI-Assisted Terraform Drift Detection & Human-Approved Remediation[/italic]\n"
        "[dim]Design Principle: The LLM proposes. Terraform validates. GitHub reviews. A human approves.[/dim]",
        border_style="cyan"
    ))

    # 1. Ingest Plan & Detect Drift
    if not plan_json_path:
        plan_json_path = Config.BASE_DIR / "tests" / "fixtures" / "update_plan.json"

    console.print(f"\n[bold green]>>> Stage 1 & 2: Ingesting Terraform Plan & Detecting Drift[/bold green] ({plan_json_path.name})")
    report = DriftDetector.detect_drift(plan_json_path)

    if not report.has_drift:
        console.print("[bold green][OK] Infrastructure is in sync with Terraform desired state. No drift detected.[/bold green]")
        return 0

    # Display drift summary table
    table = Table(title=f"Detected Drift ({report.total_resources_drifted} resource(s) - Overall Risk: {report.overall_risk.value})")
    table.add_column("Resource Address", style="cyan")
    table.add_column("Action", style="magenta")
    table.add_column("Attribute", style="yellow")
    table.add_column("Desired (Git)", style="green")
    table.add_column("Actual (Live AWS)", style="red")
    table.add_column("Risk", style="bold red" if report.overall_risk == RiskLevel.CRITICAL else "bold yellow")

    for r in report.resources:
        for d in r.differences:
            table.add_row(r.address, ", ".join(r.actions), d.attribute, str(d.desired), str(d.actual), r.risk.value)
        if not r.differences:
            table.add_row(r.address, ", ".join(r.actions), "[N/A]", "[None]", "[None]", r.risk.value)

    console.print(table)

    if output_report_path:
        output_report_path.write_text(json.dumps(report.model_dump(), indent=2), encoding="utf-8")
        console.print(f"[dim]Saved report to {output_report_path}[/dim]")

    # 2. AI Reasoning & Patch Generation
    console.print("\n[bold green]>>> Stage 3: LLM Reasoning & Candidate Remediation Proposal[/bold green]")
    provider = llm_provider or Config.LLM_PROVIDER
    analyzer = LLMAnalyzer(provider=provider)

    # Read relevant Terraform code if available
    relevant_hcl = ""
    main_tf = Config.TERRAFORM_DIR / "main.tf"
    if main_tf.exists():
        relevant_hcl = main_tf.read_text(encoding="utf-8")

    proposal = analyzer.analyze_drift(report, relevant_terraform_code=relevant_hcl)

    console.print(Panel(
        f"[bold]Summary:[/bold] {proposal.summary}\n\n"
        f"[bold]Root Cause Hypothesis:[/bold] {proposal.root_cause_hypothesis}\n\n"
        f"[bold]Recommended Action:[/bold] {proposal.recommended_action}\n\n"
        f"[bold]AI Risk Assessment:[/bold] {proposal.risk.value} (Confidence: {proposal.confidence:.0%})\n"
        f"[bold]Status:[/bold] {proposal.status.value}",
        title="AI Remediation Proposal",
        border_style="yellow" if proposal.risk != RiskLevel.CRITICAL else "red"
    ))

    # 3. Patch Application in Isolated Sandbox
    console.print("\n[bold green]>>> Stage 4: Staging Candidate Patch in Isolated Sandbox[/bold green]")
    patch_gen = PatchGenerator()
    temp_workspace = patch_gen.create_isolated_workspace()

    try:
        modified_files = patch_gen.apply_proposal_to_workspace(temp_workspace, proposal)
        console.print(f"[dim]Applied candidate modifications to {len(modified_files)} file(s) in sandbox.[/dim]")

        # 4. Deterministic Validation & Destructive Guardrails
        console.print("\n[bold green]>>> Stage 5: Deterministic Terraform Validation & Guardrail Checks[/bold green]")
        validator = TerraformValidator()
        val_result = validator.validate_workspace(temp_workspace, proposal=proposal)

        val_table = Table(title="Deterministic Validation Results")
        val_table.add_column("Check", style="cyan")
        val_table.add_column("Status", style="bold")
        val_table.add_row("terraform fmt", "[green]PASS[/green]" if val_result.format_pass else "[red]FAIL[/red]")
        val_table.add_row("terraform validate", "[green]PASS[/green]" if val_result.validate_pass else "[red]FAIL[/red]")
        val_table.add_row("terraform plan", "[green]PASS[/green]" if val_result.plan_pass else "[red]FAIL[/red]")
        val_table.add_row("Unexpected Destroy", "[red]YES (BLOCKED)[/red]" if val_result.unexpected_destroy else "[green]NO[/green]")
        console.print(val_table)

        if not val_result.is_valid:
            console.print("[bold red][X] Validation Failed. Aborting PR creation to protect infrastructure.[/bold red]")
            for err in val_result.errors:
                console.print(f"  [red]* {err}[/red]")
            return 1

        # 5. GitHub PR Creation & Duplicate Suppression
        console.print("\n[bold green]>>> Stage 6: GitHub Pull Request Automation[/bold green]")
        gh_manager = GitHubManager()
        pr_result = gh_manager.create_or_update_pr(report, proposal, val_result, dry_run=dry_run)

        if pr_result["action"] == "SUPPRESSED_DUPLICATE":
            console.print(f"[bold yellow][!] Duplicate PR Suppressed:[/bold yellow] An open PR already exists for fingerprint `[{report.fingerprint}]` -> {pr_result['pr_url']}")
        else:
            console.print(f"[bold green][OK] Pull Request Ready for Human Review:[/bold green] {pr_result['pr_url']}")

        console.print(Panel(
            pr_result["body"],
            title="Generated Pull Request Body",
            border_style="blue"
        ))

        console.print("\n[bold cyan][OK] MERIDIAN pipeline executed successfully. Waiting for human engineer review.[/bold cyan]")
        return 0

    finally:
        patch_gen.cleanup_workspace(temp_workspace)



def main():
    parser = argparse.ArgumentParser(description="MERIDIAN - AI-Assisted Terraform Drift Detection & Remediation")
    parser.add_argument("--plan-json", type=Path, help="Path to input terraform show -json file")
    parser.add_argument("--dry-run", action="store_true", default=True, help="Simulate PR creation without modifying remote repo")
    parser.add_argument("--llm-provider", choices=["gemini", "openai", "mock"], default="mock", help="AI provider (gemini, openai, mock)")
    parser.add_argument("--output-report", type=Path, help="Path to write output drift report JSON")

    args = parser.parse_args()
    Config.ensure_directories()
    exit_code = run_pipeline(
        plan_json_path=args.plan_json,
        dry_run=args.dry_run,
        llm_provider=args.llm_provider,
        output_report_path=args.output_report,
    )
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
