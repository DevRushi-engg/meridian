"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Clock,
  ExternalLink,
  Filter,
  Flame,
  GitPullRequest,
  RefreshCw,
  Search,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { fetchReports, deleteReport } from "@/lib/api";
import { PipelineRunRecord, RiskLevel } from "@/lib/types";

export default function ReportsListPage() {
  const [reports, setReports] = useState<PipelineRunRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterRisk, setFilterRisk] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const loadReports = async () => {
    try {
      setLoading(true);
      const data = await fetchReports();
      setReports(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, []);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    if (!confirm(`Delete report record ${id}?`)) return;
    try {
      await deleteReport(id);
      setReports((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      alert("Failed to delete report");
    }
  };

  const filtered = reports.filter((r) => {
    const matchesRisk =
      filterRisk === "ALL" ||
      r.drift_report?.overall_risk === filterRisk;
    const matchesSearch =
      r.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.plan_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.drift_report?.fingerprint || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.proposal?.summary || "").toLowerCase().includes(searchQuery.toLowerCase());
    return matchesRisk && matchesSearch;
  });

  return (
    <div className="flex-1 p-4 lg:p-8 max-w-[1600px] w-full mx-auto space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
        <div>
          <div className="text-[10px] font-mono tracking-[0.2em] text-[#71717a] uppercase">
            AUDIT ARCHIVE // HISTORICAL TELEMETRY
          </div>
          <h1 className="text-xl lg:text-2xl font-mono font-bold tracking-tight text-white flex items-center gap-2 mt-1">
            <span className="w-2 h-5 bg-[#e61919]" />
            DRIFT DEBRIEFS & AUDIT RECORDS
          </h1>
        </div>

        <button
          onClick={loadReports}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#141414] hover:bg-[#1a1a1a] border border-white/10 text-xs font-mono text-[#a1a1aa] hover:text-white transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>REFRESH ARCHIVE</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="tactical-panel p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1 max-w-md bg-[#0a0a0a] border border-white/10 px-3 py-2 text-xs font-mono">
          <Search className="w-4 h-4 text-[#71717a]" />
          <input
            type="text"
            placeholder="Search by Run ID, plan fixture, fingerprint, or resource..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent border-none outline-none text-white w-full placeholder:text-[#52525b]"
          />
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          <Filter className="w-3.5 h-3.5 text-[#71717a]" />
          <span className="text-[#71717a] uppercase text-[10px]">RISK FILTER:</span>
          {["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"].map((level) => (
            <button
              key={level}
              onClick={() => setFilterRisk(level)}
              className={`px-2.5 py-1 text-[11px] border transition-colors ${
                filterRisk === level
                  ? "bg-[#1f1f23] border-white/30 text-white font-bold"
                  : "bg-[#0d0d0f] border-white/5 text-[#888891] hover:text-white"
              }`}
            >
              {level}
            </button>
          ))}
        </div>
      </div>

      {/* Reports List */}
      <div className="tactical-panel divide-y divide-white/[0.04]">
        {loading ? (
          <div className="p-8 text-center text-xs font-mono text-[#71717a]">
            Loading audit archive from telemetry store...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-xs font-mono text-[#71717a]">
            No drift reports match the current filter criteria.
          </div>
        ) : (
          filtered.map((r) => (
            <div
              key={r.id}
              className="p-5 hover:bg-white/[0.02] transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4 text-xs font-mono"
            >
              <div className="space-y-2 flex-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="font-bold text-white text-sm">{r.id}</span>
                  <span className="text-[#52525b]">/</span>
                  <span className="text-[#eaeaea] font-semibold">{r.plan_name}</span>
                  <Badge status={r.status}>{r.status}</Badge>
                  {r.drift_report && (
                    <Badge variant="risk" risk={r.drift_report.overall_risk}>
                      {r.drift_report.overall_risk}
                    </Badge>
                  )}
                  <span className="text-[10px] text-[#71717a] bg-white/5 px-2 py-0.5 border border-white/5">
                    PROVIDER: {r.llm_provider.toUpperCase()}
                  </span>
                </div>

                <p className="text-[#a1a1aa] text-xs leading-relaxed max-w-3xl">
                  {r.proposal?.summary ||
                    `Completed deterministic drift audit for ${r.plan_name}.`}
                </p>

                <div className="flex flex-wrap items-center gap-4 text-[11px] text-[#71717a]">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3 h-3" />
                    {new Date(r.created_at).toLocaleString()}
                  </span>
                  <span>|</span>
                  <span>
                    FINGERPRINT:{" "}
                    <code className="text-white">
                      {r.drift_report?.fingerprint || "none"}
                    </code>
                  </span>
                  <span>|</span>
                  <span>
                    DRIFTED RESOURCES:{" "}
                    <strong className="text-white">
                      {r.drift_report?.total_resources_drifted || 0}
                    </strong>
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 self-end lg:self-center">
                <button
                  onClick={(e) => handleDelete(r.id, e)}
                  title="Delete record"
                  className="p-2 text-[#71717a] hover:text-[#e61919] hover:bg-white/5 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <Link
                  href={`/reports/${r.id}`}
                  className="px-3.5 py-2 bg-[#1a1a1a] hover:bg-[#262626] border border-white/10 hover:border-white/20 text-white font-mono text-xs font-semibold tracking-wider flex items-center gap-2 transition-all"
                >
                  <span>INSPECT DEBRIEF</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
