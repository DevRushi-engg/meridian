"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Cpu,
  ExternalLink,
  FileCode,
  Flame,
  GitBranch,
  GitPullRequest,
  Hash,
  Shield,
  ShieldAlert,
  Terminal,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { fetchReport } from "@/lib/api";
import { PipelineRunRecord } from "@/lib/types";

export default function ReportDetailPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center font-mono text-xs text-[#71717a]">Loading debrief...</div>}>
      <ReportDetailPageContent />
    </Suspense>
  );
}

function ReportDetailPageContent() {
  const params = useParams();
  const router = useRouter();
  const runId = params.id as string;

  const [record, setRecord] = useState<PipelineRunRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!runId) return;
    fetchReport(runId)
      .then((data) => setRecord(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [runId]);

  if (loading) {
    return (
      <div className="flex-1 p-8 text-center font-mono text-xs text-[#71717a]">
        Retrieving tactical debrief telemetry for [{runId}]...
      </div>
    );
  }

  if (error || !record) {
    return (
      <div className="flex-1 p-8 max-w-2xl mx-auto font-mono text-xs space-y-4">
        <div className="p-4 bg-[#1a0a0a] border border-[#e61919] text-[#ff4d4d]">
          Failed to load report debrief: {error || "Record not found"}
        </div>
        <Link
          href="/reports"
          className="text-[#3b82f6] hover:underline flex items-center gap-1.5"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to Audit Archive</span>
        </Link>
      </div>
    );
  }

  const { drift_report, proposal, validation, pr_result } = record;

  return (
    <div className="flex-1 p-4 lg:p-8 max-w-[1600px] w-full mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
        <div>
          <Link
            href="/reports"
            className="text-[10px] font-mono tracking-[0.15em] text-[#71717a] hover:text-white flex items-center gap-1.5 uppercase transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            BACK TO AUDIT ARCHIVE
          </Link>
          <h1 className="text-xl lg:text-2xl font-mono font-bold tracking-tight text-white flex items-center gap-2 mt-1">
            <span className="w-2 h-5 bg-[#e61919]" />
            DRIFT DEBRIEF: {record.id}
          </h1>
          <div className="flex items-center gap-3 mt-1.5 text-xs font-mono text-[#888891]">
            <span>PLAN: {record.plan_name}</span>
            <span>|</span>
            <span>PROVIDER: {record.llm_provider.toUpperCase()}</span>
            <span>|</span>
            <span>FINGERPRINT: {drift_report?.fingerprint || "none"}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge status={record.status} size="md">
            {record.status}
          </Badge>
          {drift_report && (
            <Badge variant="risk" risk={drift_report.overall_risk} size="md">
              {drift_report.overall_risk}
            </Badge>
          )}
        </div>
      </div>

      {/* Main 2-Column Debrief Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Proposal & Diff Viewer (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {/* AI Remediation Proposal Card */}
          {proposal && (
            <div className="tactical-panel p-5 space-y-4 border-t-2 border-t-[#f59e0b]">
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-[#f59e0b]" />
                  <h2 className="text-xs font-mono font-bold tracking-[0.15em] uppercase text-white">
                    STAGE 3: AI REMEDIATION PROPOSAL
                  </h2>
                </div>
                <div className="flex items-center gap-2 font-mono text-xs">
                  <span className="text-[#71717a]">CONFIDENCE:</span>
                  <span className="text-white font-bold">
                    {Math.round(proposal.confidence * 100)}%
                  </span>
                </div>
              </div>

              <div className="space-y-3 font-mono text-xs leading-relaxed">
                <div>
                  <span className="text-[10px] text-[#71717a] block uppercase font-bold">
                    SUMMARY
                  </span>
                  <p className="text-white mt-0.5">{proposal.summary}</p>
                </div>

                <div>
                  <span className="text-[10px] text-[#71717a] block uppercase font-bold">
                    ROOT CAUSE HYPOTHESIS
                  </span>
                  <p className="text-[#a1a1aa] mt-0.5">
                    {proposal.root_cause_hypothesis}
                  </p>
                </div>

                <div>
                  <span className="text-[10px] text-[#71717a] block uppercase font-bold">
                    RECOMMENDED HUMAN ACTION
                  </span>
                  <p className="text-[#fcd34d] mt-0.5">
                    {proposal.recommended_action}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Unified Diff Viewer */}
          <div className="tactical-panel">
            <div className="p-3 border-b border-white/[0.08] bg-[#0c0c0e] flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-[#3b82f6]" />
                <span className="font-bold text-white tracking-wider">
                  CANDIDATE HCL REMEDIATION PATCH
                </span>
              </div>
              <span className="text-[10px] text-[#71717a]">
                TARGET: {proposal?.files_to_modify.join(", ") || "terraform/main.tf"}
              </span>
            </div>

            <div className="p-4 bg-[#050505] font-mono text-xs overflow-x-auto leading-relaxed">
              {proposal?.patch ? (
                proposal.patch.split("\n").map((line, idx) => {
                  let lineStyle = "text-[#888891]";
                  let bgStyle = "";
                  if (line.startsWith("+") && !line.startsWith("+++")) {
                    lineStyle = "text-[#4ade80]";
                    bgStyle = "bg-[#22c55e]/10";
                  } else if (line.startsWith("-") && !line.startsWith("---")) {
                    lineStyle = "text-[#ff6666]";
                    bgStyle = "bg-[#e61919]/10";
                  } else if (line.startsWith("@@")) {
                    lineStyle = "text-[#60a5fa]";
                  }

                  return (
                    <div
                      key={idx}
                      className={`flex items-start gap-3 px-2 py-0.5 ${bgStyle}`}
                    >
                      <span className="text-[#52525b] select-none text-[10px] w-6 text-right">
                        {idx + 1}
                      </span>
                      <pre className={`${lineStyle} m-0 font-mono`}>{line}</pre>
                    </div>
                  );
                })
              ) : (
                <div className="text-[#71717a] italic">
                  No code changes required or patch generated.
                </div>
              )}
            </div>
          </div>

          {/* Detected Resource Differences Table */}
          {drift_report && drift_report.resources.length > 0 && (
            <div className="tactical-panel">
              <div className="p-3 border-b border-white/[0.08] bg-[#0c0c0e] flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-[#e61919]" />
                  <span className="font-bold text-white tracking-wider">
                    RESOURCE DISCREPANCIES ({drift_report.resources.length})
                  </span>
                </div>
                <span className="text-[10px] text-[#71717a]">
                  STATE COMPARISON
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs font-mono">
                  <thead>
                    <tr className="border-b border-white/[0.08] bg-[#08080a] text-[#71717a] text-[10px] uppercase">
                      <th className="py-2 px-3">ADDRESS</th>
                      <th className="py-2 px-3">ACTIONS</th>
                      <th className="py-2 px-3">ATTRIBUTE</th>
                      <th className="py-2 px-3">GIT DESIRED</th>
                      <th className="py-2 px-3">LIVE CLOUD</th>
                      <th className="py-2 px-3 text-right">RISK</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {drift_report.resources.map((res, i) => (
                      <tr key={i} className="hover:bg-white/[0.02]">
                        <td className="py-2.5 px-3 font-semibold text-white">
                          {res.address}
                        </td>
                        <td className="py-2.5 px-3 uppercase text-[#a1a1aa]">
                          {res.actions.join(", ")}
                        </td>
                        <td className="py-2.5 px-3 text-[#f59e0b]">
                          {res.differences[0]?.attribute || "all"}
                        </td>
                        <td className="py-2.5 px-3 text-[#22c55e]">
                          {res.differences[0] ? String(res.differences[0].desired) : "-"}
                        </td>
                        <td className="py-2.5 px-3 text-[#ff4d4d]">
                          {res.differences[0] ? String(res.differences[0].actual) : "-"}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <Badge variant="risk" risk={res.risk} size="sm">
                            {res.risk}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Guardrails & PR Results (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Validation Checklist */}
          {validation && (
            <div className="tactical-panel p-5 space-y-4">
              <div className="flex items-center gap-2 border-b border-white/[0.08] pb-3">
                <Shield className="w-4 h-4 text-[#22c55e]" />
                <h3 className="text-xs font-mono font-bold tracking-[0.15em] uppercase text-white">
                  STAGE 5: DETERMINISTIC GUARDRAILS
                </h3>
              </div>

              <div className="space-y-2 font-mono text-xs">
                <div className="flex items-center justify-between p-2.5 bg-[#0a0a0c] border border-white/5">
                  <span className="text-[#a1a1aa]">terraform fmt</span>
                  <span
                    className={
                      validation.format_pass
                        ? "text-[#22c55e] font-bold"
                        : "text-[#e61919] font-bold"
                    }
                  >
                    {validation.format_pass ? "PASS" : "FAIL"}
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 bg-[#0a0a0c] border border-white/5">
                  <span className="text-[#a1a1aa]">terraform validate</span>
                  <span
                    className={
                      validation.validate_pass
                        ? "text-[#22c55e] font-bold"
                        : "text-[#e61919] font-bold"
                    }
                  >
                    {validation.validate_pass ? "PASS" : "FAIL"}
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 bg-[#0a0a0c] border border-white/5">
                  <span className="text-[#a1a1aa]">terraform plan</span>
                  <span
                    className={
                      validation.plan_pass
                        ? "text-[#22c55e] font-bold"
                        : "text-[#e61919] font-bold"
                    }
                  >
                    {validation.plan_pass ? "PASS" : "FAIL"}
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 bg-[#0a0a0c] border border-white/5">
                  <span className="text-[#a1a1aa]">Unexpected Destroy Check</span>
                  <span
                    className={
                      validation.unexpected_destroy
                        ? "text-[#e61919] font-bold"
                        : "text-[#22c55e] font-bold"
                    }
                  >
                    {validation.unexpected_destroy ? "BLOCKED" : "SAFE"}
                  </span>
                </div>
              </div>

              {validation.errors && validation.errors.length > 0 && (
                <div className="p-3 bg-[#1a0a0a] border border-[#e61919]/40 text-[#ff6666] text-xs font-mono space-y-1">
                  <span className="font-bold block uppercase text-[10px]">
                    GUARDRAIL VIOLATIONS:
                  </span>
                  {validation.errors.map((err, i) => (
                    <div key={i}>* {err}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Pull Request Card */}
          {pr_result && (
            <div className="tactical-panel p-5 space-y-4 border-t-2 border-t-[#3b82f6]">
              <div className="flex items-center gap-2 border-b border-white/[0.08] pb-3">
                <GitPullRequest className="w-4 h-4 text-[#3b82f6]" />
                <h3 className="text-xs font-mono font-bold tracking-[0.15em] uppercase text-white">
                  STAGE 6: GITHUB PULL REQUEST
                </h3>
              </div>

              <div className="space-y-3 font-mono text-xs">
                <div>
                  <span className="text-[10px] text-[#71717a] block uppercase">ACTION</span>
                  <span className="text-white font-bold">{pr_result.action}</span>
                </div>

                <div>
                  <span className="text-[10px] text-[#71717a] block uppercase">PULL REQUEST LINK</span>
                  <a
                    href={pr_result.pr_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#3b82f6] hover:underline flex items-center gap-1.5 break-all mt-0.5"
                  >
                    <span>{pr_result.pr_url}</span>
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  </a>
                </div>

                <div>
                  <span className="text-[10px] text-[#71717a] block uppercase">TARGET BRANCH</span>
                  <span className="text-[#a1a1aa]">{pr_result.branch}</span>
                </div>

                <div className="pt-2 border-t border-white/[0.08]">
                  <span className="text-[10px] text-[#71717a] block uppercase mb-1">PR BODY PREVIEW</span>
                  <pre className="p-2.5 bg-black/60 border border-white/5 text-[10px] text-[#888891] overflow-x-auto max-h-40">
                    {pr_result.body}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* Execution Log Snippet */}
          <div className="tactical-panel p-5 space-y-3">
            <div className="flex items-center gap-2 border-b border-white/[0.08] pb-2">
              <Terminal className="w-4 h-4 text-[#71717a]" />
              <h3 className="text-xs font-mono font-bold tracking-[0.15em] uppercase text-white">
                AUDIT LOG TRAIL
              </h3>
            </div>
            <div className="space-y-1 font-mono text-[10px] text-[#888891] max-h-48 overflow-y-auto">
              {record.logs && record.logs.length > 0 ? (
                record.logs.map((log, idx) => (
                  <div key={idx} className="flex items-start gap-1.5">
                    <span className="text-[#52525b]">&gt;</span>
                    <span className="text-[#a1a1aa]">{log}</span>
                  </div>
                ))
              ) : (
                <div className="text-[#52525b] italic">No log entries attached.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
