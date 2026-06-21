"use server";
// app/admin/intelligence/actions.ts
// Server actions for the funding intelligence admin review queue.

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// ── Approve: publish the extracted opportunity ─────────────────
export async function approveReviewItem(
  itemId: string,
  extractedData: Record<string, unknown>,
  sourceUrl: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: me } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") return { error: "Not admin" };

  // Insert the opportunity
  const d = extractedData as Record<string, unknown>;
  const { data: inserted, error: insErr } = await supabase
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

  if (insErr || !inserted) {
    return { error: insErr?.message ?? "Insert failed" };
  }

  // Update queue item to approved
  await supabase
    .from("admin_review_queue")
    .update({
      status:         "approved",
      reviewed_by:    user.id,
      reviewed_at:    new Date().toISOString(),
      opportunity_id: inserted.id,
    })
    .eq("id", itemId);

  // Notify filmmakers
  await supabase.rpc("auto_broadcast_new_fund", {
    p_opp_id:   inserted.id,
    p_title:    String(d.title ?? "New Opportunity"),
    p_opp_type: String(d.opp_type ?? "grant"),
  });

  revalidatePath("/admin/intelligence");
  return {};
}

// ── Reject: discard from queue ─────────────────────────────────
export async function rejectReviewItem(
  itemId: string,
  reason?: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: me } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") return { error: "Not admin" };

  await supabase
    .from("admin_review_queue")
    .update({
      status:       "rejected",
      reviewed_by:  user.id,
      reviewed_at:  new Date().toISOString(),
      reject_reason: reason ?? null,
    })
    .eq("id", itemId);

  revalidatePath("/admin/intelligence");
  return {};
}
