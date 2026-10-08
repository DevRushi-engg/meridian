# MERIDIAN Live Demonstration & Viva Presentation Script

This script walks through the live presentation and examination of MERIDIAN.

---

## 1. Introduction & Architecture (Slide / Terminal)
**Demonstrator:**
> "MERIDIAN is an AI-assisted Infrastructure-as-Code drift detection and human-approved remediation system.
> The core design principle is:
> **The LLM proposes. Terraform validates. GitHub reviews. A human approves.**
> MERIDIAN never silently modifies production infrastructure."

---

## 2. Step-by-Step Live Walkthrough

### Step 1: Baseline Sync State
Run MERIDIAN against a baseline synchronized plan:
```bash
python src/main.py --plan-json tests/fixtures/no_drift_plan.json
```
**Expected Output:**
```
✔ Infrastructure is in sync with Terraform desired state. No drift detected.
```
**Explanation to Examiner:**
> "When there is no drift, the system terminates cleanly without making unnecessary AI calls or opening PRs."

---

### Step 2: Inject Configuration Drift (Simulated or Live AWS)
Run MERIDIAN on an environment where an engineer made an emergency tag change in AWS:
```bash
python src/main.py --plan-json tests/fixtures/update_plan.json --dry-run
```
**What MERIDIAN demonstrates:**
1. **Detection & Risk:** Discovers `aws_s3_bucket.meridian_demo` tag mismatch (`Environment = "production"` in AWS vs `"development"` in Terraform).
2. **AI Reasoning:** The LLM summarizes why the drift occurred and proposes a minimal HCL patch.
3. **Deterministic Validation:** The patch is applied inside an isolated sandbox (`meridian_tf_*`) and verified with formatting, syntax, and plan validation.
4. **GitHub PR Generation:** Outputs a structured Markdown PR ready for human review.

---

### Step 3: Guardrail Protection Against Destructive Changes
Run MERIDIAN on a high-risk deletion/replacement:
```bash
python src/main.py --plan-json tests/fixtures/delete_plan.json --dry-run
```
**Expected Output:**
```
✖ Validation Failed. Aborting PR creation to protect infrastructure.
• Guardrail Triggered: Proposal contains CRITICAL destructive changes.
```
**Explanation to Examiner:**
> "MERIDIAN features a deterministic safety guardrail engine. If an AI proposes code that would cause unexpected resource deletion or state destruction, MERIDIAN blocks automated PR creation and logs a high-severity human escalation."

---

### Step 4: Duplicate PR Suppression
Run MERIDIAN twice consecutively with the same drift report:
```bash
python src/main.py --plan-json tests/fixtures/update_plan.json
```
**Explanation to Examiner:**
> "MERIDIAN computes an idempotent SHA256 fingerprint. Recurring cron jobs do not spam the repository with duplicate PRs."

---

## 3. Anticipated Viva / Examination Questions

### Q1: Why not let the AI directly run `terraform apply`?
> **Answer:** Cloud infrastructure changes carry high blast radius. Automated healing without review risks overwriting emergency incident mitigations. Keeping a human approval gate ensures compliance and stability.

### Q2: What if the LLM hallucinates an invalid resource or syntax?
> **Answer:** MERIDIAN isolates generated code in a temporary worktree and subjects it to deterministic Terraform syntax (`validate`) and formatting (`fmt`) checks before any PR is created.

### Q3: How are cloud credentials secured?
> **Answer:** MERIDIAN adheres to the Credential Boundary Invariant. AWS credentials and tokens are never provided to the LLM. GitHub Actions uses short-lived OIDC STS tokens.
