# MERIDIAN — Tactical Mission Control Frontend & API System

## 1. Overview
The terminal-only MERIDIAN CLI has been upgraded to a **Tactical Operations Mission Control System**, featuring an asynchronous **FastAPI backend** connected to a **Next.js 14 App Router frontend** adhering to the approved **Tactical Telemetry** design direction (fusing Industrial Brutalist and OLED Dark Developer aesthetics).

---

## 2. Architecture & Live Services

```
+-------------------------------------------------------------------------+
|                  MERIDIAN NEXT.JS 14 FRONTEND                           |
|                  http://localhost:3000                                  |
|                                                                         |
|  [Mission Control Dashboard]   [Pipeline Orchestrator]                  |
|  [Drift Debriefs & Archive]    [Governance & Policies]                  |
+-------------------------------------------------------------------------+
                                    ▲
                                    │ REST API + WebSocket
                                    ▼
+-------------------------------------------------------------------------+
|                  FASTAPI BACKEND SERVICE                                |
|                  http://localhost:8000                                  |
|                                                                         |
|  /api/pipeline/run             /api/reports                             |
|  /api/drift/*                  /api/config                              |
|  /api/upload/plan & fixtures   /ws/pipeline/{run_id} (Live telemetry)  |
+-------------------------------------------------------------------------+
                                    ▲
                                    │ Pure Python Engine
                                    ▼
+-------------------------------------------------------------------------+
|                  MERIDIAN CORE ENGINE (Existing)                        |
|  DriftDetector · LLMAnalyzer · PatchGenerator · TerraformValidator      |
+-------------------------------------------------------------------------+
```

---

## 3. Implemented Core Screens

### 1. Mission Control Dashboard (`/`)
- **System Parity Beacon:** Real-time pulsing alert bar showing whether infrastructure is synchronized or actively drifting.
- **Bento Telemetry Cards:**
  - `AUDITS EXECUTED`
  - `DRIFTED ASSETS`
  - `CRITICAL BLOCKS` (destructive deletions quarantined)
  - `SYNTHESIZED PRS`
- **Detected Discrepancies Stream:** Monospace table comparing Live Cloud vs Git Desired states with deterministic risk tags.
- **1-Click Tactical Launch Pad:** Instant execution of test fixtures (`update_plan.json`, `replace_plan.json`, `multiple_changes_plan.json`, `delete_plan.json`, `no_drift_plan.json`).

### 2. Pipeline Orchestrator (`/pipeline`)
- **6-Stage Visual Telemetry Loop:**
  - Stage 1: Plan Ingestion
  - Stage 2: Risk Scoring & SHA256 Fingerprint
  - Stage 3: LLM Reasoning & Unified Patch Synthesis
  - Stage 4: Ephemeral Sandbox Staging
  - Stage 5: Deterministic Validation & Guardrails
  - Stage 6: Idempotent GitHub PR Automation
- **Interactive Input:** Select bundled test fixtures or drag-and-drop custom `terraform show -json` files.
- **Live Telemetry Terminal:** Real-time log stream connected via WebSocket.

### 3. Drift Debriefs Archive (`/reports`)
- Comprehensive audit records with search and risk-level filters (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`).
- One-click deletion and direct debrief inspection.

### 4. Detailed Debrief & Diff Viewer (`/reports/[id]`)
- **Unified Diff Viewer:** Syntax-highlighted HCL candidate patch (additions in terminal green `#22c55e`, deletions in hazard red `#e61919`).
- **AI Remediation Debrief:** Root cause hypothesis, confidence score, and recommended human action.
- **Deterministic Guardrails Checklist:** `fmt`, `validate`, `plan`, and `unexpected destroy` verification.
- **GitHub PR Status:** Target branch, pull request link, and markdown preview.

### 5. Configuration & Governance (`/settings`)
- AI provider selection (`Mock`, `Google Gemini`, `OpenAI`).
- GitHub token and target repository settings.
- Enforced High-Risk Resource policy matrix and critical action guardrail definitions.

---

## 4. API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Service health check |
| `POST` | `/api/pipeline/run` | Execute complete 6-stage remediation loop |
| `GET` | `/api/pipeline/runs` | List all historical and queued runs |
| `GET` | `/api/pipeline/runs/{id}` | Get specific run status and stage telemetry |
| `POST` | `/api/drift/detect` | Standalone plan parsing and drift detection |
| `POST` | `/api/drift/analyze` | Standalone LLM reasoning and patch synthesis |
| `POST` | `/api/drift/validate` | Standalone isolated sandbox validation |
| `POST` | `/api/drift/create-pr` | Standalone GitHub PR generation |
| `GET` | `/api/reports` | List all stored reports |
| `GET` | `/api/reports/stats` | Telemetry statistics for bento metrics |
| `GET` | `/api/reports/{id}` | Detailed report debrief |
| `GET` | `/api/config` | Retrieve current system configuration |
| `POST` | `/api/config` | Update runtime configuration |
| `GET` | `/api/upload/fixtures` | List available plan test fixtures |
| `POST` | `/api/upload/plan` | Upload custom Terraform plan JSON |
| `WS` | `/ws/pipeline/{run_id}` | Live stage streaming WebSocket |
| `WS` | `/ws/telemetry` | Global telemetry broadcast WebSocket |

---

## 5. Verification & Tests
- **All 25 Backend Tests Passed:** `25 passed in 0.67s` via `pytest -v`.
- **Frontend Turbopack Build:** Clean compilation of all routes (`/`, `/pipeline`, `/reports`, `/reports/[id]`, `/settings`).
- **End-to-End Execution:** Verified live 6-stage execution of `update_plan.json` producing synchronized report `run-79d887a6` with simulated PR generation and isolated sandbox validation.
