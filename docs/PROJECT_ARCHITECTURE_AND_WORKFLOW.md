# IaC Sentinal — Complete Project Architecture & Working (Diagrammatic Guide)

> **Design Principle:** *"The LLM proposes. Terraform validates. GitHub reviews. A human approves."*  
> This document explains the complete end-to-end working of IaC Sentinal through structured diagrams and clear step-by-step descriptions.

---

## 1. High-Level System Architecture Diagram

This diagram shows how all three tiers (Frontend, API, and Core Engine) interact with external cloud services, LLM providers, and GitHub.

```mermaid
graph TB
    subgraph Client ["Client Browser (DevOps / SRE Engineer)"]
        UI["Next.js 14 Web Interface<br/>(http://localhost:3000)"]
    end

    subgraph APILayer ["API Bridge Layer (FastAPI :8000)"]
        Router["FastAPI Gateway & Routers<br/>(/api/pipeline, /api/drift, /api/reports)"]
        WS["WebSocket Broadcaster<br/>(/ws/pipeline/{run_id})"]
        Store[("In-Memory Telemetry Store<br/>Historical Runs & Stats")]
    end

    subgraph CoreEngine ["Python Core Engine (src/)"]
        Parser["Stage 1: PlanParser<br/>Extracts resource_changes"]
        Detector["Stage 2: DriftDetector<br/>Deterministic Risk Matrix + SHA256 Fingerprint"]
        LLM["Stage 3: LLMAnalyzer<br/>Prompt Synthesizer + Guardrail Validator"]
        PatchGen["Stage 4: PatchGenerator<br/>Ephemeral Sandbox Provisioner"]
        Val["Stage 5: TerraformValidator<br/>fmt · validate · plan · zero-destroy"]
        GH["Stage 6: GitHubManager<br/>Idempotent Branch & Pull Request Automator"]
        Audit[("Audit Logger<br/>meridian_audit.jsonl")]
    end

    subgraph ExternalServices ["External Providers & Infrastructure"]
        TerraformCLI["Terraform CLI Engine<br/>fmt · validate · plan"]
        AIProviders["AI Providers<br/>(Gemini 2.5 Flash / GPT-4o / Mock)"]
        GitHubAPI["GitHub API / VCS<br/>Branch checkout · PR creation"]
        LiveAWS["Live Cloud Assets<br/>(AWS S3, EC2, RDS, IAM, SGs)"]
    end

    %% Client to API
    UI -->|"HTTP REST Requests (trigger run, fetch reports)"| Router
    WS -->|"WebSocket Stage Streaming (JSON frames)"| UI

    %% API to Core Engine
    Router -->|"Async Task Initiation"| Parser
    Router <-->|"Read / Write Records"| Store
    Parser --> Detector
    Detector --> LLM
    LLM --> PatchGen
    PatchGen --> Val
    Val --> GH

    %% Engine to External
    LLM <-->|"Generate HCL patch"| AIProviders
    Val <-->|"Execute syntax & dry-run checks"| TerraformCLI
    GH -->|"Create PR for human review"| GitHubAPI
    Parser -.->|"Ingests drift from"| LiveAWS

    %% Internal Logging & Streaming
    Parser & Detector & LLM & Val & GH -.->|"Record Event"| Audit
    CoreEngine -.->|"Broadcast Stage Progress"| WS
```

---

## 2. The 6-Stage Deterministic Remediation Loop

The core operating cycle follows a strict 6-stage progressive disclosure pipeline. At every stage, deterministic guardrails prevent AI hallucinations from reaching production.

```mermaid
flowchart TD
    Start(["Input: Terraform Plan JSON<br/>(terraform show -json)"]) --> S1

    subgraph Stage1 ["Stage 1: Ingestion & Normalization"]
        S1["PlanParser.parse_plan()"]
        S1 --> S1_Check{"Has Resource Changes?"}
        S1_Check -- No --> EndNoDrift["Status: NO_DRIFT<br/>Infrastructure synchronized. Stop."]
        S1_Check -- Yes --> S2
    end

    subgraph Stage2 ["Stage 2: Risk Scoring & Idempotency"]
        S2["DriftDetector.detect_drift()"]
        S2 --> S2_Fingerprint["Compute SHA256 Fingerprint<br/>Hash of address + actions + diffs"]
        S2_Fingerprint --> S2_Matrix["Evaluate Risk Level:<br/>• Delete / Replace -> CRITICAL<br/>• IAM / SG / RDS -> HIGH<br/>• Config attribute -> MEDIUM<br/>• Tags / Metadata -> LOW"]
        S2_Matrix --> S3
    end

    subgraph Stage3 ["Stage 3: AI Reasoning & Patch Synthesis"]
        S3["LLMAnalyzer.analyze_drift()<br/>(Gemini / OpenAI / Mock)"]
        S3 --> S3_Prompt["Inject DriftReport + Active main.tf into Prompt"]
        S3_Prompt --> S3_Output["LLM Outputs Strict JSON Schema:<br/>summary, hypothesis, recommendation, patch, confidence"]
        S3_Output --> S4
    end

    subgraph Stage4 ["Stage 4: Ephemeral Sandbox Isolation"]
        S4["PatchGenerator.create_isolated_workspace()"]
        S4 --> S4_Clone["Copy HCL files to temporary directory<br/>e.g. /tmp/meridian_tf_XXXX/"]
        S4_Clone --> S4_Apply["Stage AI Candidate Patch in sandbox<br/>(Path-traversal protection strictly enforced)"]
        S4_Apply --> S5
    end

    subgraph Stage5 ["Stage 5: Deterministic Validation & Guardrails"]
        S5["TerraformValidator.validate_workspace()"]
        S5 --> S5_Fmt["1. terraform fmt -check"]
        S5_Fmt --> S5_Validate["2. terraform validate"]
        S5_Validate --> S5_Plan["3. terraform plan (dry run)"]
        S5_Plan --> S5_Guardrail{"Unexpected Resource Destruction Detected?"}
        S5_Guardrail -- Yes --> Block["GUARDRAIL TRIGGERED:<br/>Quarantine patch. Abort PR creation.<br/>Status: FAILED / BLOCKED"]
        S5_Guardrail -- No --> Pass["All Deterministic Checks PASS"]
        Pass --> S6
    end

    subgraph Stage6 ["Stage 6: GitHub Automation & Human Gate"]
        S6["GitHubManager.create_or_update_pr()"]
        S6 --> S6_DupCheck{"Does PR exist for Fingerprint?"}
        S6_DupCheck -- Yes --> Suppress["SUPPRESSED_DUPLICATE<br/>Idempotent. Re-use existing PR."]
        S6_DupCheck -- No --> CreatePR["Create Git Branch: meridian/drift/{fingerprint}<br/>Commit staged HCL patch<br/>Open Pull Request on GitHub"]
        CreatePR --> HumanApproval{"Human DevOps Engineer Review"}
        HumanApproval -- Rejected --> Close["PR Closed without apply"]
        HumanApproval -- Approved & Merged --> Apply["Terraform Apply to Production"]
    end
```

---

## 3. End-to-End Sequence Diagram (User Action to PR)

This sequence diagram illustrates what happens second-by-second when a user clicks **"START RECONCILIATION"** on the web frontend.

```mermaid
sequenceDiagram
    autonumber
    actor User as DevOps Engineer
    participant Frontend as Next.js 14 (Browser)
    participant WS as WebSocket Endpoint
    participant API as FastAPI Backend
    participant Engine as Python Engine (src/)
    participant Sandbox as Ephemeral Sandbox
    participant Terraform as Terraform CLI
    participant LLM as AI Provider (Gemini/Mock)
    participant GitHub as GitHub API

    User->>Frontend: Clicks "START RECONCILIATION" (e.g. update_plan.json)
    Frontend->>API: POST /api/pipeline/run { fixture_name: "update_plan.json" }
    API-->>Frontend: 200 OK { run_id: "run-79d887a6", status: "QUEUED" }
    Frontend->>WS: Connect WebSocket /ws/pipeline/run-79d887a6

    Note over API,Engine: Asynchronous Background Task Begins

    API->>Engine: Step 1: Ingest plan & detect drift
    Engine->>API: DriftReport generated (1 drifted item, Risk: LOW)
    API->>WS: Broadcast { stage: 1, name: "Plan Ingestion", status: "completed" }
    WS-->>Frontend: Update Stage 1 card to green Checkmark

    API->>Engine: Step 2: Calculate deterministic risk & fingerprint
    Engine->>API: Fingerprint computed: [95d64f08de1ea960]
    API->>WS: Broadcast { stage: 2, name: "Risk Scoring", status: "completed" }
    WS-->>Frontend: Update Stage 2 card to green Checkmark

    API->>Engine: Step 3: Analyze drift with AI
    Engine->>LLM: Send DriftReport + current main.tf
    LLM-->>Engine: Structured JSON (hypothesis, recommended action, HCL diff)
    API->>WS: Broadcast { stage: 3, name: "AI Reasoning", status: "completed", confidence: 0.95 }
    WS-->>Frontend: Update Stage 3 card to green Checkmark

    API->>Engine: Step 4: Provision isolated sandbox
    Engine->>Sandbox: Create /tmp/meridian_tf_19c0/ & apply patch
    API->>WS: Broadcast { stage: 4, name: "Sandbox Isolation", status: "completed" }
    WS-->>Frontend: Update Stage 4 card to green Checkmark

    API->>Engine: Step 5: Validate workspace
    Engine->>Terraform: Run fmt, validate, plan
    Terraform-->>Engine: All checks PASS, 0 unexpected destroys
    API->>WS: Broadcast { stage: 5, name: "Validation", status: "completed" }
    WS-->>Frontend: Update Stage 5 card to green Checkmark

    API->>Engine: Step 6: Create GitHub Pull Request
    Engine->>GitHub: Create branch meridian/drift/95d64f08de1ea960 & open PR
    GitHub-->>Engine: PR created: https://github.com/.../pull/101
    API->>WS: Broadcast { stage: 6, name: "GitHub Automation", status: "completed", pr_url: "..." }
    WS-->>Frontend: Render Debrief Banner with direct link to Pull Request

    Frontend->>User: Display green "PIPELINE EXECUTION DEBRIEF COMPLETE" card
```

---

## 4. Data Transformation & Model Lifecycle

How data transforms at every phase of the pipeline, from raw JSON to human-approved Pull Request:

```mermaid
classDiagram
    class RawTerraformPlan {
        +string format_version
        +string terraform_version
        +list resource_changes
    }

    class DriftReport {
        +string timestamp
        +bool has_drift
        +int total_resources_drifted
        +RiskLevel overall_risk
        +string fingerprint (SHA256)
        +list~ResourceDrift~ resources
    }

    class ResourceDrift {
        +string address
        +string resource_type
        +list~string~ actions
        +DriftType drift_type
        +RiskLevel risk
        +list~AttributeDifference~ differences
    }

    class LLMRemediationProposal {
        +LLMProposalStatus status
        +string summary
        +string root_cause_hypothesis
        +RiskLevel risk
        +string recommended_action
        +list~string~ files_to_modify
        +string patch (Unified Diff)
        +float confidence (0.0 to 1.0)
        +bool requires_human_review (Strictly true)
    }

    class ValidationResult {
        +bool format_pass
        +bool validate_pass
        +bool plan_pass
        +bool unexpected_destroy
        +bool is_valid
        +list~string~ errors
    }

    class PullRequestRecord {
        +string action (CREATED / SUPPRESSED_DUPLICATE)
        +string pr_url
        +string branch
        +string fingerprint
        +string body (Markdown table + Diff + Risk)
    }

    RawTerraformPlan --> DriftReport : Parsed by PlanParser & DriftDetector
    DriftReport *-- ResourceDrift : Contains
    DriftReport --> LLMRemediationProposal : Synthesized by LLMAnalyzer
    LLMRemediationProposal --> ValidationResult : Verified by TerraformValidator in Sandbox
    ValidationResult --> PullRequestRecord : Packaged by GitHubManager
```

---

## 5. Security & Guardrail Decision Tree

This diagram illustrates how IaC Sentinal protects cloud infrastructure against unexpected resource destruction or hallucinated code changes:

```mermaid
graph TD
    Proposal["AI Proposed Patch Received"] --> Check1{"Are file paths safe?<br/>(No ../ path traversal)"}
    
    Check1 -- Unsafe --> Reject1["SECURITY EXCEPTION:<br/>Path traversal attempt detected.<br/>Reject immediately."]
    Check1 -- Safe --> StagePatch["Stage Patch in Isolated Sandbox Workspace"]
    
    StagePatch --> Check2{"terraform fmt -check"}
    Check2 -- Fails --> Reject2["VALIDATION ERROR:<br/>Malformed syntax or formatting.<br/>Reject immediately."]
    Check2 -- Passes --> Check3{"terraform validate"}

    Check3 -- Fails --> Reject3["VALIDATION ERROR:<br/>Invalid resource references or schema.<br/>Reject immediately."]
    Check3 -- Passes --> Check4{"terraform plan (Dry Run)"}

    Check4 -- Fails --> Reject4["VALIDATION ERROR:<br/>Plan execution failed.<br/>Reject immediately."]
    Check4 -- Passes --> Guardrail{"Does Plan contain unapproved<br/>DELETE or REPLACE actions?"}

    Guardrail -- Yes (Destruction Detected) --> RejectGuardrail["GUARDRAIL BLOCK:<br/>Unexpected resource destruction quarantined.<br/>PR creation aborted.<br/>Flagged for manual review."]
    Guardrail -- No (Safe Parity Patch) --> AllowPR["PASSED DETERMINISTIC GUARDRAILS:<br/>Safe for Pull Request creation.<br/>Requires human engineer approval before merge."]
```

---

## 6. Summary of Architectural Guarantees

1. **Zero Hallucinated Destructions:** The LLM cannot delete production resources without failing Stage 5 deterministic guardrails.
2. **Deterministic Idempotency:** The SHA256 fingerprint guarantees that running the pipeline 100 times on the same drift produces only 1 Pull Request instead of spamming 100 duplicate PRs.
3. **No Direct Production Writes:** Neither the LLM nor the pipeline applies changes directly to the live cloud. A human DevOps engineer must review the diff on GitHub and merge the PR.
4. **Real-Time Telemetry:** Engineers do not need to poll terminals; WebSocket streams reflect live sandbox progress, validation results, and links in real time.
