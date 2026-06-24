"use server";

import { revalidatePath } from "next/cache";
import { toUSD } from "@/lib/format";
import { toLiveUSD, validateBudgetSplit } from "@/lib/currency";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { OpportunityIntelligenceExtras, ProducerMatchProfile } from "@/services/fylympitchEngine";
import type { Opportunity, Project } from "@/types";

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

async function requireAdmin() {
  const { supabase, user } = await requireUser();
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/dashboard");
  return { supabase, user };
}

function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}
function num(fd: FormData, key: string): number | null {
  const v = str(fd, key);
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

// ---------- PROJECTS ----------
export async function completeFilmmakerOnboarding(formData: FormData) {
  const { supabase, user } = await requireUser();

  const full_name      = str(formData, "full_name")?.trim();
  const country        = str(formData, "country")?.trim();
  const imdb_url       = str(formData, "imdb_url")?.trim() || null;
  const career_stage   = str(formData, "career_stage");
  const next           = str(formData, "next") || "/dashboard";

  let filmmaker_formats: string[] = [];
  try {
    const raw = str(formData, "filmmaker_formats");
    if (raw) filmmaker_formats = JSON.parse(raw);
  } catch {}

  if (!full_name)    return { error: "Please enter your name." };
  if (!country)      return { error: "Please enter your country." };
  if (!career_stage) return { error: "Please select your career stage." };

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name,
      country,
      imdb_url,
      career_stage,
      filmmaker_formats,
      profile_completed: true,
      onboarded_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) return { error: error.message };

  redirect(next);
}

export async function createProject(formData: FormData) {
  const { supabase, user } = await requireUser();

  // Safety net: ensure profile row exists (with username) before inserting a project.
  const displayName = user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email?.split("@")[0] ?? "Filmmaker";
  const { data: generatedUsername } = await supabase.rpc("generate_unique_username", { base_name: displayName });
  await supabase.from("profiles").upsert({
    id:                user.id,
    role:              "filmmaker" as const,
    full_name:         displayName,
    email:             user.email ?? null,
    approval_status:   "approved" as const,
    onboarded_at:      new Date().toISOString(),
    profile_completed: false,
    username:          generatedUsername ?? (displayName.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 25) || "user"),
  }, { onConflict: "id", ignoreDuplicates: true });

  const title = str(formData, "title");
  const logline = str(formData, "logline");
  if (!title || !logline) return { error: "Title and logline are required." };
  if (logline.length > 500) return { error: "Logline must be 500 characters or fewer." };

  // ── Budget: store original amounts + convert to USD via live-rate waterfall ──
  const budgetCurrency = str(formData, "budget_currency") || "USD";
  const budgetAmount        = num(formData, "budget_usd");           // raw amount in budgetCurrency
  const financeSecuredAmount = num(formData, "finance_secured_usd"); // raw amount in budgetCurrency
  const fundingNeededAmount  = num(formData, "funding_needed_usd");  // raw amount in budgetCurrency

  // Server-side budget split validation
  const budgetError = validateBudgetSplit(budgetAmount, financeSecuredAmount, fundingNeededAmount);
  if (budgetError) return { error: budgetError };

  // Convert to USD using live-rate waterfall (Cerebras-style: try live → fixed fallback)
  const [budgetUSD, financeSecuredUSD, fundingNeededUSD] = await Promise.all([
    budgetAmount        != null ? toLiveUSD(budgetAmount, budgetCurrency)        : Promise.resolve(null),
    financeSecuredAmount != null ? toLiveUSD(financeSecuredAmount, budgetCurrency) : Promise.resolve(null),
    fundingNeededAmount  != null ? toLiveUSD(fundingNeededAmount, budgetCurrency)  : Promise.resolve(null),
  ]);

  // Generate unique slug for clean public URL
  const { data: generatedSlug } = await supabase.rpc("generate_unique_slug", { base_title: title });
  const slug = generatedSlug ?? title.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, "-").slice(0, 60);

  const { data, error } = await supabase
    .from("projects")
    .insert({
      owner_id: user.id,
      slug,
      title,
      genre: str(formData, "genre") || "Drama",
      format: str(formData, "format") || "feature",
      language: str(formData, "language") || "English",
      country: str(formData, "country") || "India",
      budget_currency:          budgetCurrency,
      budget_amount:            budgetAmount,
      budget_usd:               budgetUSD,
      finance_secured_amount:   financeSecuredAmount,
      finance_secured_usd:      financeSecuredUSD,
      funding_needed_amount:    fundingNeededAmount,
      funding_needed_usd:       fundingNeededUSD,
      stage: str(formData, "stage") || "development",
      logline,
      synopsis: str(formData, "synopsis") || null,
      director_statement: str(formData, "director_statement") || null,
      producer_info: str(formData, "producer_info") || null,
      pitch_deck_path: str(formData, "pitch_deck_path") || null,
      script_path: str(formData, "script_path") || null,
      poster_path: str(formData, "poster_path") || null,
      has_script_doc: formData.get("has_script_doc") === "true",
      has_budget_doc: formData.get("has_budget_doc") === "true",
      has_lookbook:   formData.get("has_lookbook")   === "true",
      has_coproducer: formData.get("has_coproducer") === "true",
      career_stage: str(formData, "career_stage") || null,
      is_public: formData.get("is_public") !== "false",
      runtime_minutes:  num(formData, "runtime_minutes")   ?? null,
      director_name:    str(formData, "director_name")     || null,
      director_email:   str(formData, "director_email")    || null,
      director_phone:   str(formData, "director_phone")    || null,
      producer_name:    str(formData, "producer_name")     || null,
      producer_company: str(formData, "producer_company")  || null,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  await supabase.from("activity_logs").insert({
    user_id: user.id, action: "project_created", entity: "project", entity_id: data.id,
  });

  // ---------- PITCH.FYLYM ENGINE ----------
  // Runs ONCE, here, at submission time: hybrid matching, funding
  // readiness/discovery/obstacles, financing roadmap, producer matches,
  // AI Executive Producer (OpenAI, falls back to a heuristic if
  // OPENAI_API_KEY is unset or the call fails), and the dream scenario.
  // Cached into `matches` (tiered) and `project_intelligence`. The
  // project page reads from this cache — no recompute, no AI on load.
  const { data: opps } = await supabase.from("opportunities").select("*").eq("is_active", true);
  const { data: project } = await supabase.from("projects").select("*").eq("id", data.id).single();

  if (project) {
    const opportunityExtras: Record<string, OpportunityIntelligenceExtras> = {};
    for (const o of (opps ?? []) as Opportunity[]) {
      if ((o.career_stages?.length ?? 0) > 0 || o.match_weight) {
        opportunityExtras[o.id] = {
          career_stages: o.career_stages?.length ? o.career_stages : undefined,
          match_weight: o.match_weight ?? undefined,
        };
      }
    }

    // Read from producer_profiles (authoritative source — migration 020).
    // profiles.industry_* columns are never populated in the dual-role system
    // (everyone has role='filmmaker') so querying profiles by role returns nothing.
    const { data: ppRows } = await supabase
      .from("producer_profiles")
      .select("user_id, genres, formats, territories, budget_range, festivals, profile:profiles!producer_profiles_user_id_fkey(id, full_name, company)")
      .eq("is_public", true);

    // Map budget_range string → numeric min/max for engine scoring
    const BUDGET_MAP: Record<string, { min: number | null; max: number | null }> = {
      micro: { min: null,        max: 100_000   },
      low:   { min: 100_000,     max: 500_000   },
      mid:   { min: 500_000,     max: 2_000_000 },
      high:  { min: 2_000_000,   max: null      },
    };

    const producerProfiles: ProducerMatchProfile[] = (ppRows ?? []).map((pp: any) => {
      const p = Array.isArray(pp.profile) ? pp.profile[0] : pp.profile;
      const b = BUDGET_MAP[pp.budget_range ?? ""] ?? { min: null, max: null };
      return {
        id:                    pp.user_id,
        full_name:             p?.full_name ?? "Producer",
        company:               p?.company   ?? null,
        role:                  "producer" as const,
        genres:                pp.genres      ?? [],
        formats:               pp.formats     ?? [],
        countries:             pp.territories ?? [],
        min_budget_usd:        b.min,
        max_budget_usd:        b.max,
        available_funding_usd: null,
        festival_track_record: (pp.festivals ?? []).length > 0,
      };
    });

  // ── STEP 1: Basic matching — always fast, always works ───────────────────
  // Write opportunity scores to the DB immediately so the dashboard
  // always shows results even if the AI engine times out or fails.
  if (opps?.length) {
    const { calculateMatchScore } = await import("@/services/matching");
    const basicMatches = (opps as Opportunity[])
      .map((opp) => ({
        ...(() => { const m = calculateMatchScore(project as Project, opp); return {
          project_id: data.id, opportunity_id: opp.id,
          score: m.score, tier: m.tier ?? "possible",
          confidence: "medium", reasons: m.reasons ?? [],
        }; })(),
      }))
      .filter((m) => m.score > 0);

    if (basicMatches.length) {
      await supabase.from("matches").upsert(basicMatches, {
        onConflict: "project_id,opportunity_id",
      });
    }
  }
  }  // end if (project)

  // ── AI engine runs client-side on the project page after redirect ──────────
  // ProjectAnalysisLoader auto-triggers rerunEngine() on mount, showing a
  // live "Analysing…" state. This keeps form submit instant (<1s).

  revalidatePath("/dashboard");
  revalidatePath("/projects");
  revalidatePath("/dashboard/projects");
  if (formData.get("is_public") !== "false") {
    revalidatePath(`/projects/${slug}`);
    revalidatePath("/sitemap.xml");
  }
  // Notify approved producers if project is public
  if (formData.get("is_public") !== "false") {
    await supabase.rpc("broadcast_new_project", { p_project_id: data.id });
  }
  redirect(`/dashboard/projects/${data.id}`);
}

export async function deleteProject(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = str(formData, "project_id");
  await supabase.from("projects").delete().eq("id", id).eq("owner_id", user.id);
  revalidatePath("/dashboard/projects");
  redirect("/dashboard/projects");
}

// ---------- APPLICATIONS ----------
export async function applyToOpportunity(formData: FormData) {
  const { supabase, user } = await requireUser();
  const project_id = str(formData, "project_id");
  const opportunity_id = str(formData, "opportunity_id");
  if (!project_id || !opportunity_id) return { error: "Select a project first." };

  const { data: project } = await supabase.from("projects").select("*").eq("id", project_id).eq("owner_id", user.id).single();
  const { data: opp } = await supabase.from("opportunities").select("*").eq("id", opportunity_id).single();
  if (!project || !opp) return { error: "Project or opportunity not found." };

  const { calculateMatchScore } = await import("@/services/matching");
  const match = calculateMatchScore(project as Project, opp as Opportunity);

  const { error } = await supabase.from("applications").insert({
    project_id, opportunity_id, applicant_id: user.id,
    cover_note: str(formData, "cover_note") || null,
    match_score: match.score,
    filmmaker_stage: "qualified",
  });
  if (error) {
    if (error.code === "23505") return { error: "You have already applied to this opportunity with this project." };
    return { error: error.message };
  }

  await supabase.from("activity_logs").insert({
    user_id: user.id, action: "application_sent", entity: "opportunity", entity_id: opportunity_id,
  });
  revalidatePath("/dashboard/applications");
  redirect("/dashboard/applications");
}

export async function updateFilmmakerStage(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id    = str(formData, "application_id");
  const stage = str(formData, "stage");
  if (!id || !stage) return;
  await supabase
    .from("applications")
    .update({ filmmaker_stage: stage, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("applicant_id", user.id);
  revalidatePath("/dashboard/applications");
}

// ---------- SAVED ----------
export async function toggleSaved(formData: FormData) {
  const { supabase, user } = await requireUser();
  const opportunity_id = str(formData, "opportunity_id");
  const { data: existing } = await supabase
    .from("saved_opportunities").select("opportunity_id")
    .eq("user_id", user.id).eq("opportunity_id", opportunity_id).maybeSingle();
  if (existing) {
    await supabase.from("saved_opportunities").delete().eq("user_id", user.id).eq("opportunity_id", opportunity_id);
  } else {
    await supabase.from("saved_opportunities").insert({ user_id: user.id, opportunity_id });
  }
  revalidatePath("/dashboard/saved");
  revalidatePath("/dashboard/opportunities");
}

// ---------- OFFERS (producers / investors) ----------
export async function makeOffer(formData: FormData) {
  const { supabase, user } = await requireUser();
  const project_id = str(formData, "project_id");
  const message = str(formData, "message");
  if (!message) return { error: "Write a short message with your offer." };

  const { error } = await supabase.from("offers").insert({
    project_id,
    from_user_id: user.id,
    amount_usd: num(formData, "amount_usd"),
    offer_type: str(formData, "offer_type") || "investment",
    message,
  });
  if (error) return { error: "Could not send offer. Producer and investor accounts must be approved by PITCH.FYLYM first." };

  await supabase.from("activity_logs").insert({
    user_id: user.id, action: "offer_made", entity: "project", entity_id: project_id,
  });
  revalidatePath(`/dashboard/discover`);
  return { success: true };
}

export async function respondToOffer(formData: FormData) {
  const { supabase, user } = await requireUser();
  const offer_id = str(formData, "offer_id");
  const decision = str(formData, "decision") === "accepted" ? "accepted" : "declined";

  const { data: offer } = await supabase
    .from("offers").select("id, project_id, from_user_id, projects!inner(owner_id, title)")
    .eq("id", offer_id).single();
  if (!offer) return;
  await supabase.from("offers").update({ status: decision }).eq("id", offer_id);
  await supabase.from("notifications").insert({
    user_id: offer.from_user_id,
    kind: "offer_update",
    title: `Your offer was ${decision}`,
    body: null,
    link: "/producer/projects",
  });
  revalidatePath("/dashboard");
}

// ---------- PROFILE ----------
export async function updateProfile(formData: FormData) {
  const { supabase, user } = await requireUser();
  const avatar_url = str(formData, "avatar_url");
  const { error } = await supabase.from("profiles").update({
    full_name:  str(formData, "full_name"),
    company:    str(formData, "company")  || null,
    country:    str(formData, "country")  || null,
    bio:        str(formData, "bio")      || null,
    website:    str(formData, "website")  || null,
    imdb_url:   str(formData, "imdb_url") || null,
    ...(avatar_url ? { avatar_url } : {}),
  }).eq("id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/profile");
  return { success: true };
}

// ---------- NOTIFICATIONS ----------
export async function markAllRead() {
  const { supabase, user } = await requireUser();
  await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
  revalidatePath("/dashboard/notifications");
}

// ---------- ADMIN ----------
export async function adminSetApproval(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const target = str(formData, "user_id");
  const decision = str(formData, "decision");
  const status = decision === "approved" ? "approved" : "rejected";
  if (!target) return;

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ approval_status: status })
    .eq("id", target);

  if (updateError) {
    console.error("[adminSetApproval] profile update failed:", updateError.message);
    return;
  }

  // Email column is revoked from `authenticated` role (migration 013).
  // Use the profile_email() SECURITY DEFINER function to access it
  // only when the caller is the profile owner or an admin.
  const [{ data: producerProfile }, { data: producerEmail }] = await Promise.all([
    supabase.from("profiles").select("full_name, company").eq("id", target).single(),
    supabase.rpc("profile_email", { target_id: target }),
  ]);

  if (producerEmail) {
    const { sendProducerApprovedEmail, sendProducerDeclinedEmail } = await import("@/lib/email");
    if (status === "approved") {
      await sendProducerApprovedEmail(
        producerEmail as string,
        producerProfile?.full_name ?? "there",
        producerProfile?.company ?? ""
      );
    } else {
      await sendProducerDeclinedEmail(
        producerEmail as string,
        producerProfile?.full_name ?? "there"
      );
    }
  }

  await supabase.from("audit_logs").insert({
    actor_id: user.id, action: `user_${status}`, target: "profile", target_id: target,
  });
  await supabase.from("notifications").insert({
    user_id: target, kind: "system",
    title: status === "approved" ? "Your producer account is approved" : "Your account application was declined",
    body: status === "approved"
      ? "You can now access the Producer Studio, browse all projects and send offers."
      : "Contact support if you believe this was a mistake.",
    link: status === "approved" ? "/producer" : "/",
  });
  revalidatePath("/admin/users");
  revalidatePath("/admin/producers");
  revalidatePath("/producer/pending");  // bust pending page cache
}

export async function adminToggleOpportunity(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const id = str(formData, "opportunity_id");
  const active = str(formData, "active") === "true";
  await supabase.from("opportunities").update({ is_active: active }).eq("id", id);
  await supabase.from("audit_logs").insert({
    actor_id: user.id, action: active ? "opportunity_activated" : "opportunity_deactivated",
    target: "opportunity", target_id: id,
  });
  const { data: toggled } = await supabase
    .from("opportunities").select("slug").eq("id", id).single();
  if ((toggled as any)?.slug) revalidatePath(`/funds/${(toggled as any).slug}`);
  revalidatePath("/admin/opportunities");
  revalidatePath("/funds");
  revalidatePath("/sitemap.xml");
}

// ---------- ADMIN: PROJECT MANAGEMENT ----------
export async function adminToggleProjectVisibility(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const id = str(formData, "project_id");
  const admin_hidden = str(formData, "admin_hidden") === "true";
  await supabase.from("projects").update({ admin_hidden }).eq("id", id);
  await supabase.from("audit_logs").insert({
    actor_id: user.id, action: admin_hidden ? "project_admin_hidden" : "project_admin_unhidden",
    target: "project", target_id: id,
  });
  revalidatePath("/admin/projects");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/projects");
}

export async function adminVerifyProducer(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const target_id = str(formData, "user_id");
  const verify = str(formData, "verify") === "true";
  if (!target_id) return;

  // Only allow verifying an approved producer
  if (verify) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("approval_status")
      .eq("id", target_id)
      .single();
    if (profile?.approval_status !== "approved") return;
  }

  await supabase
    .from("profiles")
    .update({ is_producer_verified: verify })
    .eq("id", target_id);

  // ── Sync producer network listing in opportunities ────────────
  if (verify) {
    // Fetch producer data to build the opportunity entry
    const [{ data: pp }, { data: prof }] = await Promise.all([
      supabase.from("producer_profiles")
        .select("is_public, genres, formats, territories, country")
        .eq("user_id", target_id).single(),
      supabase.from("profiles")
        .select("full_name, company, bio, imdb_url, country")
        .eq("id", target_id).single(),
    ]);

    if (pp?.is_public) {
      const title = (prof as any)?.company || (prof as any)?.full_name || "Independent Producer";
      await supabase.from("opportunities").upsert({
        producer_user_id: target_id,
        created_by: user.id,
        title,
        opp_type: "producer",
        description: (prof as any)?.bio || null,
        country: (pp as any)?.country || (prof as any)?.country || null,
        genres: (pp as any)?.genres ?? [],
        formats: (pp as any)?.formats ?? [],
        languages: (pp as any)?.territories ?? [],
        url: (prof as any)?.imdb_url || null,
        key_person: (prof as any)?.full_name || null,
        is_active: true,
      }, { onConflict: "producer_user_id" });
    }
  } else {
    // Unverify — deactivate the listing without deleting it
    await supabase.from("opportunities")
      .update({ is_active: false })
      .eq("producer_user_id", target_id);
  }

  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: verify ? "producer_verified" : "producer_unverified",
    target: "profile",
    target_id,
  });

  await supabase.from("notifications").insert({
    user_id: target_id,
    kind: "system",
    title: verify ? "Your account has been verified" : "Your verified status has been removed",
    body: verify
      ? "You now have verified producer access, including visibility of private projects."
      : "Your verified producer status has been removed by an administrator.",
    link: "/producer",
  });

  revalidatePath("/admin/producers");
  revalidatePath("/funds");
  revalidatePath("/sitemap.xml");
}

export async function adminDeleteProject(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const id = str(formData, "project_id");
  await supabase.from("projects").delete().eq("id", id);
  await supabase.from("audit_logs").insert({
    actor_id: user.id, action: "project_removed", target: "project", target_id: id,
  });
  revalidatePath("/admin/projects");
}

// ---------- ADMIN: CERTIFICATE MANAGEMENT ----------
export async function adminSetCertificateStatus(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const id = str(formData, "certificate_id");
  const status = str(formData, "status") === "approved" ? "approved" : "rejected";
  const notes = str(formData, "notes") || null;
  await supabase.from("certificates")
    .update({ status, notes, reviewed_by: user.id, reviewed_at: new Date().toISOString() })
    .eq("id", id);
  await supabase.from("audit_logs").insert({
    actor_id: user.id, action: `certificate_${status}`, target: "certificate", target_id: id,
  });
  revalidatePath("/admin/certificates");
}

// ---------- ADMIN: MODERATION ----------
export async function adminResolveReport(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const id = str(formData, "report_id");
  const status = str(formData, "status") === "dismissed" ? "dismissed" : "resolved";
  await supabase.from("reports")
    .update({ status, resolved_by: user.id, resolved_at: new Date().toISOString() })
    .eq("id", id);
  await supabase.from("audit_logs").insert({
    actor_id: user.id, action: `report_${status}`, target: "report", target_id: id,
  });
  revalidatePath("/admin/moderation");
}

export async function adminCreateOpportunity(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const title = str(formData, "title");
  if (!title) return { error: "Title is required." };
  const list = (k: string) => str(formData, k) ? str(formData, k).split(",").map(s => s.trim()).filter(Boolean) : [];

  const { data, error } = await supabase.from("opportunities").insert({
    created_by: user.id,
    title,
    opp_type: str(formData, "opp_type") || "fund",
    description: str(formData, "description") || null,
    country: str(formData, "country") || null,
    region: str(formData, "region") || null,
    genres: list("genres"),
    formats: list("formats"),
    stages: list("stages"),
    languages: list("languages"),
    min_budget_usd: num(formData, "min_budget_usd"),
    max_budget_usd: num(formData, "max_budget_usd"),
    max_award_usd: num(formData, "max_award_usd"),
    deadline: str(formData, "deadline") || null,
    deadline_note: str(formData, "deadline_note") || null,
    url: str(formData, "url") || null,
    app_link: str(formData, "app_link") || null,
    key_person: str(formData, "key_person") || null,
    contact_email: str(formData, "contact_email") || null,
    gender_focus: str(formData, "gender_focus") || null,
    eligible_countries: list("eligible_countries"),
    copro_required: formData.get("copro_required") === "on",
    festival_affiliated: formData.get("festival_affiliated") === "on",
    ott_affiliated: formData.get("ott_affiliated") === "on",
  }).select("id").single();

  if (error) return { error: error.message };
  await supabase.from("audit_logs").insert({
    actor_id: user.id, action: "opportunity_created", target: "opportunity", target_id: data.id,
  });
  // Notify all filmmakers about the new fund
  await supabase.rpc("broadcast_new_fund", { p_opp_id: data.id, p_title: title });
  revalidatePath("/admin/opportunities");
  revalidatePath("/funds");
  revalidatePath("/sitemap.xml");
  redirect("/admin/opportunities");
}

export async function adminUpdateOpportunity(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const id = str(formData, "opportunity_id");
  if (!id) return { error: "Missing opportunity ID." };
  const title = str(formData, "title");
  if (!title) return { error: "Title is required." };
  const list = (k: string) => str(formData, k) ? str(formData, k).split(",").map(s => s.trim()).filter(Boolean) : [];

  const { error } = await supabase.from("opportunities").update({
    title,
    opp_type: str(formData, "opp_type") || "fund",
    description: str(formData, "description") || null,
    country: str(formData, "country") || null,
    region: str(formData, "region") || null,
    genres: list("genres"),
    formats: list("formats"),
    stages: list("stages"),
    languages: list("languages"),
    min_budget_usd: num(formData, "min_budget_usd"),
    max_budget_usd: num(formData, "max_budget_usd"),
    max_award_usd: num(formData, "max_award_usd"),
    deadline: str(formData, "deadline") || null,
    deadline_note: str(formData, "deadline_note") || null,
    url: str(formData, "url") || null,
    app_link: str(formData, "app_link") || null,
    key_person: str(formData, "key_person") || null,
    contact_email: str(formData, "contact_email") || null,
    gender_focus: str(formData, "gender_focus") || null,
    eligible_countries: list("eligible_countries"),
    copro_required: formData.get("copro_required") === "on",
    festival_affiliated: formData.get("festival_affiliated") === "on",
    ott_affiliated: formData.get("ott_affiliated") === "on",
  }).eq("id", id);

  if (error) return { error: error.message };
  await supabase.from("audit_logs").insert({
    actor_id: user.id, action: "opportunity_updated", target: "opportunity", target_id: id,
  });
  // Revalidate the specific fund detail page for instant SEO update
  const { data: updatedOpp } = await supabase
    .from("opportunities").select("slug").eq("id", id).single();
  if ((updatedOpp as any)?.slug) revalidatePath(`/funds/${(updatedOpp as any).slug}`);
  revalidatePath("/admin/opportunities");
  revalidatePath("/funds");
  revalidatePath("/sitemap.xml");
}

// ---------- BOOTSTRAP: SELF-PROMOTE FIRST ADMIN ----------
export async function adminSelfPromote() {
  const { supabase, user } = await requireUser();

  const { count } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin");

  if ((count ?? 0) > 0) {
    redirect("/whoami?error=" + encodeURIComponent("An admin already exists — ask them to promote you, or update your role via SQL."));
  }

  const { error } = await supabase.from("profiles").update({ role: "admin" }).eq("id", user.id);
  if (error) {
    redirect("/whoami?error=" + encodeURIComponent(error.message));
  }

  redirect("/admin");
}

// ---------- ONBOARDING ----------
export async function completeOnboarding(formData: FormData) {
  const { supabase, user } = await requireUser();

  const role = str(formData, "role");
  const full_name = str(formData, "full_name")?.trim();
  const company = str(formData, "company")?.trim() || null;

  const VALID_ROLES = ["filmmaker", "producer"];
  if (!role || !VALID_ROLES.includes(role)) return { error: "Please select your role." };
  if (!full_name) return { error: "Please enter your name." };
  if (role === "producer" && !company) return { error: "Please enter your company name." };

  const { data: { user: authUser } } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("profiles")
    .update({
      role,
      full_name,
      company,
      email: authUser?.email ?? null,  // store for transactional emails
      // Producers need admin approval; filmmakers get instant access
      approval_status: role === "producer" ? "pending" : "approved",
      onboarded_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) return { error: error.message };

  // Notify all admin accounts when a producer signs up for approval
  if (role === "producer") {
    const { data: admins } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", "admin");

    if (admins?.length) {
      await supabase.from("notifications").insert(
        admins.map((admin) => ({
          user_id: admin.id,
          kind: "system",
          title: "New producer application",
          body: `${full_name}${company ? ` from ${company}` : ""} has applied for a producer account and is awaiting your approval.`,
          link: "/admin/producers",
        }))
      );
    }

    // Send confirmation email to the producer
    // user.email is already available from requireUser() — no second getUser() needed
    if (user.email) {
      const { sendProducerApplicationEmail } = await import("@/lib/email");
      await sendProducerApplicationEmail(user.email, full_name, company ?? "");
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/producer");

  // Route to the correct workspace
  if (role === "producer") {
    redirect("/producer/pending");
  }
  redirect("/dashboard");
}

// ---------- PRODUCER CRM ----------

/**
 * Save only the private notes column — never touches status or rating.
 * Called by PrivateNotesForm (client component) to avoid stale-value clobber.
 */
export async function saveProducerNotes(projectId: string, notes: string): Promise<{ error?: string }> {
  "use server";
  try {
    const { supabase, user } = await requireUser();
    if (!projectId) return { error: "Missing project ID" };

    // Ensure a CRM row exists first (upsert default status if none)
    await supabase.from("producer_projects").upsert(
      { producer_id: user.id, project_id: projectId, notes: notes.trim() || null, updated_at: new Date().toISOString() },
      { onConflict: "producer_id,project_id", ignoreDuplicates: false }
    );

    revalidatePath(`/producer/projects/${projectId}`);
    return {};
  } catch (e) {
    return { error: String(e) };
  }
}

export async function upsertProducerProject(formData: FormData) {
  const { supabase, user } = await requireUser();
  const project_id = str(formData, "project_id");
  const status = str(formData, "status") ?? "saved";
  const rating = formData.get("rating") ? Number(formData.get("rating")) : null;
  const notes = str(formData, "notes") ?? null;
  if (!project_id) return;

  const VALID_STATUS = ["saved","shortlisted","in_review","meeting_set","deal_active","passed"];
  if (!VALID_STATUS.includes(status)) return;

  // If the project is private, require verified producer status
  const { data: project } = await supabase
    .from("projects")
    .select("is_public")
    .eq("id", project_id)
    .single();

  if (project && !project.is_public) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_producer_verified, approval_status")
      .eq("id", user.id)
      .single();
    if (!profile?.is_producer_verified || profile?.approval_status !== "approved") return;
  }

  await supabase.from("producer_projects").upsert(
    { producer_id: user.id, project_id, status, rating, notes, updated_at: new Date().toISOString() },
    { onConflict: "producer_id,project_id" }
  );
  // Notify filmmaker that a producer is interested
  await supabase.rpc("notify_producer_interest", { p_project_id: project_id });
  revalidatePath("/producer");
  revalidatePath(`/producer/projects/${project_id}`);
}

export async function requestMeeting(formData: FormData) {
  const { supabase, user } = await requireUser();
  const project_id = str(formData, "project_id");
  const filmmaker_id = str(formData, "filmmaker_id");
  const message = str(formData, "message") ?? null;
  if (!project_id || !filmmaker_id) return;

  const { error } = await supabase.from("meeting_requests").insert({
    producer_id: user.id, filmmaker_id, project_id, message,
  });
  if (!error) {
    await supabase.from("producer_projects").upsert(
      { producer_id: user.id, project_id, status: "meeting_set", updated_at: new Date().toISOString() },
      { onConflict: "producer_id,project_id" }
    );
  }
  revalidatePath("/producer/meetings");
  revalidatePath(`/producer/projects/${project_id}`);
}

export async function updateMeetingStatus(formData: FormData) {
  const { supabase, user } = await requireUser();
  const meeting_id = str(formData, "meeting_id");
  const status = str(formData, "status");
  const meeting_notes = str(formData, "meeting_notes") ?? null;
  if (!meeting_id || !status) return;

  await supabase
    .from("meeting_requests")
    .update({ status, meeting_notes, updated_at: new Date().toISOString() })
    .eq("id", meeting_id)
    .or(`producer_id.eq.${user.id},filmmaker_id.eq.${user.id}`);
  revalidatePath("/producer/meetings");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

// ---------- PRODUCER PROFILES ----------

export async function saveProducerProfile(_prevState: unknown, formData: FormData) {
  const { supabase, user } = await requireUser();

  const genres               = formData.getAll("genres").map(String);
  const formats              = formData.getAll("formats").map(String);
  const territories          = formData.getAll("territories").map(String);
  const festivals            = formData.getAll("festivals").map(String);
  const stage_preferences    = formData.getAll("stage_preferences").map(String);
  const language_preferences = formData.getAll("language_preferences").map(String);
  const funding_roles        = formData.getAll("funding_roles").map(String);
  const contribution_capacity = str(formData, "contribution_capacity") ?? null;

  // New fields from migration 048
  const looking_for        = formData.getAll("looking_for").map(String);
  const accepting_pitches  = formData.get("accepting_pitches") !== "false";
  const response_time      = str(formData, "response_time") || null;
  const years_experience   = formData.get("years_experience") ? Number(formData.get("years_experience")) : null;

  // Update identity on profiles table
  const name        = str(formData, "name");
  const company     = str(formData, "company");
  const avatar_url  = str(formData, "avatar_url");
  const bio         = str(formData, "bio") || null;
  const website     = str(formData, "website") || null;
  const linkedin_url = str(formData, "linkedin_url") || null;

  const profileUpdate: Record<string, unknown> = {};
  if (name)       profileUpdate.full_name   = name;
  if (company !== null && company !== undefined) profileUpdate.company = company;
  if (avatar_url) profileUpdate.avatar_url  = avatar_url;
  if (bio         !== undefined) profileUpdate.bio         = bio;
  if (website     !== undefined) profileUpdate.website     = website;
  if (linkedin_url !== undefined) profileUpdate.linkedin_url = linkedin_url;

  if (Object.keys(profileUpdate).length > 0) {
    await supabase.from("profiles").update(profileUpdate).eq("id", user.id);
  }

  const payload = {
    user_id: user.id,
    contact_email: user.email ?? null,
    country: str(formData, "country") ?? "",
    imdb_url: str(formData, "imdb_url") ?? null,
    genres,
    formats,
    territories,
    budget_range: str(formData, "budget_range") ?? null,
    festivals,
    stage_preferences,
    language_preferences,
    funding_roles,
    contribution_capacity,
    looking_for,
    accepting_pitches,
    response_time,
    years_experience: Number.isFinite(years_experience) ? years_experience : null,
    is_public: formData.get("is_public") === "true",
    updated_at: new Date().toISOString(),
  };


  // Sync matching fields to profiles.industry_* so the engine
  // can score this producer against new project submissions.
  const BUDGET_SYNC: Record<string, { min: number | null; max: number | null }> = {
    micro: { min: null,      max: 100_000   },
    low:   { min: 100_000,   max: 500_000   },
    mid:   { min: 500_000,   max: 2_000_000 },
    high:  { min: 2_000_000, max: null      },
  };
  const budgetKey = str(formData, "budget_range") ?? "";
  const budgetSync = BUDGET_SYNC[budgetKey] ?? { min: null, max: null };

  await supabase.from("profiles").update({
    industry_genres:       genres,
    industry_formats:      formats as any,
    industry_countries:    territories,
    min_budget_usd:        budgetSync.min,
    max_budget_usd:        budgetSync.max,
    festival_track_record: festivals.length > 0,
  }).eq("id", user.id);

  // Check previous is_public state BEFORE the upsert
  const { data: prevPP } = await supabase
    .from("producer_profiles")
    .select("is_public")
    .eq("user_id", user.id)
    .maybeSingle();
  const wasAlreadyPublic = prevPP?.is_public === true;

  await supabase
    .from("producer_profiles")
    .upsert(payload, { onConflict: "user_id" });

  // When a producer goes public for the first time, log for retroactive
  // rematch. New project submissions after this point will pick up this
  // producer automatically via the fixed engine query.
  if (payload.is_public && !wasAlreadyPublic) {
    console.log(`[producer-match] user ${user.id} profile went public — future project submissions will match`);
  }

  // ── Sync producer network listing in opportunities ────────────
  // Only sync if the producer is verified — unverified producers
  // cannot be listed on the public funds page.
  const { data: verifiedCheck } = await supabase
    .from("profiles")
    .select("is_producer_verified, full_name, company, bio, imdb_url, country")
    .eq("id", user.id).single();

  if (verifiedCheck?.is_producer_verified) {
    if (payload.is_public) {
      const title = (verifiedCheck as any).company || (verifiedCheck as any).full_name || "Independent Producer";
      await supabase.from("opportunities").upsert({
        producer_user_id: user.id,
        created_by: user.id,
        title,
        opp_type: "producer",
        description: (verifiedCheck as any).bio || null,
        country: payload.country || (verifiedCheck as any).country || null,
        genres: genres,
        formats: formats,
        languages: territories,
        url: (verifiedCheck as any).imdb_url || null,
        key_person: (verifiedCheck as any).full_name || null,
        is_active: true,
      }, { onConflict: "producer_user_id" });
    } else {
      // Producer unlisted — deactivate without deleting
      await supabase.from("opportunities")
        .update({ is_active: false })
        .eq("producer_user_id", user.id);
    }
    revalidatePath("/funds");
    revalidatePath("/sitemap.xml");
  }

  return { ok: true as const };
}

export async function requestProducerIntroduction(formData: FormData) {
  const { supabase, user } = await requireUser();
  const producer_user_id = str(formData, "producer_user_id");
  const project_id = str(formData, "project_id");
  if (!producer_user_id || !project_id) return;

  // Record the request (ignore duplicate error via upsert)
  await supabase.from("introduction_requests").upsert(
    { filmmaker_id: user.id, producer_user_id, project_id, status: "sent" },
    { onConflict: "filmmaker_id,producer_user_id,project_id" }
  );

  // Notify the filmmaker (project owner)
  try {
    const { data: proj } = await supabase
      .from("projects").select("owner_id, title").eq("id", project_id).single();
    const { data: producer } = await supabase
      .from("profiles").select("full_name, company").eq("id", user.id).single();
    if (proj?.owner_id && proj.owner_id !== user.id) {
      await supabase.from("notifications").insert({
        user_id: proj.owner_id,
        kind:    "producer_interest",
        title:   "Producer interest",
        body:    `${producer?.full_name ?? "A producer"}${producer?.company ? ` (${producer.company})` : ""} requested an introduction for "${proj.title}".`,
        link:    `/dashboard/projects/${project_id}`,
        read:    false,
      });
    }
  } catch (e) {
    console.error("[intro] notification failed:", e);
  }

  // Send email notification to producer — use admin client to read contact_email
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();
    const { data: pp } = await admin
      .from("producer_profiles")
      .select("contact_email, country, genres")
      .eq("user_id", producer_user_id)
      .single();

    const { data: filmmaker } = await supabase
      .from("profiles")
      .select("full_name, company")
      .eq("id", user.id)
      .single();

    const { data: project } = await supabase
      .from("projects")
      .select("title, genre, format, country")
      .eq("id", project_id)
      .single();

    if (pp?.contact_email && project) {
      const { sendIntroductionRequest } = await import("@/lib/email");
      await sendIntroductionRequest({
        to: pp.contact_email,
        filmmakerName: filmmaker?.full_name ?? "A filmmaker",
        filmmakerCompany: filmmaker?.company ?? null,
        projectTitle: project.title,
        projectGenre: project.genre,
        projectCountry: project.country,
      });
    }
  } catch (e) {
    console.error("[requestProducerIntroduction] email failed:", e);
  }

  revalidatePath(`/dashboard/projects/${project_id}`);
}

// ---------- PROJECT LOVES ----------

export async function toggleProjectLove(projectId: string) {
  const { supabase, user } = await requireUser();

  const { data: existing } = await supabase
    .from("project_loves")
    .select("user_id")
    .eq("user_id", user.id)
    .eq("project_id", projectId)
    .single();

  if (existing) {
    await supabase.from("project_loves").delete()
      .eq("user_id", user.id).eq("project_id", projectId);
  } else {
    await supabase.from("project_loves").insert({ user_id: user.id, project_id: projectId });
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
}

// ---------- FILMMAKER CREDITS ----------

export async function saveFilmmakerCredit(formData: FormData) {
  const { supabase, user } = await requireUser();

  const festivals = formData.getAll("festivals").map(String).filter(Boolean);
  const awardsRaw = str(formData, "awards_text") ?? "";
  const awards    = awardsRaw.split("\n").map(s => s.trim()).filter(Boolean);

  const payload = {
    user_id:     user.id,
    title:       str(formData, "title") ?? "",
    year:        formData.get("year") ? Number(formData.get("year")) : null,
    format:      str(formData, "format") ?? null,
    festivals,
    awards,
    is_featured: formData.get("is_featured") === "true",
  };

  const id = str(formData, "credit_id");
  if (id) {
    await supabase.from("filmmaker_credits").update(payload).eq("id", id).eq("user_id", user.id);
  } else {
    await supabase.from("filmmaker_credits").insert(payload);
  }

  revalidatePath("/dashboard/credits");
}

export async function deleteFilmmakerCredit(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = str(formData, "credit_id");
  if (!id) return;
  await supabase.from("filmmaker_credits").delete().eq("id", id).eq("user_id", user.id);
  revalidatePath("/dashboard/credits");
}

export async function updateCareerStage(formData: FormData) {
  const { supabase, user } = await requireUser();
  const career_stage = str(formData, "career_stage");
  await supabase.from("profiles").update({ career_stage }).eq("id", user.id);
  revalidatePath("/dashboard/credits");
}

// ── Username update ────────────────────────────────────────────────────────────
const RESERVED_USERNAMES = new Set([
  "admin","api","dashboard","producer","projects","funds","login","signup",
  "u","auth","support","help","about","terms","privacy","settings","me",
  "home","fylympitch","pitch","fylym","discover","notifications","messages",
]);

export async function updateUsername(_prevState: unknown, formData: FormData) {
  const { supabase, user } = await requireUser();

  const raw = str(formData, "username") ?? "";
  const username = raw.toLowerCase().replace(/[^a-z0-9_]/g, "");

  if (username.length < 3)  return { error: "Username must be at least 3 characters." };
  if (username.length > 30) return { error: "Username must be 30 characters or fewer." };
  if (RESERVED_USERNAMES.has(username)) return { error: "That username is reserved." };

  const { error } = await supabase
    .from("profiles")
    .update({ username })
    .eq("id", user.id);

  if (error?.code === "23505") return { error: "Username already taken — try another." };
  if (error) return { error: error.message };

  revalidatePath("/dashboard/profile");
  return { ok: true as const };
}

// ── PUBLIC OPPORTUNITY SUBMISSION ────────────────────────────────────────────

export async function submitPublicOpportunity(formData: FormData) {
  "use server";
  const { createServiceClient } = await import("@/lib/supabase/service");
  const supabase = createServiceClient();

  const title = str(formData, "title");
  if (!title) return { error: "Title is required." };

  const list = (k: string) =>
    str(formData, k)
      ? str(formData, k).split(",").map((s) => s.trim()).filter(Boolean)
      : [];

  const { error } = await supabase.from("opportunities").insert({
    title,
    opp_type:            str(formData, "opp_type") || "grant",
    description:         str(formData, "description") || null,
    country:             str(formData, "country") || null,
    region:              str(formData, "region") || null,
    url:                 str(formData, "url") || null,
    app_link:            str(formData, "app_link") || null,
    max_award_usd:       num(formData, "max_award_usd"),
    deadline:            str(formData, "deadline") || null,
    deadline_note:       str(formData, "deadline_note") || null,
    genres:              list("genres"),
    formats:             list("formats"),
    stages:              list("stages"),
    eligible_countries:  list("eligible_countries"),
    submitted_by_name:   str(formData, "submitted_by_name") || null,
    submitted_by_email:  str(formData, "submitted_by_email") || null,
    opp_approval_status: "pending",
    is_active:           false,
  });

  if (error) return { error: error.message };
  return { ok: true as const };
}

// ── ADMIN: APPROVE / REJECT SUBMITTED OPPORTUNITY ───────────────────────────

export async function adminApproveOpportunity(formData: FormData) {
  "use server";
  const { supabase, user } = await requireAdmin();
  const id = str(formData, "opportunity_id");
  if (!id) return { error: "Missing ID." };

  const { error } = await supabase
    .from("opportunities")
    .update({ opp_approval_status: "approved", is_active: true })
    .eq("id", id);

  if (error) return { error: error.message };
  await supabase.from("audit_logs").insert({
    actor_id: user.id, action: "opportunity_approved", target: "opportunity", target_id: id,
  });
  revalidatePath("/admin/opportunities");
  revalidatePath("/funds");
}

export async function adminRejectOpportunity(formData: FormData) {
  "use server";
  const { supabase, user } = await requireAdmin();
  const id = str(formData, "opportunity_id");
  if (!id) return { error: "Missing ID." };

  const { error } = await supabase
    .from("opportunities")
    .update({ opp_approval_status: "rejected", is_active: false })
    .eq("id", id);

  if (error) return { error: error.message };
  await supabase.from("audit_logs").insert({
    actor_id: user.id, action: "opportunity_rejected", target: "opportunity", target_id: id,
  });
  revalidatePath("/admin/opportunities");
}
