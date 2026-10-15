# IaC Sentinal — Complete Frontend & UI Walkthrough (Visual Guide)

> **Goal:** To explain everything you see on the screen when you open **`http://localhost:3000`** in plain, simple terms — what each box, button, and indicator means without any complicated jargon!

---

## 1. The Global Header (Always at the Top of Every Page)

No matter which page you click on, the top header remains visible. It has two bars:

```
+---------------------------------------------------------------------------------------------------------------+
|  SYS: IAC-SENTINAL-01  |  LOC: LAT 37.77 / LON -122.41  |  IAC: TERRAFORM v1.7.0  |  API ONLINE :8000  | UTC  |
+---------------------------------------------------------------------------------------------------------------+
|  [+] IAC SENTINAL v1.0   [ MISSION CONTROL ]   [ PIPELINE RUNNER ]   [ DRIFT DEBRIEFS ]   [ CONFIG ]   [RUN]  |
+---------------------------------------------------------------------------------------------------------------+
```

### 1.1 The Top Ticker (Thin Black Bar)
* **`SYS: IAC-SENTINAL-01`**: The identifier of your mission control node.
* **`API ONLINE :8000`**: A glowing green dot showing that your FastAPI backend on port 8000 is running and connected. (If you turn off the backend, this turns red to warn you).
* **`Live UTC Clock`**: Ticking clock so DevOps engineers can synchronize incident timestamps worldwide.

### 1.2 The Main Navigation Bar
* **Logo (Crosshair Icon + `IAC SENTINAL v1.0`)**: Clicking this takes you right back to the Home Dashboard.
* **Tabs**:
  1. **MISSION CONTROL**: The home overview dashboard.
  2. **PIPELINE RUNNER**: Where you actually launch and watch the 6-stage remediation live.
  3. **DRIFT DEBRIEFS**: The archive where past audit records and reports are stored.
  4. **CONFIG & POLICIES**: Where you set your AI keys and review safety rules.
* **Red Button `> RUN PIPELINE`**: A quick shortcut button on the right that immediately takes you to the runner page.

---

## 2. Screen 1: Mission Control Dashboard (`/`)

When you open `http://localhost:3000`, this is your main cockpit. Here is what every box does:

```
+---------------------------------------------------------------------------------------------------------------+
| [!] TELEMETRY STATUS: OUT-OF-BAND DRIFT DETECTED           [SYNC TELEMETRY]  [> TRIGGER RECONCILIATION]       |
+---------------------------------------------------------------------------------------------------------------+
| [ AUDITS EXECUTED: 4 ]  |  [ DRIFTED ASSETS: 4 ]  |  [ CRITICAL BLOCKS: 2 ]  |  [ SYNTHESIZED PRS: 3 ]        |
+----------------------------------------------------+----------------------------------------------------------+
| DETECTED INFRASTRUCTURE DISCREPANCIES (Table)      | TACTICAL LAUNCH PAD                                      |
| • aws_s3_bucket.meridian_demo  [LOW]               | • update_plan.json (S3 Bucket Drift)                     |
| • aws_security_group.db_sg     [CRITICAL]          | • replace_plan.json (RDS SG Replace)                     |
| • aws_iam_role.app_exec        [CRITICAL]          | • multiple_changes_plan.json                             |
| • aws_instance.api_gateway     [HIGH]              | [> LAUNCH PIPELINE RECONCILIATION]                       |
+----------------------------------------------------+----------------------------------------------------------+
| RECENT RECONCILIATION RUNS (Feed)                  | DETERMINISTIC GUARDRAILS                                 |
| • run-79d887a6 / update_plan.json [SUCCESS]        | 1. terraform fmt     -> ENFORCED                         |
| • run-9b418a02 / replace_plan.json [FAILED]        | 2. terraform validate-> ENFORCED                         |
|                                                    | 3. sandbox isolation -> EPHEMERAL                        |
|                                                    | 4. destruction block -> STRICT (NO-DELETE)               |
+----------------------------------------------------+----------------------------------------------------------+
```

### A. The Big Parity Alert Beacon (Top Box)
* **What you see:** A wide box with a red left border and a glowing red beacon.
* **What it means:** It immediately tells you: *"Danger! Someone made manual changes in the AWS console that are NOT in our Terraform code!"*
* **If everything is in sync:** It turns green and says *"ALL LIVE ASSETS SYNCHRONIZED"*.

### B. The 4 Big Metric Cards (KPI Bento Grid)
1. **AUDITS EXECUTED (White Number `4`):** Total times the drift audit has scanned your cloud.
2. **DRIFTED ASSETS (Amber Number `4`):** How many cloud resources are currently out of sync.
3. **CRITICAL BLOCKS (Red Number `2`):** Dangerous destructive changes (like deleting an IAM role) that IaC Sentinal **quarantined and blocked** to protect your company.
4. **SYNTHESIZED PRS (Green Number `3`):** How many safe Pull Requests have been prepared for human engineers.

### C. Detected Infrastructure Discrepancies Table (Left Center)
* Shows each drifted resource line-by-line:
  * **Resource Address:** Name of the AWS item (e.g. `aws_s3_bucket.meridian_demo`).
  * **Action:** What Terraform planned (`UPDATE`, `REPLACE`, `DELETE`).
  * **Attribute:** The exact setting modified (e.g. `tags.Environment`).
  * **Git Desired (Green text):** What your code in GitHub says it should be (`development`).
  * **Live Cloud (Red text):** What someone manually changed it to in live AWS (`production`).
  * **Risk Badge:** Color-coded label (`CRITICAL`, `HIGH`, `MEDIUM`, or `LOW`).

### D. Tactical Launch Pad (Right Center)
* **What it does:** Allows you to test any Terraform drift scenario with 1 click!
* You simply click on a scenario (e.g., `update_plan.json`) and hit **`LAUNCH PIPELINE RECONCILIATION`**. It starts the 6-stage engine immediately!

### E. Deterministic Guardrails Status Card (Bottom Right)
* Displays the safety guarantees: Syntax checked? Yes. Ephemeral isolated folder? Yes. Accidental destruction blocked? Yes. Human approval required? Yes.

---

## 3. Screen 2: Pipeline Runner (`/pipeline`)

When you want to execute a drift fix and watch it happen live:

```
+---------------------------------------------------------------------------------------------------------------+
| < OPERATIONS // EXECUTION TERMINAL                                     [RESET TERMINAL]  [START RECONCILIATION]|
| PIPELINE ORCHESTRATOR                                                                                         |
+----------------------------------------------------+----------------------------------------------------------+
| 1. TARGET PLAN SOURCE                              | 6-STAGE PROGRESSION CARDS (2x3 Grid)                     |
| • update_plan.json                                 | [ STAGE 1: PLAN INGESTION       (DONE) ]                 |
| • replace_plan.json                                | [ STAGE 2: RISK SCORING         (DONE) ]                 |
| • multiple_changes_plan.json                       | [ STAGE 3: AI REASONING         (DONE) ]                 |
| • Drop terraform plan .json here (Upload)          | [ STAGE 4: SANDBOX ISOLATION    (DONE) ]                 |
+----------------------------------------------------+ [ STAGE 5: VALIDATION           (DONE) ]                 |
| 2. EXECUTION PARAMETERS                            | [ STAGE 6: GITHUB AUTOMATION    (DONE) ]                 |
| • AI Provider: [ Mock / Gemini / OpenAI ]          +----------------------------------------------------------+
| • Simulation / Dry Run: [x] Checkbox               | LIVE TELEMETRY LOGS (Black Terminal Console)             |
|                                                    | 1  [INIT] Launching IaC Sentinal loop...                 |
|                                                    | 2  [COMPLETED] Stage 1: Plan parsed                      |
|                                                    | 3  [COMPLETED] Stage 2: Found 1 drift. Risk: LOW         |
+----------------------------------------------------+----------------------------------------------------------+
| [✓] PIPELINE EXECUTION DEBRIEF COMPLETE            STATUS: SUCCESS  | FINGERPRINT: 95d64f08  [INSPECT DEBRIEF]|
+---------------------------------------------------------------------------------------------------------------+
```

### What You Do on this Page:
1. **Choose a Plan (Left Side):** Pick one of the sample plans or drag-and-drop a new `plan.json` file.
2. **Choose AI Provider:** Leave as `Deterministic Mock` (instant and free) or switch to `Google Gemini` / `OpenAI`.
3. **Hit the Big Red Button:** Click **`START RECONCILIATION`**.

### What Happens Visually in Real Time:
* **Stage 1 to 6 Cards:** As the background Python task runs, each stage lights up blue with a spinner (`RUNNING`), and then changes to green with a checkmark (`COMPLETED`).
* **Live Terminal:** Down below, a black console prints real-time WebSocket log messages line-by-line so you can see exactly what the backend is doing.
* **Green Completion Banner:** When Stage 6 finishes, a green card pops up at the bottom with a link button: **`INSPECT FULL DEBRIEF`**.

---

## 4. Screen 3: Drift Debriefs Archive (`/reports`)

This is your history archive of all past drift runs:

```
+---------------------------------------------------------------------------------------------------------------+
| AUDIT ARCHIVE // HISTORICAL TELEMETRY                                                       [REFRESH ARCHIVE] |
| DRIFT DEBRIEFS & AUDIT RECORDS                                                                                |
+---------------------------------------------------------------------------------------------------------------+
| [ Search by Run ID, plan fixture...               ]    RISK FILTER: [ALL] [CRITICAL] [HIGH] [MEDIUM] [LOW]     |
+---------------------------------------------------------------------------------------------------------------+
| • run-79d887a6 / update_plan.json     [SUCCESS] [LOW] [PROVIDER: MOCK]                  [INSPECT DEBRIEF >]   |
|   Configuration drift detected on aws_s3_bucket.meridian_demo (tags.Environment)                             |
|   2026-10-11 UTC | FINGERPRINT: 95d64f08de1ea960 | DRIFTED RESOURCES: 1                                        |
+---------------------------------------------------------------------------------------------------------------+
| • run-9b418a02 / replace_plan.json    [FAILED] [CRITICAL] [PROVIDER: MOCK]               [INSPECT DEBRIEF >]   |
|   Quarantined by deterministic guardrails: proposal contained unconfirmed destructive replace                |
+---------------------------------------------------------------------------------------------------------------+
```

* **Search Bar:** Type any keyword (e.g. `s3` or `run-79d`) to instantly filter the list.
* **Risk Filter Buttons:** Click `CRITICAL` to only view high-danger items.
* **`INSPECT DEBRIEF >` Button:** Opens the full detailed debrief for that run.

---

## 5. Screen 4: Detailed Debrief & Diff Viewer (`/reports/[id]`)

This is the most important screen for a human engineer before approving a pull request:

```
+---------------------------------------------------------------------------------------------------------------+
| < BACK TO AUDIT ARCHIVE                                                               [SUCCESS]  [LOW RISK]   |
| DRIFT DEBRIEF: run-79d887a6                                                                                   |
| PLAN: update_plan.json  |  PROVIDER: MOCK  |  FINGERPRINT: 95d64f08de1ea960                                   |
+----------------------------------------------------+----------------------------------------------------------+
| STAGE 3: AI REMEDIATION PROPOSAL                   | STAGE 5: DETERMINISTIC GUARDRAILS                        |
| • Summary: Configuration drift detected on tags    | • terraform fmt       -> [PASS]                          |
| • Hypothesis: Out-of-band edit in AWS console      | • terraform validate  -> [PASS]                          |
| • Recommendation: Re-align tags in Terraform code  | • terraform plan      -> [PASS]                          |
| • Confidence: 95%                                  | • Unexpected Destroy  -> [SAFE]                          |
+----------------------------------------------------+----------------------------------------------------------+
| CANDIDATE HCL REMEDIATION PATCH (Diff Viewer)      | STAGE 6: GITHUB PULL REQUEST                             |
| 1  --- a/terraform/main.tf                         | • Action: SIMULATED_PR (Dry Run)                         |
| 2  +++ b/terraform/main.tf                         | • PR URL: https://github.com/.../pull/101                |
| 3  @@ -5,3 +5,3 @@ resource "aws_s3_bucket" ...    | • Branch: meridian/drift/95d64f08de1ea960                |
| 4  -    Environment = "production"  (Red deletion) | • SHA256: 95d64f08de1ea960                               |
| 5  +    Environment = "development" (Green addition+----------------------------------------------------------+
| 6       ManagedBy   = "terraform"                  | AUDIT LOG TRAIL                                          |
+----------------------------------------------------+ > Plan ingested                                         |
| RESOURCE DISCREPANCIES (1)                         | > Evaluated risk: LOW                                    |
| aws_s3_bucket.demo | tags.Environment | dev -> prod| > PR ready for human engineer                            |
+----------------------------------------------------+----------------------------------------------------------+
```

### Highlights on this Screen:
1. **AI Remediation Proposal (Top Left):** The AI explains *why* the drift happened and what it recommends doing in simple plain English, with a confidence score (e.g. 95%).
2. **Unified Diff Viewer (Middle Left):** Exactly like GitHub! 
   * Red lines starting with `-` show what is being removed.
   * Green lines starting with `+` show what is being added to fix the drift.
3. **Guardrails Checklist (Top Right):** Proves to the engineer that `terraform fmt`, `validate`, and `plan` all passed in an isolated sandbox and that zero resources were accidentally destroyed.
4. **GitHub Pull Request Card (Middle Right):** Gives you the exact link to the created Pull Request on GitHub.

---

## 6. Screen 5: Configuration & Policies (`/settings`)

Where you configure credentials and view security rules:

1. **AI Reasoning Engine Settings:** Select your active provider (`Deterministic Mock`, `Google Gemini`, or `OpenAI`), enter model name, and paste your API keys.
2. **GitHub Pull Request Automation:** Specify the target repository (e.g. `DevRushi-engg/meridian`) and GitHub Personal Access Token.
3. **Deterministic Risk Classification Policy:** Displays the hardcoded safety rules — which resources are classified as high risk (`aws_security_group`, `aws_iam_role`, `aws_db_instance`) and which actions trigger an automatic critical quarantine (`DELETE`, `REPLACE`).
4. **`SAVE CONFIGURATION` Button:** Saves updates to the backend in real time.

---

## 7. Color Guide Summary (Why We Used These Colors)

| Color | Name | Where It Is Used | Meaning |
|---|---|---|---|
| `#0A0A0A` | **Void Black** | Background Canvas | Premium dark mode, low eye-strain for developers. |
| `#141414` | **Gunmetal** | Card Panels | Clean separation without distracting borders. |
| `#E61919` | **Hazard Red** | Active Alerts, Critical Badges, CTAs | Signals attention: drift detected, destructive action, or primary action button. |
| `#22C55E` | **Terminal Green** | Success Badges, Passing Checks, Diff additions (`+`) | Everything verified, syntax passed, safe to merge. |
| `#F59E0B` | **Amber Signal** | Medium Risk Badges, Warning indicators | Caution: attribute drift detected that requires review. |
| `#3B82F6` | **Steel Blue** | Pull Request Links, Branch names | Version control links and Git references. |

---

## 8. Summary of Commands to Run

From the root project folder:

```bash
# 1. Start the FastAPI backend (in terminal 1):
source .venv/bin/activate
python3 -m uvicorn api.main:app --host 0.0.0.0 --port 8000

# 2. Start the Next.js frontend (in terminal 2):
npm run dev

# 3. Open in your browser:
# http://localhost:3000
```
