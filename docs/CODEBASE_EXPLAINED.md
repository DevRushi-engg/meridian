# IaC Sentinal — Complete Codebase Breakdown & Guide

> **Target Audience:** Anyone wanting to understand the entire IaC Sentinal codebase from scratch in simple, plain English.  
> **Core Principle:** *"The LLM proposes. Terraform validates. GitHub reviews. A human approves."*

---

## 1. High-Level Summary & The 3-Tier Architecture

To make this project clean, reliable, and production-grade, the codebase is strictly separated into **3 distinct layers**:

```
+-----------------------------------------------------------------------------------+
| 1. FRONTEND TIER (User Interface - Next.js 14)                                    |
| Located in: frontend/                                                             |
| Role: What the engineer sees and clicks in the browser. Monospace data readouts,  |
|       real-time progress animations, unified diff viewers, and launchpad buttons. |
+-----------------------------------------------------------------------------------+
                                         │  HTTP REST & WebSockets
                                         ▼
+-----------------------------------------------------------------------------------+
| 2. API LAYER (The Communication Bridge - FastAPI)                                 |
| Located in: api/                                                                  |
| Role: Translates web clicks into background tasks, broadcasts live stage events   |
|       via WebSockets, and manages report histories.                               |
+-----------------------------------------------------------------------------------+
                                         │  Direct Python Function Calls
                                         ▼
+-----------------------------------------------------------------------------------+
| 3. BACKEND CORE ENGINE (The Deterministic Logic - Python + Terraform CLI)         |
| Located in: src/                                                                  |
| Role: The actual brain! Ingests plans, scores risks, prompts AI for fixes, tests  |
|       candidate patches in an isolated sandbox, and opens pull requests.          |
+-----------------------------------------------------------------------------------+
```

---

## 2. Master File Classification Table

| File Path | Tier | In Simple Words (What does it do?) |
|---|---|---|
| **`src/drift_model.py`** | **Backend Core** | The Blueprint: Defines data schemas (what a "Drift", "Risk", or "Proposal" looks like). |
| **`src/plan_parser.py`** | **Backend Core** | The Translator: Reads complex Terraform JSON output and extracts changed attributes. |
| **`src/drift_detector.py`** | **Backend Core** | The Detective: Compares desired vs live cloud states and assigns risk scores. |
| **`src/llm_analyzer.py`** | **Backend Core** | The AI Architect: Sends drift context to Gemini/OpenAI/Mock to generate a fix. |
| **`src/patch_generator.py`** | **Backend Core** | The Staging Ground: Creates a temporary isolated folder to test the AI patch safely. |
| **`src/validator.py`** | **Backend Core** | The Strict Inspector: Runs `terraform fmt`, `validate`, and guards against destructive drops. |
| **`src/github_manager.py`** | **Backend Core** | The Pull Request Automator: Checks out a Git branch and creates an idempotent PR. |
| **`src/config.py`** | **Backend Core** | The Settings Vault: Loads API keys, model names, and security thresholds. |
| **`src/audit_logger.py`** | **Backend Core** | The Flight Recorder: Logs every single action to a tamper-evident audit file. |
| **`src/exceptions.py`** | **Backend Core** | The Guardrail Alarms: Custom Python error types that stop invalid operations. |
| **`src/main.py`** | **Backend Core** | The Original CLI: Lets you run the entire 6-stage pipeline from your terminal. |
| **`api/main.py`** | **API Layer** | The Web Gateway: Starts FastAPI, configures CORS, and routes WebSocket connections. |
| **`api/schemas.py`** | **API Layer** | API Contracts: Request & response data models used by the REST endpoints. |
| **`api/store.py`** | **API Layer** | In-Memory Database: Stores runs, stats, and pre-seeds realistic demo reports. |
| **`api/websocket.py`** | **API Layer** | Live Radio Station: Broadcasts stage progress in real time to connected browser windows. |
| **`api/routes/pipeline.py`** | **API Layer** | Pipeline Endpoint: Handles `/api/pipeline/run` and coordinates background stages. |
| **`api/routes/drift.py`** | **API Layer** | Standalone Stages: Lets you trigger individual steps (detect, analyze, validate, PR). |
| **`api/routes/reports.py`** | **API Layer** | Reports Endpoint: Delivers audit histories, run debriefs, and system statistics. |
| **`api/routes/config_routes.py`** | **API Layer** | Settings Endpoint: Allows the UI to read and update API keys and model parameters. |
| **`api/routes/upload.py`** | **API Layer** | File Ingest Endpoint: Allows uploading custom plan files and lists built-in fixtures. |
| **`frontend/app/layout.tsx`** | **Frontend** | Outer Layout Frame: Loads Geist typography, tactical dark canvas, and persistent Navbar. |
| **`frontend/app/globals.css`** | **Frontend** | Tactical Design System: OLED void blacks, radar grids, hazard red glows, 0px borders. |
| **`frontend/app/page.tsx`** | **Frontend** | Screen 1 (Dashboard): Parity alert beacon, 4 KPI bento metrics, discrepancy table, launch pad. |
| **`frontend/app/pipeline/page.tsx`** | **Frontend** | Screen 2 (Runner): 6-stage progression cards, live terminal stream, plan file selector. |
| **`frontend/app/reports/page.tsx`** | **Frontend** | Screen 3 (Reports List): Searchable, filterable audit archive with risk tags. |
| **`frontend/app/reports/[id]/page.tsx`** | **Frontend** | Screen 4 (Debrief Detail): AI hypothesis, candidate HCL diff viewer, guardrails check, PR card. |
| **`frontend/app/settings/page.tsx`** | **Frontend** | Screen 5 (Settings): Configuration form for LLM provider, keys, and security matrix. |
| **`frontend/components/nav/Navbar.tsx`** | **Frontend** | Tactical Header: System status ticker, live UTC clock, brand logo, navigation tabs. |
| **`frontend/components/ui/Badge.tsx`** | **Frontend** | Risk Badges: Renders `CRITICAL`, `HIGH`, `MEDIUM`, `LOW` in brutalist boxes. |
| **`frontend/components/ui/StatusDot.tsx`** | **Frontend** | Pulsing Beacon: Renders pulsing LED indicators (Hazard Red, Terminal Green). |
| **`frontend/lib/types.ts`** | **Frontend** | TypeScript Definitions: Matches the Python backend data structures for strong typing. |
| **`frontend/lib/api.ts`** | **Frontend** | API Client: Helper functions to fetch data from the FastAPI backend at `:8000`. |

---

## 3. Deep Dive: Backend Core Engine (`src/`)

These files contain the pure deterministic business logic. They do not depend on the browser or web server.

### 1. `src/drift_model.py` — The Foundation Blueprint
* **What it does:** Uses Python's `pydantic` library to create strict data contracts.
* **Key Classes:**
  * `DriftType`: An enumeration describing the kind of drift (`NO_DRIFT`, `ATTRIBUTE_UPDATE`, `RESOURCE_CREATE`, `RESOURCE_DELETE`, `RESOURCE_REPLACEMENT`).
  * `RiskLevel`: The 4 danger tiers (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`).
  * `AttributeDifference`: Holds the exact attribute changed (e.g., `tags.Environment`), what Terraform wanted (`development`), and what live AWS actually has (`production`).
  * `ResourceDrift`: Groups all changes for a single resource (e.g., `aws_s3_bucket.demo`).
  * `DriftReport`: The master report for the entire cloud infrastructure. It also computes a **deterministic SHA256 fingerprint** of all drifted items to prevent duplicate pull requests!
  * `LLMRemediationProposal`: The required output schema from the AI, including root-cause hypothesis, unified diff patch, and confidence percentage.
  * `ValidationResult`: Holds the boolean results of `format_pass`, `validate_pass`, `plan_pass`, and `unexpected_destroy`.

### 2. `src/plan_parser.py` — The Plan Ingester & Normalizer
* **What it does:** When Terraform runs `terraform show -json <planfile>`, it outputs a massive, deeply nested JSON document. `PlanParser` parses this file, extracts only the `resource_changes` array, ignores irrelevant internal state, and normalizes before/after values into a clean structure.
* **Why it matters:** It prevents the rest of the application from having to deal with messy raw Terraform JSON schemas.

### 3. `src/drift_detector.py` — The Detective & Risk Scoring Matrix
* **What it does:** Takes the normalized plan output from `PlanParser` and executes deterministic risk evaluation.
* **Deterministic Risk Matrix Rules:**
  1. Any destructive action (`delete` or `replace`) is immediately classified as **`CRITICAL`**.
  2. Any changes on sensitive resources (`aws_security_group`, `aws_iam_role`, `aws_db_instance`, `aws_kms_key`) are classified as **`HIGH`**.
  3. Non-metadata configuration changes (e.g., `instance_type`, `versioning`) are **`MEDIUM`**.
  4. Harmless tag or description adjustments (e.g., `tags`, `tags_all`) are **`LOW`**.
* **Output:** A structured `DriftReport` object.

### 4. `src/llm_analyzer.py` — The AI Architect
* **What it does:** Takes the `DriftReport` and the active `terraform/main.tf` code, and constructs a strict prompt for the Large Language Model.
* **Supported Providers:**
  * `mock`: A deterministic, high-fidelity offline mode that synthesizes valid patches instantly (ideal for air-gapped systems and CI/CD).
  * `gemini`: Calls Google's `gemini-2.5-flash` using `google-genai`.
  * `openai`: Calls OpenAI's `gpt-4o` using `openai`.
* **Guardrail:** It enforces JSON output schema and strips accidental markdown code blocks (` ```json `) to guarantee machine-readable parsing.

### 5. `src/patch_generator.py` — The Safe Sandbox Stager
* **What it does:** Never modifies your real repository directly! Instead, it creates an ephemeral, isolated temporary directory (e.g., in `/tmp/meridian_tf_...`), copies your Terraform files into it, and stages the AI's proposed HCL patch there.
* **Security Guard:** Implements path-traversal protection (`../../`) so a hallucinating LLM cannot write files outside the sandbox!

### 6. `src/validator.py` — The Strict Inspector & Guardrail Enforcer
* **What it does:** Enters the isolated sandbox and executes actual deterministic CLI checks:
  1. `terraform fmt -check`: Checks syntax and style.
  2. `terraform validate`: Validates internal references, providers, and resource blocks.
  3. Destructive Guardrail Check: Checks whether the AI proposed destroying resources without authorization. If unexpected deletion is found, validation **fails immediately** and aborts PR generation!

### 7. `src/github_manager.py` — The GitHub PR Automator
* **What it does:** Automates the Git lifecycle:
  * Generates a deterministic branch name using the SHA256 fingerprint: `meridian/drift/<fingerprint>`.
  * Checks if an open PR for this exact fingerprint already exists on GitHub (Duplicate Suppression / Idempotency).
  * In `dry_run` mode (default), it simulates the PR payload without touching remote repositories.
  * In active mode, it creates a formatted Pull Request with markdown tables, risk indicators, validation proof, and diff snippets for human engineers to review.

### 8. `src/config.py` — Global Configuration
* **What it does:** Reads `.env` and environment variables. Stores API keys, high-risk resource lists, paths, and default LLM provider settings.

### 9. `src/audit_logger.py` & `src/exceptions.py`
* **Audit Logger:** Writes JSONL events to `logs/meridian_audit.jsonl` every time a plan is parsed, drift is detected, validation runs, or a PR is generated.
* **Exceptions:** Defines explicit exceptions like `DriftDetectionError`, `PlanParsingError`, and `ValidationFailedError`.

### 10. `src/main.py` — The Command-Line Orchestrator
* **What it does:** Connects all 6 stages sequentially for terminal usage. It prints colored Rich tables, summaries, and validation statuses.

---

## 4. Deep Dive: API Bridge Layer (`api/`)

The API layer transforms the standalone Python engine into an asynchronous, real-time web service.

### 1. `api/main.py` — FastAPI Application Entrypoint
* Sets up the FastAPI server, mounts CORS middleware (so `localhost:3000` can make requests to `localhost:8000`), mounts all router modules, and exposes the `/health` endpoint and WebSocket endpoints (`/ws/pipeline/{run_id}`).

### 2. `api/store.py` — In-Memory Store & Test Fixtures
* Acts as an in-memory database holding all pipeline runs, reports, and system statistics.
* On startup, it pre-seeds realistic historical runs using the bundled test fixtures (`update_plan.json`, `replace_plan.json`, `multiple_changes_plan.json`, `delete_plan.json`), so the dashboard is immediately rich with telemetry upon first launch!

### 3. `api/websocket.py` — Real-Time Stage Broadcaster
* Manages active WebSocket connections. When a pipeline runs in the background, this module broadcasts stage updates (`running`, `progress`, `completed`, `failed`) directly to the browser with millisecond latency.

### 4. `api/schemas.py` — API Request & Response Contracts
* Defines Pydantic models for web communication: `PipelineRunRequest`, `PipelineStageUpdate`, `PipelineRunRecord`, `ConfigResponse`, and `SystemStats`.

### 5. `api/routes/` — Endpoint Routers
* **`pipeline.py`:** `POST /api/pipeline/run` spawns an asynchronous background task that runs all 6 stages sequentially, streaming events to WebSockets and saving the final record.
* **`drift.py`:** Exposes individual stages (`/detect`, `/analyze`, `/validate`, `/create-pr`) for granular testing.
* **`reports.py`:** `GET /api/reports`, `GET /api/reports/stats`, `GET /api/reports/{id}`, `DELETE /api/reports/{id}`.
* **`config_routes.py`:** `GET /api/config` and `POST /api/config` to update credentials dynamically at runtime.
* **`upload.py`:** Handles file uploads of custom `plan.json` files and lists available fixtures.

---

## 5. Deep Dive: Frontend Mission Control (`frontend/`)

Built with **Next.js 14 App Router**, **Tailwind CSS**, and modern TypeScript. Follows the **Tactical Telemetry** aesthetic: OLED void blacks, monospace figures, 0px border-radius compartments, and hazard-red accents.

### 1. `frontend/app/layout.tsx` & `globals.css`
* **`layout.tsx`:** Sets up HTML metadata, loads Google Geist & Geist Mono fonts, displays the persistent `Navbar`, and wraps pages in a tactical grid layout.
* **`globals.css`:** Defines color variables (`--bg-void: #0a0a0a`, `--accent-hazard: #e61919`, etc.), the 32px tactical grid background, and custom glowing status beacon animations (`beacon-hazard`, `beacon-green`).

### 2. `frontend/app/page.tsx` — Mission Control Dashboard (`/`)
* **Status Beacon:** Pulsing red/green banner showing whether infrastructure parity is maintained or drift is detected.
* **Bento KPI Matrix:** Real-time count of total audits, drifted assets, critical blocks, and synthesized PRs.
* **Discrepancy Stream:** Monospace table comparing Live AWS Cloud vs Git Desired states with deterministic risk badges (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`).
* **Tactical Launch Pad:** Quick selector to run pre-configured scenarios with 1-click execution.
* **Guardrails Status Card:** Displays active enforcement rules (`fmt`, `validate`, `ephemeral sandbox`, `destruction block`).

### 3. `frontend/app/pipeline/page.tsx` — Pipeline Orchestrator (`/pipeline`)
* **Input Column:** Select preset fixtures or drag-and-drop custom `plan.json` files, pick AI provider (`Mock`, `Gemini`, `OpenAI`), and toggle Dry-Run mode.
* **6-Stage Telemetry Loop:** Interactive cards showing active stage progression in real time.
* **Live Telemetry Terminal:** Embedded black-box console showing live WebSocket log messages with line numbers and color-coded status tags.
* **Execution Debrief Card:** Appears upon completion with direct link to view the complete debrief.

### 4. `frontend/app/reports/page.tsx` — Drift Debriefs Archive (`/reports`)
* List of all historical audits. Features instant search and risk filters (`ALL`, `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`).

### 5. `frontend/app/reports/[id]/page.tsx` — Detailed Debrief & Diff Viewer (`/reports/:id`)
* **AI Remediation Proposal Card:** Shows AI confidence score, root cause hypothesis, and recommended action.
* **Unified Diff Viewer:** Git-style diff inspection of candidate HCL patch with line numbering, green additions (`+`), and red subtractions (`-`).
* **Deterministic Guardrails Matrix:** Visual verification checklist (`fmt`, `validate`, `plan`, `unexpected destroy check`).
* **GitHub PR Automation Card:** Shows pull request link, branch name, and rendered markdown PR body preview.

### 6. `frontend/app/settings/page.tsx` — Configuration & Governance (`/settings`)
* Lets engineers update the AI provider, Gemini/OpenAI API keys, and GitHub repository credentials.
* Displays the active risk classification policy matrix.

### 7. Reusable Components & Helpers
* **`components/nav/Navbar.tsx`:** Top tactical ticker with system coordinates, live UTC clock, and navigation tabs.
* **`components/ui/Badge.tsx`:** Renders brutalist color-coded risk and status badges.
* **`components/ui/StatusDot.tsx`:** Renders pulsing radar LED dots.
* **`lib/types.ts`:** TypeScript interfaces matching the Pydantic schemas.
* **`lib/api.ts`:** Clean `fetch` wrapper communicating with the FastAPI backend at `http://localhost:8000`.

---

## 6. Infrastructure, Tests, & Fixtures

* **`terraform/`:** Contains real sample Terraform code (`main.tf`, `variables.tf`, `outputs.tf`) managing an AWS S3 bucket with tags.
* **`tests/fixtures/`:** Bundled sample Terraform JSON plan files simulating real-world scenarios:
  * `update_plan.json`: S3 bucket tags drifted out-of-band (Medium/Low risk).
  * `replace_plan.json`: Security group replacement causing database outage (Critical risk).
  * `delete_plan.json`: Unauthorized IAM role deletion (Critical risk).
  * `multiple_changes_plan.json`: Multi-resource enterprise drift (High risk).
  * `no_drift_plan.json`: Clean, perfectly synchronized state (No drift).
* **`tests/`:** 25 comprehensive unit and end-to-end pytest tests ensuring deterministic risk calculation, path-traversal prevention, mock LLM synthesis, sandbox cleanup, and guardrail enforcement.
