"use client";

import React, { useState, useEffect } from "react";
import {
  Check,
  CheckCircle2,
  Cpu,
  GitBranch,
  Key,
  Save,
  Shield,
  ShieldAlert,
  Sliders,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { fetchConfig, updateConfig } from "@/lib/api";
import { ConfigResponse } from "@/lib/types";

export default function SettingsPage() {
  const [config, setConfig] = useState<ConfigResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [llmProvider, setLlmProvider] = useState("mock");
  const [llmModel, setLlmModel] = useState("gemini-2.5-flash");
  const [githubRepo, setGithubRepo] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [githubToken, setGithubToken] = useState("");

  useEffect(() => {
    fetchConfig()
      .then((data) => {
        setConfig(data);
        setLlmProvider(data.llm_provider);
        setLlmModel(data.llm_model);
        setGithubRepo(data.github_repository);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const updated = await updateConfig({
        llm_provider: llmProvider,
        llm_model: llmModel,
        github_repository: githubRepo,
        ...(geminiKey ? { gemini_api_key: geminiKey } : {}),
        ...(openaiKey ? { openai_api_key: openaiKey } : {}),
        ...(githubToken ? { github_token: githubToken } : {}),
      });
      setConfig(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      alert(`Failed to save settings: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 p-8 text-center font-mono text-xs text-[#71717a]">
        Loading IaC Sentinal system policies & credentials...
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 lg:p-8 max-w-[1200px] w-full mx-auto space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
        <div>
          <div className="text-[10px] font-mono tracking-[0.2em] text-[#71717a] uppercase">
            GOVERNANCE & CONTROLS // SYSTEM SETTINGS
          </div>
          <h1 className="text-xl lg:text-2xl font-mono font-bold tracking-tight text-white flex items-center gap-2 mt-1">
            <span className="w-2 h-5 bg-[#e61919]" />
            CONFIGURATION & RISK POLICIES
          </h1>
        </div>

        {saved && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#22c55e]/15 border border-[#22c55e]/40 text-[#4ade80] text-xs font-mono">
            <Check className="w-4 h-4" />
            <span>POLICIES UPDATED SUCCESSFULLY</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Section 1: AI Provider */}
        <div className="tactical-panel p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-3 text-xs font-mono">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-[#e61919]" />
              <span className="font-bold text-white tracking-wider uppercase">
                1. AI REASONING ENGINE SETTINGS
              </span>
            </div>
            <span className="text-[10px] text-[#71717a]">LLM ORCHESTRATOR</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase text-[#71717a]">ACTIVE PROVIDER</label>
              <select
                value={llmProvider}
                onChange={(e) => setLlmProvider(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-white/10 text-white p-2.5 focus:border-[#e61919] outline-none"
              >
                <option value="mock">Deterministic Mock (High-Fidelity Offline Mode)</option>
                <option value="gemini">Google Gemini (Recommended)</option>
                <option value="openai">OpenAI</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] uppercase text-[#71717a]">MODEL IDENTIFIER</label>
              <input
                type="text"
                value={llmModel}
                onChange={(e) => setLlmModel(e.target.value)}
                placeholder="e.g. gemini-2.5-flash or gpt-4o"
                className="w-full bg-[#0a0a0a] border border-white/10 text-white p-2.5 focus:border-[#e61919] outline-none"
              />
            </div>
          </div>

          {/* Keys */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs pt-2">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[10px] uppercase text-[#71717a]">GEMINI API KEY</label>
                <span className="text-[10px] text-[#22c55e]">
                  {config?.has_gemini_key ? "SET IN ENVIRONMENT" : "NOT CONFIGURED"}
                </span>
              </div>
              <input
                type="password"
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                placeholder="Leave blank to keep existing key"
                className="w-full bg-[#0a0a0a] border border-white/10 text-white p-2.5 focus:border-[#e61919] outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[10px] uppercase text-[#71717a]">OPENAI API KEY</label>
                <span className="text-[10px] text-[#22c55e]">
                  {config?.has_openai_key ? "SET IN ENVIRONMENT" : "NOT CONFIGURED"}
                </span>
              </div>
              <input
                type="password"
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
                placeholder="Leave blank to keep existing key"
                className="w-full bg-[#0a0a0a] border border-white/10 text-white p-2.5 focus:border-[#e61919] outline-none"
              />
            </div>
          </div>
        </div>

        {/* Section 2: GitHub Integration */}
        <div className="tactical-panel p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-3 text-xs font-mono">
            <div className="flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-[#3b82f6]" />
              <span className="font-bold text-white tracking-wider uppercase">
                2. GITHUB PULL REQUEST AUTOMATION
              </span>
            </div>
            <span className="text-[10px] text-[#71717a]">VCS INTEGRATION</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase text-[#71717a]">TARGET REPOSITORY (OWNER/REPO)</label>
              <input
                type="text"
                value={githubRepo}
                onChange={(e) => setGithubRepo(e.target.value)}
                placeholder="DevRushi-engg/meridian"
                className="w-full bg-[#0a0a0a] border border-white/10 text-white p-2.5 focus:border-[#e61919] outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[10px] uppercase text-[#71717a]">GITHUB TOKEN (PAT)</label>
                <span className="text-[10px] text-[#22c55e]">
                  {config?.has_github_token ? "SET IN ENVIRONMENT" : "NOT CONFIGURED"}
                </span>
              </div>
              <input
                type="password"
                value={githubToken}
                onChange={(e) => setGithubToken(e.target.value)}
                placeholder="ghp_..."
                className="w-full bg-[#0a0a0a] border border-white/10 text-white p-2.5 focus:border-[#e61919] outline-none"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Risk Policy Matrix (Read-only Guardrails Display) */}
        <div className="tactical-panel p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-3 text-xs font-mono">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-[#e61919]" />
              <span className="font-bold text-white tracking-wider uppercase">
                3. DETERMINISTIC RISK CLASSIFICATION POLICY
              </span>
            </div>
            <span className="text-[10px] text-[#22c55e]">ENFORCED IN CODE</span>
          </div>

          <div className="space-y-3 font-mono text-xs">
            <div>
              <span className="text-[10px] uppercase text-[#71717a] block mb-1">
                AUTOMATIC CRITICAL ACTIONS (MANDATES QUARANTINE & REVIEW)
              </span>
              <div className="flex flex-wrap gap-2">
                {config?.critical_actions.map((act) => (
                  <Badge key={act} variant="risk" risk="CRITICAL">
                    {act}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="pt-2">
              <span className="text-[10px] uppercase text-[#71717a] block mb-1">
                INHERENTLY HIGH RISK RESOURCES (IAM, NETWORKING, DATA STORES)
              </span>
              <div className="flex flex-wrap gap-2">
                {config?.high_risk_resources.map((res) => (
                  <span
                    key={res}
                    className="px-2 py-1 bg-[#1a1a1e] border border-white/10 text-[11px] text-[#eaeaea]"
                  >
                    {res}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="px-6 py-2.5 bg-[#e61919] hover:bg-[#c91414] text-white font-mono text-xs font-bold tracking-[0.15em] uppercase flex items-center gap-2 shadow-[0_0_20px_rgba(230,25,25,0.3)] transition-all"
          >
            <Save className="w-4 h-4" />
            <span>SAVE CONFIGURATION</span>
          </button>
        </div>
      </form>
    </div>
  );
}
