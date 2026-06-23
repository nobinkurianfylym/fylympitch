export type UserRole = "filmmaker" | "producer" | "investor" | "organization" | "admin";
export type ApprovalStatus = "pending" | "approved" | "rejected";
export type ProjectStage = "development" | "pre_production" | "production" | "post_production" | "completed";
export type ProjectFormat = "feature" | "short" | "documentary" | "series" | "animation";
export type OpportunityType =
  // Development
  | "script_lab" | "lab" | "residency" | "mentorship" | "grant" | "fund" | "writing_fellowship"
  // Packaging & Markets
  | "pitch_forum" | "co_production" | "market"
  // Early Financing
  | "crowdfunding" | "donation" | "fiscal_sponsorship" | "seed_funding" | "community_funding"
  // Tax Incentives
  | "tax_incentive" | "cash_rebate" | "production_rebate" | "regional_incentive" | "location_incentive"
  // Private Financing
  | "investor" | "angel_investor" | "venture_capital" | "gap_financing" | "brand_integration" | "product_placement" | "sponsor" | "private_fund"
  // Production
  | "producer" | "co_producer" | "production_company" | "studio"
  // Post Production
  | "post_production_grant" | "post_production_fund"
  // Buyers & Sales
  | "sales_agent" | "world_sales" | "broadcaster" | "streamer" | "pre_sale" | "content_buyer" | "music_rights"
  // Release & Distribution
  | "film_festival" | "distribution" | "theatrical_distribution" | "ott_distribution" | "tv_distribution" | "digital_aggregator" | "educational_distribution" | "airline_distribution";
export type ApplicationStatus = "draft" | "submitted" | "under_review" | "shortlisted" | "accepted" | "rejected" | "withdrawn";
export type OfferStatus = "pending" | "accepted" | "declined" | "withdrawn";

export interface Profile {
  id: string;
  role: UserRole;
  approval_status: ApprovalStatus;
  onboarded_at: string | null;
  email: string | null;
  full_name: string;
  username: string;
  company: string | null;
  country: string | null;
  bio: string | null;
  website: string | null;
  imdb_url: string | null;
  avatar_url: string | null;
  created_at: string;
  // Producer/investor/organization matching fields (services/fylympitchEngine.ts)
  industry_genres?: string[];
  industry_formats?: ProjectFormat[];
  industry_countries?: string[];
  min_budget_usd?: number | null;
  max_budget_usd?: number | null;
  available_funding_usd?: number | null;
  festival_track_record?: boolean;
}

export interface Project {
  id: string;
  owner_id: string;
  title: string;
  slug: string;
  genre: string;
  format: ProjectFormat;
  language: string;
  country: string;
  budget_currency: string;
  budget_usd: number | null;
  budget_amount: number | null;          // original entry in budget_currency
  finance_secured_usd: number | null;
  finance_secured_amount: number | null; // original entry in budget_currency
  funding_needed_usd: number | null;
  funding_needed_amount: number | null;  // original entry in budget_currency
  stage: ProjectStage;
  logline: string;
  synopsis: string | null;
  director_statement: string | null;
  producer_info: string | null;
  director_name: string | null;
  writer_name: string | null;
  pitch_deck_path: string | null;
  script_path: string | null;
  poster_path: string | null;
  has_script_doc: boolean;
  has_budget_doc: boolean;
  has_lookbook: boolean;
  has_coproducer: boolean;
  is_public: boolean;
  created_at: string;
  /** e.g. "First-time", "Emerging", "Established" — hybrid matching bonus (fylympitchEngine.ts) */
  career_stage?: string | null;
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
  /** MASTER_DATA hybrid-matching extras (fylympitchEngine.ts) */
  career_stages?: string[];
  match_weight?: "high" | "medium" | "low" | null;
  /** MASTER_DATA metadata (migration 004) */
  gender_focus?: string | null;
  copro_required?: boolean;
  festival_affiliated?: boolean;
  ott_affiliated?: boolean;
  contact_email?: string | null;
  contact_phone?: string | null;
  key_person?: string | null;
  app_link?: string | null;
  /** Free-text deadline cycle, e.g. "Annual — Jan/Feb. Check thewhickers.com" */
  deadline_note?: string | null;
  /** How a filmmaker applies — drives badge + packet UX (migration 045) */
  apply_method?: 'one_click' | 'export_packet' | 'manual' | 'api' | null;
  /** Direct URL to fund application form (one_click / export_packet) */
  form_url?: string | null;
  /** Maps fund form field selectors → FYLYM project fields */
  form_field_map?: Record<string, string> | null;
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
