export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type DriftType =
  | "NO_DRIFT"
  | "ATTRIBUTE_UPDATE"
  | "RESOURCE_CREATE"
  | "RESOURCE_DELETE"
  | "RESOURCE_REPLACEMENT"
  | "UNKNOWN";

export type LLMProposalStatus =
  | "PROPOSED"
  | "NEEDS_HUMAN_REVIEW"
  | "UNSAFE"
  | "INSUFFICIENT_CONTEXT";

export interface AttributeDifference {
  attribute: string;
  desired: any;
  actual: any;
}

export interface ResourceDrift {
  address: string;
  resource_type: string;
  name: string;
  actions: string[];
  drift_type: DriftType;
  risk: RiskLevel;
  differences: AttributeDifference[];
  before_state?: Record<string, any>;
  after_state?: Record<string, any>;
}

export interface DriftReport {
  timestamp: string;
  terraform_version?: string;
  format_version?: string;
  has_drift: boolean;
  total_resources_drifted: number;
  overall_risk: RiskLevel;
  resources: ResourceDrift[];
  fingerprint: string;
}

export interface LLMRemediationProposal {
  status: LLMProposalStatus;
  summary: string;
  root_cause_hypothesis: string;
  risk: RiskLevel;
  recommended_action: string;
  files_to_modify: string[];
  patch: string;
  confidence: number;
  requires_human_review: boolean;
}

export interface ValidationResult {
  format_pass: boolean;
  validate_pass: boolean;
  plan_pass: boolean;
  unexpected_destroy: boolean;
  details: string;
  errors: string[];
}

export interface PRResult {
  action: string;
  pr_url: string;
  branch: string;
  fingerprint: string;
  body: string;
}

export interface PipelineRunRecord {
  id: string;
  status: "QUEUED" | "RUNNING" | "SUCCESS" | "FAILED" | "NO_DRIFT";
  created_at: string;
  completed_at?: string;
  plan_name: string;
  llm_provider: string;
  dry_run: boolean;
  drift_report?: DriftReport;
  proposal?: LLMRemediationProposal;
  validation?: ValidationResult;
  pr_result?: PRResult;
  logs: string[];
  error?: string;
}

export interface ConfigResponse {
  llm_provider: string;
  llm_model: string;
  github_repository: string;
  github_base_branch: string;
  pr_branch_prefix: string;
  has_github_token: boolean;
  has_gemini_key: boolean;
  has_openai_key: boolean;
  high_risk_resources: string[];
  critical_actions: string[];
}

export interface SystemStats {
  total_runs: number;
  total_drift_detected: number;
  critical_risks: number;
  prs_generated: number;
  uptime_seconds: number;
}

export interface FixtureInfo {
  filename: string;
  resource_count: number;
  terraform_version: string;
  description: string;
}

export interface StageUpdatePayload {
  run_id: string;
  stage: number;
  stage_name: string;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  progress: number;
  message: string;
  timestamp: string;
  data?: Record<string, any>;
}
