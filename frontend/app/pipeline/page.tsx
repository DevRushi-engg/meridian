"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileCode,
  GitPullRequest,
  Loader2,
  Play,
  RotateCcw,
  Shield,
  ShieldAlert,
  Terminal,
  UploadCloud,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { StatusDot } from "@/components/ui/StatusDot";
import {
  triggerPipelineRun,
  uploadPlanFile,
  fetchFixtures,
} from "@/lib/api";
import { FixtureInfo, PipelineRunRecord, StageUpdatePayload } from "@/lib/types";

const STAGES = [
  { id: 1, name: "Plan Ingestion", desc: "Parse terraform show -json payload and evaluate resource changes" },
  { id: 2, name: "Risk Scoring", desc: "Deterministic risk evaluation matrix and SHA256 idempotency fingerprint" },
  { id: 3, name: "AI Reasoning", desc: "LLM synthesis of root cause hypothesis and unified HCL patch" },
  { id: 4, name: "Sandbox Staging", desc: "Ephemeral sandbox provisioning and candidate patch staging" },
  { id: 5, name: "Deterministic Validation", desc: "terraform fmt, validate, plan, and destructive guardrails check" },
  { id: 6, name: "GitHub Automation", desc: "Idempotent branch checkout, commit, and Pull Request creation" },
];

export default function PipelineRunnerPage() {
  const [fixtures, setFixtures] = useState<FixtureInfo[]>([]);
  const [selectedFixture, setSelectedFixture] = useState<string>("update_plan.json");
  const [uploadedPlan, setUploadedPlan] = useState<any | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [llmProvider, setLlmProvider] = useState<string>("mock");
  const [dryRun, setDryRun] = useState<boolean>(true);

  // Execution state
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [currentStage, setCurrentStage] = useState<number>(0);
  const [stageStatuses, setStageStatuses] = useState<Record<number, "pending" | "running" | "completed" | "failed">>({
    1: "pending",
    2: "pending",
    3: "pending",
    4: "pending",
    5: "pending",
    6: "pending",
  });
  const [stageMessages, setStageMessages] = useState<Record<number, string>>({});
  const [logs, setLogs] = useState<string[]>([]);
  const [finalRecord, setFinalRecord] = useState<PipelineRunRecord | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const terminalBottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetchFixtures()
      .then((data) => setFixtures(data))
      .catch((err) => console.error("Failed to load fixtures", err));
  }, []);

  useEffect(() => {
    if (terminalBottomRef.current) {
      terminalBottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await uploadPlanFile(file);
      setUploadedPlan(data.plan_content);
      setUploadedFileName(file.name);
      setSelectedFixture(""); // Clear preset fixture
      setLogs((prev) => [...prev, `[INFO] Uploaded custom plan: ${file.name} (${data.size} bytes)`]);
    } catch (err: any) {
      alert(`Upload error: ${err.message}`);
    }
  };

  const startPipeline = async () => {
    setIsRunning(true);
    setCurrentStage(1);
    setFinalRecord(null);
    setStageStatuses({
      1: "running",
      2: "pending",
      3: "pending",
      4: "pending",
      5: "pending",
      6: "pending",
    });
    setStageMessages({});
    setLogs([
      `[INIT] Launching IaC Sentinal remediation loop at ${new Date().toISOString()}`,
      `[CONFIG] AI Provider: ${llmProvider} | Dry Run: ${dryRun}`,
      `[INPUT] Plan Target: ${uploadedFileName || selectedFixture}`,
    ]);

    try {
      const record = await triggerPipelineRun({
        fixture_name: uploadedPlan ? undefined : selectedFixture,
        plan_content: uploadedPlan || undefined,
        llm_provider: llmProvider,
        dry_run: dryRun,
      });

      setActiveRunId(record.id);
      setFinalRecord(record);

      // Connect to WebSocket for live updates
      const wsUrl = `ws://localhost:8000/ws/pipeline/${record.id}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data) as StageUpdatePayload;
          const stageNum = payload.stage;

          if (stageNum > 0) {
            setCurrentStage(stageNum);
            setStageStatuses((prev) => ({
              ...prev,
              [stageNum]: payload.status as any,
            }));
            setStageMessages((prev) => ({
              ...prev,
              [stageNum]: payload.message,
            }));
          }

          setLogs((prev) => [
            ...prev,
            `[${payload.status.toUpperCase()}] Stage ${payload.stage} (${payload.stage_name}): ${payload.message}`,
          ]);

          if (stageNum === 6 && payload.status === "completed") {
            setIsRunning(false);
          } else if (payload.status === "failed") {
            setIsRunning(false);
          }
        } catch (e) {
          console.error("WS Parse error", e);
        }
      };

      ws.onerror = (e) => {
        console.warn("WebSocket error, falling back to polling", e);
      };

      ws.onclose = () => {
        // Fallback fetch final record if needed
        setTimeout(async () => {
          try {
            const res = await fetch(`http://localhost:8000/api/pipeline/runs/${record.id}`);
            if (res.ok) {
              const full = await res.json();
              setFinalRecord(full);
              setIsRunning(false);
            }
          } catch {}
        }, 3000);
      };
    } catch (err: any) {
      setIsRunning(false);
      setLogs((prev) => [...prev, `[FATAL] Pipeline initialization failed: ${err.message}`]);
    }
  };

  return (
    <div className="flex-1 p-4 lg:p-8 max-w-[1600px] w-full mx-auto space-y-6">
      {/* Top Breadcrumb & Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
        <div>
          <div className="text-[10px] font-mono tracking-[0.2em] text-[#71717a] uppercase">
            OPERATIONS // EXECUTION TERMINAL
          </div>
          <h1 className="text-xl lg:text-2xl font-mono font-bold tracking-tight text-white flex items-center gap-2 mt-1">
            <span className="w-2 h-5 bg-[#e61919]" />
            PIPELINE ORCHESTRATOR
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setIsRunning(false);
              setCurrentStage(0);
              setFinalRecord(null);
              setLogs([]);
            }}
            className="px-3 py-1.5 bg-[#141414] hover:bg-[#1a1a1a] border border-white/10 text-xs font-mono text-[#a1a1aa] flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            RESET TERMINAL
          </button>

          <button
            onClick={startPipeline}
            disabled={isRunning || (!selectedFixture && !uploadedPlan)}
            className="px-5 py-2 bg-[#e61919] hover:bg-[#c91414] disabled:opacity-50 text-white font-mono text-xs font-bold tracking-[0.15em] uppercase flex items-center gap-2 shadow-[0_0_20px_rgba(230,25,25,0.4)] transition-all"
          >
            {isRunning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>EXECUTING STAGES...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                <span>START RECONCILIATION</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Configuration & Input Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Plan Input & Settings (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          {/* Plan Selector */}
          <div className="tactical-panel p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-2 text-xs font-mono">
              <span className="font-bold text-white tracking-wider uppercase">1. TARGET PLAN SOURCE</span>
              <FileCode className="w-4 h-4 text-[#71717a]" />
            </div>

            {/* Presets */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono uppercase text-[#71717a]">BUNDLED FIXTURES</label>
              <div className="space-y-1.5">
                {[
                  { name: "update_plan.json", desc: "S3 Bucket tags out-of-band drift", risk: "LOW" as const },
                  { name: "replace_plan.json", desc: "RDS DB Security group replacement", risk: "CRITICAL" as const },
                  { name: "multiple_changes_plan.json", desc: "Multi-resource enterprise drift", risk: "HIGH" as const },
                  { name: "delete_plan.json", desc: "Unauthorized IAM Role deletion", risk: "CRITICAL" as const },
                  { name: "no_drift_plan.json", desc: "Zero drift clean manifest", risk: "LOW" as const },
                ].map((item) => (
                  <button
                    key={item.name}
                    onClick={() => {
                      setSelectedFixture(item.name);
                      setUploadedPlan(null);
                      setUploadedFileName(null);
                    }}
                    className={`w-full p-2 text-left border font-mono text-xs transition-colors flex items-center justify-between ${
                      selectedFixture === item.name && !uploadedPlan
                        ? "bg-[#1f1f23] border-[#e61919] text-white"
                        : "bg-[#0d0d0f] border-white/5 text-[#888891] hover:border-white/20"
                    }`}
                  >
                    <div>
                      <div className="font-semibold text-white text-[11px]">{item.name}</div>
                      <div className="text-[10px] text-[#71717a]">{item.desc}</div>
                    </div>
                    <Badge variant="risk" risk={item.risk} size="sm">
                      {item.risk}
                    </Badge>
                  </button>
                ))}
              </div>
            </div>

            {/* Upload Custom Plan */}
            <div className="pt-2 border-t border-white/[0.08] space-y-2">
              <label className="text-[10px] font-mono uppercase text-[#71717a]">OR UPLOAD RAW PLAN JSON</label>
              <label className="border border-dashed border-white/20 hover:border-[#e61919] p-3 text-center cursor-pointer block transition-colors bg-[#0a0a0a]">
                <UploadCloud className="w-5 h-5 mx-auto text-[#71717a]" />
                <span className="text-[11px] font-mono text-[#a1a1aa] block mt-1">
                  {uploadedFileName ? `Attached: ${uploadedFileName}` : "Drop terraform plan .json here"}
                </span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Engine Parameters */}
          <div className="tactical-panel p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-2 text-xs font-mono">
              <span className="font-bold text-white tracking-wider uppercase">2. EXECUTION PARAMETERS</span>
              <Shield className="w-4 h-4 text-[#71717a]" />
            </div>

            {/* Provider */}
            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase text-[#71717a]">AI REASONING PROVIDER</label>
              <select
                value={llmProvider}
                onChange={(e) => setLlmProvider(e.target.value)}
                className="w-full bg-[#0d0d0f] border border-white/10 text-white text-xs font-mono p-2 focus:border-[#e61919] outline-none"
              >
                <option value="mock">Deterministic Mock (Instant & High-Fidelity)</option>
                <option value="gemini">Google Gemini 2.5 Flash</option>
                <option value="openai">OpenAI GPT-4o</option>
              </select>
            </div>

            {/* Dry Run Checkbox */}
            <div className="flex items-center justify-between p-2.5 bg-[#0d0d0f] border border-white/5 font-mono text-xs">
              <div>
                <div className="text-white font-medium">SIMULATION / DRY RUN</div>
                <div className="text-[10px] text-[#71717a]">Validate and generate PR without modifying remote git</div>
              </div>
              <input
                type="checkbox"
                checked={dryRun}
                onChange={(e) => setDryRun(e.target.checked)}
                className="w-4 h-4 accent-[#e61919]"
              />
            </div>
          </div>
        </div>

        {/* Right: 6-Stage Progress Pipeline + Telemetry Logs (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          {/* Stages Progression Grid */}
          <div className="tactical-panel p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3 text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-[#e61919]" />
                <span className="font-bold text-white tracking-[0.15em] uppercase">
                  6-STAGE DETERMINISTIC RECONCILIATION LOOP
                </span>
              </div>
              <span className="text-[10px] text-[#71717a]">
                ACTIVE STAGE: {currentStage > 0 ? `${currentStage} OF 6` : "STANDBY"}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {STAGES.map((s) => {
                const status = stageStatuses[s.id];
                const msg = stageMessages[s.id];

                let borderStyle = "border-white/5 bg-[#0e0e11]";
                let icon = <Clock className="w-4 h-4 text-[#52525b]" />;

                if (status === "running") {
                  borderStyle = "border-[#3b82f6] bg-[#0c1626] shadow-[0_0_15px_rgba(59,130,246,0.2)]";
                  icon = <Loader2 className="w-4 h-4 text-[#60a5fa] animate-spin" />;
                } else if (status === "completed") {
                  borderStyle = "border-[#22c55e]/40 bg-[#0a1a0f]";
                  icon = <CheckCircle2 className="w-4 h-4 text-[#22c55e]" />;
                } else if (status === "failed") {
                  borderStyle = "border-[#e61919] bg-[#1a0a0a]";
                  icon = <XCircle className="w-4 h-4 text-[#e61919]" />;
                }

                return (
                  <div
                    key={s.id}
                    className={`p-3.5 border transition-all relative ${borderStyle}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {icon}
                        <span className="font-mono text-xs font-bold text-white tracking-wider">
                          STAGE {s.id}: {s.name.toUpperCase()}
                        </span>
                      </div>
                      <Badge status={status} size="sm">
                        {status}
                      </Badge>
                    </div>

                    <p className="mt-1 text-[11px] font-mono text-[#888891] leading-relaxed">
                      {s.desc}
                    </p>

                    {msg && (
                      <div className="mt-2 text-[10px] font-mono text-[#eaeaea] bg-black/40 p-1.5 border border-white/5 truncate">
                        &gt; {msg}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Real-time Telemetry Terminal Logs */}
          <div className="tactical-panel">
            <div className="p-3 border-b border-white/[0.08] bg-[#08080a] flex items-center justify-between text-xs font-mono">
              <div className="flex items-center gap-2 text-[#a1a1aa]">
                <Terminal className="w-4 h-4 text-[#e61919]" />
                <span className="font-bold tracking-wider">LIVE TELEMETRY LOGS</span>
              </div>
              <span className="text-[10px] text-[#52525b]">
                {logs.length} LINES RECORDED
              </span>
            </div>

            <div className="p-4 bg-[#050505] font-mono text-[11px] leading-relaxed h-[240px] overflow-y-auto space-y-1 text-[#888891] selection:bg-[#e61919] selection:text-white">
              {logs.length === 0 ? (
                <div className="text-[#52525b] italic">
                  Telemetry terminal idle. Select a target plan and launch the pipeline to observe live events.
                </div>
              ) : (
                logs.map((line, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <span className="text-[#52525b] select-none text-[10px] w-6">
                      {idx + 1}
                    </span>
                    <span
                      className={
                        line.includes("[FATAL]") || line.includes("[FAILED]")
                          ? "text-[#ff4d4d]"
                          : line.includes("[COMPLETED]") || line.includes("[SUCCESS]")
                          ? "text-[#4ade80]"
                          : line.includes("[RUNNING]")
                          ? "text-[#60a5fa]"
                          : "text-[#eaeaea]"
                      }
                    >
                      {line}
                    </span>
                  </div>
                ))
              )}
              <div ref={terminalBottomRef} />
            </div>
          </div>

          {/* Results Summary Card if Complete */}
          {finalRecord && (
            <div className="tactical-panel p-5 space-y-4 border-l-4 border-l-[#22c55e] bg-[#0b140e]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-[#22c55e]" />
                  <span className="font-mono text-sm font-bold text-white tracking-wider">
                    PIPELINE EXECUTION DEBRIEF COMPLETE
                  </span>
                </div>
                <Link
                  href={`/reports/${finalRecord.id}`}
                  className="px-3 py-1.5 bg-[#22c55e] hover:bg-[#16a34a] text-black font-mono text-xs font-bold tracking-wider flex items-center gap-1.5 transition-colors"
                >
                  <span>INSPECT FULL DEBRIEF</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
                <div className="p-2.5 bg-black/40 border border-white/10">
                  <span className="text-[10px] text-[#71717a] block uppercase">STATUS</span>
                  <span className="text-white font-bold">{finalRecord.status}</span>
                </div>
                <div className="p-2.5 bg-black/40 border border-white/10">
                  <span className="text-[10px] text-[#71717a] block uppercase">DRIFT FINGERPRINT</span>
                  <span className="text-white font-bold truncate block">
                    {finalRecord.drift_report?.fingerprint || "N/A"}
                  </span>
                </div>
                <div className="p-2.5 bg-black/40 border border-white/10">
                  <span className="text-[10px] text-[#71717a] block uppercase">PULL REQUEST</span>
                  <span className="text-[#3b82f6] font-bold truncate block">
                    {finalRecord.pr_result?.pr_url || "SIMULATED / DRY-RUN"}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
