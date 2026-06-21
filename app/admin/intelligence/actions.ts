"use server";
// app/admin/intelligence/actions.ts
// Approve: upsert (update if exists, insert if new) + notify.
// Reject: mark as rejected.

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

async function assertAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", supabase: null, userId: null };
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") return { error: "Not admin", supabase: null, userId: null };
  return { error: null, supabase, userId: user.id };
}

// ── Upsert helper: update if exists, insert if new ─────────────
async function upsertOpportunity(
  supabase: Awaited<ReturnType<typeof createClient>>,
  d: Record<string, unknown>,
  sourceUrl: string,
): Promise<{ id: string; action: "inserted" | "updated" } | { error: string }> {

  // 1. Check by source_url
  const { data: byUrl } = await supabase
    .from("opportunities")
    .select("id, version_number")
    .eq("source_url", sourceUrl)
    .maybeSingle();

  // 2. Check by title if no source_url match
  const { data: byTitle } = !byUrl ? await supabase
    .from("opportunities")
    .select("id, version_number")
    .ilike("title", String(d.title ?? ""))
    .maybeSingle() : { data: null };

  const existing = byUrl ?? byTitle;

  if (existing) {
    // UPDATE existing record
    const newVersion = (existing.version_number ?? 1) + 1;
    const { error } = await supabase.from("opportunities").update({
      description:         d.description,
      deadline:            d.deadline ?? null,
      deadline_note:       d.deadline_note ?? null,
      max_award_usd:       d.max_award_usd ?? null,
      min_budget_usd:      d.min_budget_usd ?? null,
      app_link:            d.app_link ?? null,
      url:                 d.url ?? sourceUrl,
      is_active:           d.is_active ?? true,
      submission_status:   d.submission_status ?? "open",
      genres:              d.genres ?? [],
      formats:             d.formats ?? [],
      stages:              d.stages ?? [],
      languages:           d.languages ?? [],
      career_stages:       d.career_stages ?? [],
      gender_focus:        d.gender_focus ?? null,
      copro_required:      d.copro_required ?? false,
      festival_affiliated: d.festival_affiliated ?? false,
      match_weight:        d.match_weight ?? "medium",
      organization_name:   d.organization_name ?? null,
      source_url:          sourceUrl,
      last_verified_at:    new Date().toISOString(),
      version_number:      newVersion,
      auto_crawled:        true,
      crawl_confidence:    d.confidence ?? null,
    }).eq("id", existing.id);

    if (error) return { error: error.message };

    await supabase.from("opportunity_versions").insert({
      opportunity_id:  existing.id,
      version_number:  newVersion,
      changed_fields:  ["admin_approved"],
      previous_values: {},
      new_values:      d,
      change_source:   "admin_edit",
    });

    return { id: existing.id, action: "updated" };
  }

  // INSERT new record
  const { data: inserted, error } = await supabase
    .from("opportunities")
    .insert({
      title:               d.title,
      opp_type:            d.opp_type ?? "grant",
      description:         d.description,
      country:             d.country ?? null,
      region:              d.region ?? null,
      genres:              d.genres ?? [],
      formats:             d.formats ?? [],
      stages:              d.stages ?? [],
      languages:           d.languages ?? [],
      career_stages:       d.career_stages ?? [],
      max_award_usd:       d.max_award_usd ?? null,
      min_budget_usd:      d.min_budget_usd ?? null,
      max_budget_usd:      d.max_budget_usd ?? null,
      deadline:            d.deadline ?? null,
      deadline_note:       d.deadline_note ?? null,
      app_link:            d.app_link ?? null,
      url:                 d.url ?? sourceUrl,
      is_active:           d.is_active ?? true,
      submission_status:   d.submission_status ?? "open",
      gender_focus:        d.gender_focus ?? null,
      copro_required:      d.copro_required ?? false,
      festival_affiliated: d.festival_affiliated ?? false,
      match_weight:        d.match_weight ?? "medium",
      organization_name:   d.organization_name ?? null,
      source_url:          sourceUrl,
      last_verified_at:    new Date().toISOString(),
      version_number:      1,
      auto_crawled:        true,
      crawl_confidence:    d.confidence ?? null,
    })
    .select("id")
    .single();

  if (error || !inserted) return { error: error?.message ?? "Insert failed" };

  await supabase.from("opportunity_versions").insert({
    opportunity_id:  inserted.id,
    version_number:  1,
    changed_fields:  ["*"],
    previous_values: {},
    new_values:      d,
    change_source:   "admin_edit",
  });

  return { id: inserted.id, action: "inserted" };
}

// ── Approve ────────────────────────────────────────────────────
export async function approveReviewItem(
  itemId: string,
  extractedData: Record<string, unknown>,
  sourceUrl: string,
): Promise<{ error?: string }> {
  const { error: authErr, supabase, userId } = await assertAdmin();
  if (authErr || !supabase || !userId) return { error: authErr! };

  const result = await upsertOpportunity(supabase, extractedData, sourceUrl);
  if ("error" in result) return { error: result.error };

  const { id: opportunityId, action } = result;

  // Mark queue item approved
  await supabase.from("admin_review_queue").update({
    status:         "approved",
    reviewed_by:    userId,
    reviewed_at:    new Date().toISOString(),
    opportunity_id: opportunityId,
  }).eq("id", itemId);

  // Only notify filmmakers for genuinely new inserts
  if (action === "inserted") {
    await supabase.rpc("auto_broadcast_new_fund", {
      p_opp_id:   opportunityId,
      p_title:    String(extractedData.title ?? "New Opportunity"),
      p_opp_type: String(extractedData.opp_type ?? "grant"),
    });
  }

  revalidatePath("/admin/intelligence");
  return {};
}

// ── Reject ─────────────────────────────────────────────────────
export async function rejectReviewItem(
  itemId: string,
  reason?: string,
): Promise<{ error?: string }> {
  const { error: authErr, supabase, userId } = await assertAdmin();
  if (authErr || !supabase || !userId) return { error: authErr! };

  await supabase.from("admin_review_queue").update({
    status:        "rejected",
    reviewed_by:   userId,
    reviewed_at:   new Date().toISOString(),
    reject_reason: reason ?? null,
  }).eq("id", itemId);

  revalidatePath("/admin/intelligence");
  return {};
}
