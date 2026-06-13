export type UserRole = "filmmaker" | "producer" | "investor" | "organization" | "admin";
export type ApprovalStatus = "pending" | "approved" | "rejected";
export type ProjectStage = "development" | "pre_production" | "production" | "post_production" | "completed";
export type ProjectFormat = "feature" | "short" | "documentary" | "series" | "animation";
export type OpportunityType = "grant" | "fund" | "lab" | "co_production" | "market" | "distribution" | "investor" | "broadcaster" | "streamer" | "sales_agent";
export type ApplicationStatus = "draft" | "submitted" | "under_review" | "shortlisted" | "accepted" | "rejected" | "withdrawn";
export type OfferStatus = "pending" | "accepted" | "declined" | "withdrawn";

export interface Profile {
  id: string;
  role: UserRole;
  approval_status: ApprovalStatus;
  full_name: string;
  company: string | null;
  country: string | null;
  bio: string | null;
  website: string | null;
  imdb_url: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface Project {
  id: string;
  owner_id: string;
  title: string;
  genre: string;
  format: ProjectFormat;
  language: string;
  country: string;
  budget_usd: number | null;
  funding_needed_usd: number | null;
  stage: ProjectStage;
  logline: string;
  synopsis: string | null;
  director_statement: string | null;
  producer_info: string | null;
  pitch_deck_path: string | null;
  script_path: string | null;
  is_public: boolean;
  created_at: string;
}

export interface Opportunity {
  id: string;
  title: string;
  opp_type: OpportunityType;
  description: string | null;
  country: string | null;
  region: string | null;
  genres: string[];
  formats: ProjectFormat[];
  stages: ProjectStage[];
  languages: string[];
  min_budget_usd: number | null;
  max_budget_usd: number | null;
  max_award_usd: number | null;
  deadline: string | null;
  url: string | null;
  is_active: boolean;
}

export interface Application {
  id: string;
  project_id: string;
  opportunity_id: string;
  applicant_id: string;
  status: ApplicationStatus;
  cover_note: string | null;
  match_score: number | null;
  created_at: string;
}

export interface Offer {
  id: string;
  project_id: string;
  from_user_id: string;
  amount_usd: number | null;
  offer_type: string;
  message: string;
  status: OfferStatus;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
}

export interface MatchResult {
  score: number;
  tier: "excellent" | "strong" | "possible" | "hidden";
  confidence: "high" | "medium" | "low";
  reasons: string[];
  strengths: string[];
  warnings: string[];
}

export type CertificateType = "incorporation" | "accreditation" | "id_proof" | "tax" | "other";
export type CertificateStatus = "pending" | "approved" | "rejected";

export interface Certificate {
  id: string;
  user_id: string;
  cert_type: CertificateType;
  label: string;
  file_path: string;
  status: CertificateStatus;
  notes: string | null;
  created_at: string;
}

export type ReportStatus = "open" | "resolved" | "dismissed";
export type ReportTarget = "profile" | "project" | "offer" | "opportunity";

export interface Report {
  id: string;
  reporter_id: string | null;
  target_type: ReportTarget;
  target_id: string;
  reason: string;
  status: ReportStatus;
  created_at: string;
}
