"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  ExternalLink,
  Flame,
  GitPullRequest,
  Layers,
  Play,
  RefreshCw,
  ShieldAlert,
  Terminal,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { StatusDot } from "@/components/ui/StatusDot";
import {
  fetchReports,
  fetchStats,
  fetchFixtures,
  triggerPipelineRun,
} from "@/lib/api";
import {
  PipelineRunRecord,
  SystemStats,
  FixtureInfo,
  ResourceDrift,
} from "@/lib/types";

export default function DashboardPage() {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [reports, setReports] = useState<PipelineRunRecord[]>([]);
  const [fixtures, setFixtures] = useState<FixtureInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFixture, setSelectedFixture] = useState<string>("update_plan.json");
  const [quickRunning, setQuickRunning] = useState(false);
  const [quickMessage, setQuickMessage] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [statsData, reportsData, fixturesData] = await Promise.all([
        fetchStats().catch(() => null),
        fetchReports().catch(() => []),
        fetchFixtures().catch(() => []),
      ]);
      setStats(statsData);
      setReports(reportsData);
      setFixtures(fixturesData);
    } catch (err) {
      console.error("Dashboard load failed", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 12000);
    return () => clearInterval(interval);
  }, []);

  const handleQuickRun = async (fixtureName: string) => {
    setQuickRunning(true);
    setQuickMessage(`Deploying IaC Sentinal 6-stage telemetry for ${fixtureName}...`);
    try {
      const run = await triggerPipelineRun({
        fixture_name: fixtureName,
        llm_provider: "mock",
        dry_run: true,
      });
      setQuickMessage(`Pipeline run initiated: [${run.id}]. Polling stages...`);
      // Refresh reports after delay
      setTimeout(() => {
        loadData();
        setQuickRunning(false);
      }, 2500);
    } catch (err: any) {
      setQuickMessage(`Error: ${err.message}`);
      setQuickRunning(false);
    }
  };

  // Extract latest drifted resources
  const latestRun = reports[0];
  const hasDrift = latestRun?.drift_report?.has_drift ?? true;
  const driftedResources: ResourceDrift[] = reports.flatMap((r) =>
    r.drift_report?.resources ? r.drift_report.resources : []
  ).slice(0, 8);

  const criticalViolations = reports.filter(
    (r) => r.drift_report?.overall_risk === "CRITICAL"
  ).length;

  return (
    <div className="flex-1 space-y-6 p-4 lg:p-8 max-w-[1600px] w-full mx-auto">
      {/* Top Banner / System Status Beacon */}
      <div
        className={`tactical-panel p-4 border-l-4 ${
          hasDrift
            ? "border-l-[#e61919] bg-[#140a0a]"
            : "border-l-[#22c55e] bg-[#0a140a]"
        } flex flex-col md:flex-row items-start md:items-center justify-between gap-4`}
      >
        <div className="flex items-center gap-3.5">
          <div className="relative">
            <StatusDot
              color={hasDrift ? "red" : "green"}
              size="lg"
              pulse={true}
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs tracking-[0.2em] uppercase font-bold text-white">
                {hasDrift
                  ? "TELEMETRY STATUS: OUT-OF-BAND DRIFT DETECTED"
                  : "TELEMETRY STATUS: ALL LIVE ASSETS SYNCHRONIZED"}
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 bg-white/10 text-white/70">
                ACTIVE RECONCILIATION
              </span>
            </div>
            <p className="text-xs text-[#888891] mt-0.5 font-mono">
              {hasDrift
                ? "Live cloud configurations differ from version-controlled desired state. Reconcile with human-in-the-loop validation."
                : "Zero discrepancies identified between current Git Terraform manifests and live infrastructure."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setRefreshing(true);
              loadData();
            }}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1a1a1a] hover:bg-[#222222] border border-white/10 text-xs font-mono text-[#a1a1aa] hover:text-white transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            <span>SYNC TELEMETRY</span>
          </button>
          <Link
            href="/pipeline"
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#e61919] hover:bg-[#c91414] text-white text-xs font-mono font-semibold tracking-wider transition-colors shadow-[0_0_15px_rgba(230,25,25,0.3)]"
          >
            <Play className="w-3.5 h-3.5" />
            <span>TRIGGER RECONCILIATION</span>
          </Link>
        </div>
      </div>

      {/* Bento Grid: Telemetry Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="tactical-panel p-5">
          <div className="flex items-center justify-between text-xs font-mono text-[#71717a] tracking-wider uppercase">
            <span>AUDITS EXECUTED</span>
            <Activity className="w-4 h-4 text-[#71717a]" />
          </div>
          <div className="mt-3 font-mono text-3xl font-bold tracking-tight text-white">
            {stats ? stats.total_runs : reports.length || 0}
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[11px] font-mono text-[#888891]">
            <Clock className="w-3 h-3 text-[#22c55e]" />
            <span>Continuous drift detection active</span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="tactical-panel p-5">
          <div className="flex items-center justify-between text-xs font-mono text-[#71717a] tracking-wider uppercase">
            <span>DRIFTED ASSETS</span>
            <Flame className="w-4 h-4 text-[#f59e0b]" />
          </div>
          <div className="mt-3 font-mono text-3xl font-bold tracking-tight text-[#f59e0b]">
            {stats ? stats.total_drift_detected : 4}
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[11px] font-mono text-[#888891]">
            <span className="w-1.5 h-1.5 bg-[#f59e0b]" />
            <span>Live cloud state divergent from Git</span>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="tactical-panel p-5 border-t-2 border-t-[#e61919]">
          <div className="flex items-center justify-between text-xs font-mono text-[#71717a] tracking-wider uppercase">
            <span>CRITICAL BLOCKS</span>
            <AlertTriangle className="w-4 h-4 text-[#e61919]" />
          </div>
          <div className="mt-3 font-mono text-3xl font-bold tracking-tight text-[#e61919]">
            {stats ? stats.critical_risks : criticalViolations}
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[11px] font-mono text-[#ff6666]">
            <span className="w-1.5 h-1.5 bg-[#e61919] animate-pulse" />
            <span>Destructive drops quarantined</span>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="tactical-panel p-5">
          <div className="flex items-center justify-between text-xs font-mono text-[#71717a] tracking-wider uppercase">
            <span>SYNTHESIZED PRS</span>
            <GitPullRequest className="w-4 h-4 text-[#22c55e]" />
          </div>
          <div className="mt-3 font-mono text-3xl font-bold tracking-tight text-[#22c55e]">
            {stats ? stats.prs_generated : reports.filter((r) => r.pr_result).length}
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[11px] font-mono text-[#888891]">
            <CheckCircle2 className="w-3 h-3 text-[#22c55e]" />
            <span>Human-approved pull requests</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Telemetry Stream + Quick Runner */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Live Drift Telemetry Stream (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          <div className="tactical-panel">
            {/* Header */}
            <div className="p-4 border-b border-white/[0.08] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-[#e61919]" />
                <h2 className="text-xs font-mono font-bold tracking-[0.15em] uppercase text-white">
                  DETECTED INFRASTRUCTURE DISCREPANCIES
                </h2>
              </div>
              <span className="text-[10px] font-mono text-[#71717a]">
                REAL-TIME AUDIT STREAM
              </span>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs font-mono">
                <thead>
                  <tr className="border-b border-white/[0.08] bg-[#0c0c0e] text-[#71717a] text-[10px] tracking-wider uppercase">
                    <th className="py-2.5 px-4">RESOURCE ADDRESS</th>
                    <th className="py-2.5 px-3">ACTION</th>
                    <th className="py-2.5 px-3">ATTRIBUTE</th>
                    <th className="py-2.5 px-3">GIT DESIRED</th>
                    <th className="py-2.5 px-3">LIVE CLOUD</th>
                    <th className="py-2.5 px-4 text-right">RISK LEVEL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {driftedResources.length > 0 ? (
                    driftedResources.map((res, idx) => {
                      const diff = res.differences[0];
                      return (
                        <tr
                          key={`${res.address}-${idx}`}
                          className="hover:bg-white/[0.02] transition-colors"
                        >
                          <td className="py-3 px-4 font-semibold text-[#eaeaea] flex items-center gap-2">
                            <span className="w-1 h-3 bg-[#e61919]" />
                            <span className="truncate max-w-[220px]" title={res.address}>
                              {res.address}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <span className="px-1.5 py-0.5 bg-white/5 border border-white/10 text-[10px] text-[#a1a1aa] uppercase">
                              {res.actions.join(", ")}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-[#f59e0b] font-medium">
                            {diff ? diff.attribute : "resource_definition"}
                          </td>
                          <td className="py-3 px-3 text-[#22c55e] truncate max-w-[120px]">
                            {diff ? String(diff.desired) : "exist"}
                          </td>
                          <td className="py-3 px-3 text-[#ff4d4d] truncate max-w-[120px]">
                            {diff ? String(diff.actual) : "drifted"}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <Badge variant="risk" risk={res.risk}>
                              {res.risk}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-[#71717a]">
                        No active drift detected. Infrastructure matches desired state.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer action */}
            <div className="p-3 border-t border-white/[0.08] bg-[#0c0c0e] flex items-center justify-between text-xs font-mono">
              <span className="text-[#71717a]">
                Showing {driftedResources.length} out-of-band drift signals
              </span>
              <Link
                href="/reports"
                className="text-[#eaeaea] hover:text-[#e61919] flex items-center gap-1 transition-colors"
              >
                <span>VIEW COMPLETE DEBRIEF HISTORY</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Historical Pipeline Runs Feed */}
          <div className="tactical-panel">
            <div className="p-4 border-b border-white/[0.08] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#3b82f6]" />
                <h2 className="text-xs font-mono font-bold tracking-[0.15em] uppercase text-white">
                  RECENT RECONCILIATION RUNS
                </h2>
              </div>
              <Link
                href="/reports"
                className="text-[10px] font-mono text-[#888891] hover:text-white flex items-center gap-1"
              >
                <span>ALL RUNS</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>

            <div className="divide-y divide-white/[0.04]">
              {reports.slice(0, 4).map((run) => (
                <div
                  key={run.id}
                  className="p-4 hover:bg-white/[0.02] transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      <span className="text-white font-bold">{run.id}</span>
                      <span className="text-[#71717a]">/</span>
                      <span className="text-[#a1a1aa]">{run.plan_name}</span>
                      <Badge status={run.status}>{run.status}</Badge>
                      {run.drift_report && (
                        <Badge variant="risk" risk={run.drift_report.overall_risk}>
                          {run.drift_report.overall_risk}
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-[#71717a]">
                      {run.proposal?.summary ||
                        `Audit completed for ${run.plan_name}. ${
                          run.drift_report?.total_resources_drifted || 0
                        } resource drift detected.`}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-[#52525b]">
                      {new Date(run.created_at).toLocaleTimeString()}
                    </span>
                    <Link
                      href={`/reports/${run.id}`}
                      className="px-2.5 py-1 bg-[#1a1a1a] hover:bg-[#262626] border border-white/10 text-white text-[11px] transition-colors"
                    >
                      INSPECT DEBRIEF
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Tactical Mission Launch Pad (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Quick Launch Pad */}
          <div className="tactical-panel p-5 space-y-5 border-t-2 border-t-[#e61919]">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-[#e61919]" />
                <h3 className="text-xs font-mono font-bold tracking-[0.15em] uppercase text-white">
                  TACTICAL LAUNCH PAD
                </h3>
              </div>
              <span className="text-[10px] font-mono px-1.5 py-0.5 bg-[#e61919]/20 text-[#ff4d4d]">
                6-STAGE RUNNER
              </span>
            </div>

            <p className="text-xs font-mono text-[#888891] leading-relaxed">
              Select a Terraform plan scenario or fixture to run the complete
              deterministic remediation pipeline.
            </p>

            {/* Fixture Selector */}
            <div className="space-y-2">
              <label className="text-[10px] font-mono uppercase tracking-wider text-[#71717a]">
                SELECT SIMULATION FIXTURE
              </label>
              <div className="space-y-2">
                {[
                  {
                    name: "update_plan.json",
                    label: "S3 Bucket Attribute Drift",
                    risk: "LOW" as const,
                  },
                  {
                    name: "replace_plan.json",
                    label: "RDS Security Group Replacement",
                    risk: "CRITICAL" as const,
                  },
                  {
                    name: "multiple_changes_plan.json",
                    label: "Multi-Service Production Drift",
                    risk: "HIGH" as const,
                  },
                  {
                    name: "delete_plan.json",
                    label: "IAM Role Unauthorized Deletion",
                    risk: "CRITICAL" as const,
                  },
                  {
                    name: "no_drift_plan.json",
                    label: "Clean Synchronized State",
                    risk: "LOW" as const,
                  },
                ].map((item) => (
                  <button
                    key={item.name}
                    onClick={() => setSelectedFixture(item.name)}
                    className={`w-full p-2.5 text-left border font-mono text-xs transition-all flex items-center justify-between ${
                      selectedFixture === item.name
                        ? "bg-[#1f1f23] border-white/30 text-white"
                        : "bg-[#141414] border-white/5 text-[#888891] hover:border-white/20 hover:text-white"
                    }`}
                  >
                    <div>
                      <div className="font-semibold text-white">{item.label}</div>
                      <div className="text-[10px] text-[#71717a]">{item.name}</div>
                    </div>
                    <Badge variant="risk" risk={item.risk}>
                      {item.risk}
                    </Badge>
                  </button>
                ))}
              </div>
            </div>

            {/* Execute Button */}
            <div className="pt-2">
              <button
                onClick={() => handleQuickRun(selectedFixture)}
                disabled={quickRunning}
                className="w-full py-2.5 bg-[#e61919] hover:bg-[#c91414] disabled:opacity-50 text-white font-mono text-xs font-bold tracking-[0.15em] uppercase transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(230,25,25,0.3)]"
              >
                <Play className={`w-3.5 h-3.5 ${quickRunning ? "animate-spin" : ""}`} />
                <span>{quickRunning ? "EXECUTING RECONCILIATION..." : "LAUNCH PIPELINE RECONCILIATION"}</span>
              </button>

              {quickMessage && (
                <div className="mt-3 p-2.5 bg-black/60 border border-white/10 text-[11px] font-mono text-[#a1a1aa]">
                  {quickMessage}
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-white/[0.08]">
              <Link
                href="/pipeline"
                className="text-xs font-mono text-[#3b82f6] hover:underline flex items-center justify-between"
              >
                <span>OPEN FULL INTERACTIVE PIPELINE RUNNER</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* System Guardrails Status Card */}
          <div className="tactical-panel p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-white/[0.08] pb-3">
              <CheckCircle2 className="w-4 h-4 text-[#22c55e]" />
              <h3 className="text-xs font-mono font-bold tracking-[0.15em] uppercase text-white">
                DETERMINISTIC GUARDRAILS
              </h3>
            </div>

            <div className="space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between p-2 bg-[#0c0c0e] border border-white/5">
                <span className="text-[#a1a1aa]">1. TERRAFORM FORMAT</span>
                <span className="text-[#22c55e] font-bold">ENFORCED</span>
              </div>
              <div className="flex items-center justify-between p-2 bg-[#0c0c0e] border border-white/5">
                <span className="text-[#a1a1aa]">2. SYNTAX VALIDATION</span>
                <span className="text-[#22c55e] font-bold">ENFORCED</span>
              </div>
              <div className="flex items-center justify-between p-2 bg-[#0c0c0e] border border-white/5">
                <span className="text-[#a1a1aa]">3. ISOLATED WORKSPACE</span>
                <span className="text-[#22c55e] font-bold">EPHEMERAL</span>
              </div>
              <div className="flex items-center justify-between p-2 bg-[#0c0c0e] border border-white/5">
                <span className="text-[#a1a1aa]">4. DESTRUCTION BLOCK</span>
                <span className="text-[#e61919] font-bold">STRICT (NO-DELETE)</span>
              </div>
              <div className="flex items-center justify-between p-2 bg-[#0c0c0e] border border-white/5">
                <span className="text-[#a1a1aa]">5. HUMAN APPROVAL</span>
                <span className="text-[#f59e0b] font-bold">REQUIRED</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
