# MERIDIAN — AI-Assisted Terraform/AWS Infrastructure Drift Detection & Human-Approved Remediation

[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![Terraform 1.5+](https://img.shields.io/badge/terraform-1.5+-purple.svg)](https://www.terraform.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> *"When Reality Drifts from the Plan, Pull It Back into Line."*

**MERIDIAN** is a human-in-the-loop DevOps automation system that continuously detects when live AWS cloud infrastructure has drifted away from the Terraform configuration describing it, explains the divergence using an LLM, generates a minimal corrective HCL patch, validates the patch deterministically, and submits a GitHub Pull Request for human engineer review.

---

## 🔑 Core Design Principle

$$\text{The LLM Proposes} \longrightarrow \text{Terraform Validates} \longrightarrow \text{GitHub Reviews} \longrightarrow \text{A Human Approves}$$

**MERIDIAN never silently modifies production infrastructure.**

---

## 🏛️ System Architecture

```
+------------------+
|    AWS Cloud     |
|   Actual State   |
+--------+---------+
         |
         |  terraform refresh / plan
         v
+------------------+
|    Terraform     |
|   Plan + JSON    |
+--------+---------+
         |
         v
+------------------+
| MERIDIAN Python  |
|  Drift Detector  |
+--------+---------+
         |
       Drift?
       /    \
     NO      YES
     |        \
    END        v
       +---------------+
       |      LLM      |
       | Explain+Repair|
       +-------+-------+
               |
               v
       +---------------+
       |   Validator   |
       |  fmt/val/plan |
       +-------+-------+
               |
               v
       +---------------+
       |  Risk Engine  |
       +-------+-------+
               |
               v
       +---------------+
       |   GitHub PR   |
       +-------+-------+
               |
               v
         Human Review
               |
               v
        Terraform Apply
```

---

## 🚀 Key Features

- **Deterministic Drift Detection**: Directly ingests normalized JSON plans (`terraform show -json`) to extract structured attribute diffs.
- **Configurable Risk Matrix**: Classifies changes as `LOW`, `MEDIUM`, `HIGH`, or `CRITICAL`.
- **Destructive Change Guardrails**: Destructive deletions and stateful replacements are blocked from automated PRs and escalated to human engineers.
- **LLM Reasoning Layer**: Explains root causes and generates targeted HCL patches without receiving cloud credentials. Supports Google Gemini, OpenAI, and offline mock modes.
- **Isolated Workspace Sandbox**: Tests candidate patches in temporary isolated environments before touching any repository files.
- **Duplicate PR Suppression**: Calculates idempotent SHA256 fingerprints across drift attributes to prevent PR spam on recurring cron jobs.
- **Comprehensive Audit Logging**: Emits machine-readable JSONL audit logs for compliance and observability.

---

## 📁 Repository Structure

```
meridian/
├── terraform/                # Reference Terraform infrastructure (S3, tags, versioning)
│   ├── main.tf
│   ├── variables.tf
│   ├── outputs.tf
│   └── versions.tf
├── src/                      # Core MERIDIAN Python modules
│   ├── main.py               # CLI orchestrator & entrypoint
│   ├── config.py             # Settings, risk matrices & environment loader
│   ├── plan_parser.py        # Terraform plan JSON parser
│   ├── drift_detector.py     # Deterministic drift classifier
│   ├── drift_model.py        # Pydantic schemas for drift, proposals & validation
│   ├── llm_analyzer.py       # Multi-provider AI reasoning & schema validator
│   ├── patch_generator.py    # Sandboxed workspace manager & patch applicator
│   ├── validator.py          # Deterministic syntax & safety validator
│   ├── github_manager.py     # GitHub REST API & duplicate PR prevention
│   ├── audit_logger.py       # Structured JSONL audit logging
│   └── exceptions.py         # Custom typed exceptions
├── tests/                    # Comprehensive unit and end-to-end tests
│   ├── fixtures/             # Realistic plan JSON test fixtures
│   ├── test_plan_parser.py
│   ├── test_drift_detector.py
│   ├── test_llm_analyzer.py
│   ├── test_patch_generator.py
│   ├── test_validation.py
│   └── test_e2e_pipeline.py
├── prompts/                  # System prompts & schema instructions
│   └── drift_remediation.txt
├── .github/workflows/        # CI/CD pipelines
│   ├── meridian-drift.yml    # Scheduled drift detection workflow
│   └── terraform-ci.yml      # PR verification CI
├── docs/                     # Project blueprints, threats, metrics & demo script
│   ├── architecture.md
│   ├── threat-model.md
│   ├── evaluation.md
│   └── demo-script.md
├── requirements.txt          # Python dependencies
└── README.md
```

---

## ⚡ Quick Start

### 1. Installation
```bash
git clone https://github.com/your-org/meridian.git
cd meridian
pip install -r requirements.txt
```

### 2. Run Complete Test Suite
```bash
python -m pytest -v tests/
```

### 3. Run Pipeline CLI

**Simulate detection on a drifted plan (Dry-Run):**
```bash
python src/main.py --plan-json tests/fixtures/update_plan.json --dry-run
```

**Simulate on a clean state (No Drift):**
```bash
python src/main.py --plan-json tests/fixtures/no_drift_plan.json
```

**Test destructive change guardrail:**
```bash
python src/main.py --plan-json tests/fixtures/delete_plan.json
```

---

## 🔒 Security Best Practices

1. **Zero Cloud Access for AI**: The LLM is never given AWS credentials or access keys.
2. **GitHub Actions OIDC**: Uses short-lived IAM session tokens with least-privilege plan permissions.
3. **Never `apply` Automatically**: Human review is mandatory for all infrastructure updates.
4. **Secret Isolation**: Plan files and credentials are systematically excluded via `.gitignore`.
