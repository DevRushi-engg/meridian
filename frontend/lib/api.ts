import {
  ConfigResponse,
  FixtureInfo,
  PipelineRunRecord,
  SystemStats,
} from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function fetchHealth(): Promise<{ status: string }> {
  const res = await fetch(`${API_BASE}/health`, { cache: "no-store" });
  if (!res.ok) throw new Error("API not healthy");
  return res.json();
}

export async function fetchStats(): Promise<SystemStats> {
  const res = await fetch(`${API_BASE}/api/reports/stats`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load stats");
  return res.json();
}

export async function fetchReports(): Promise<PipelineRunRecord[]> {
  const res = await fetch(`${API_BASE}/api/reports`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load reports");
  return res.json();
}

export async function fetchReport(runId: string): Promise<PipelineRunRecord> {
  const res = await fetch(`${API_BASE}/api/reports/${runId}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load report ${runId}`);
  return res.json();
}

export async function deleteReport(runId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/reports/${runId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`Failed to delete report ${runId}`);
}

export async function fetchConfig(): Promise<ConfigResponse> {
  const res = await fetch(`${API_BASE}/api/config`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load configuration");
  return res.json();
}

export async function updateConfig(updates: Partial<ConfigResponse>): Promise<ConfigResponse> {
  const res = await fetch(`${API_BASE}/api/config`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error("Failed to update configuration");
  return res.json();
}

export async function fetchFixtures(): Promise<FixtureInfo[]> {
  const res = await fetch(`${API_BASE}/api/upload/fixtures`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load fixtures");
  return res.json();
}

export async function triggerPipelineRun(params: {
  fixture_name?: string;
  plan_content?: any;
  llm_provider?: string;
  dry_run?: boolean;
}): Promise<PipelineRunRecord> {
  const res = await fetch(`${API_BASE}/api/pipeline/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fixture_name: params.fixture_name,
      plan_content: params.plan_content,
      llm_provider: params.llm_provider || "mock",
      dry_run: params.dry_run ?? true,
    }),
  });
  if (!res.ok) throw new Error("Failed to trigger pipeline");
  return res.json();
}

export async function uploadPlanFile(file: File): Promise<any> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_BASE}/api/upload/plan`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Upload failed" }));
    throw new Error(err.detail || "Failed to upload plan JSON");
  }
  return res.json();
}
