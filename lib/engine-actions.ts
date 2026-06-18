"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { calculateMatchScore } from "@/services/matching";
import type { OpportunityIntelligenceExtras, ProducerMatchProfile } from "@/services/fylympitchEngine";
import type { Opportunity, Project } from "@/types";

export async function rerunEngine(
  projectId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated" };

  // Verify ownership
  const { data: project } = await supabase
    .from("projects")
    .select("*, profiles!projects_owner_id_fkey(full_name)")
    .eq("id", projectId)
    .eq("owner_id", user.id)
    .single();

  if (!project) return { success: false, error: "Project not found or not yours" };

  const { data: opps } = await supabase
    .from("opportunities")
    .select("*")
    .eq("is_active", true);

  // Build opportunity extras
  const opportunityExtras: Record<string, OpportunityIntelligenceExtras> = {};
  for (const o of (opps ?? []) as Opportunity[]) {
    if ((o.career_stages?.length ?? 0) > 0 || o.match_weight) {
      opportunityExtras[o.id] = {
        career_stages: o.career_stages?.length ? o.career_stages : undefined,
        match_weight: o.match_weight ?? undefined,
      };
    }
  }

  // Build producer profiles from producer_profiles table (new system)
  type ProducerProfileRow = {
    user_id: string;
    genres: string[] | null;
    formats: string[] | null;
    territories: string[] | null;
    budget_range: string | null;
    festivals: string[] | null;
    open_to_coproduction: boolean | null;
    open_to_ep: boolean | null;
    profiles: { full_name: string; company: string | null; avatar_url: string | null } | null;
  };

  const { data: ppRows } = await supabase
    .from("producer_profiles")
    .select("user_id, genres, formats, territories, budget_range, festivals, open_to_coproduction, open_to_ep, profiles!producer_profiles_user_id_fkey(full_name, company, avatar_url)")
    .eq("is_public", true);

  const BUDGET_RANGES: Record<string, [number, number]> = {
    micro: [0, 100_000],
    low:   [100_000, 500_000],
    mid:   [500_000, 2_000_000],
    high:  [2_000_000, 50_000_000],
  };

  const producerProfiles: ProducerMatchProfile[] = (
    (ppRows ?? []) as ProducerProfileRow[]
  ).map((p) => {
    const profile = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
    const [min, max] = p.budget_range ? (BUDGET_RANGES[p.budget_range] ?? [null, null]) : [null, null];
    return {
      id: p.user_id,
      full_name: profile?.full_name ?? "Unknown",
      company: profile?.company ?? null,
      avatar_url: profile?.avatar_url ?? null,
      role: "producer" as const,
      genres: p.genres ?? [],
      formats: p.formats ?? [],
      countries: p.territories ?? [],
      min_budget_usd: min,
      max_budget_usd: max,
      available_funding_usd: null,
      festival_track_record: (p.festivals?.length ?? 0) > 0,
    };
  });

  // ── STEP 1: Basic matching — written immediately ─────────────────────────
  if (opps?.length) {
    const basicMatches = (opps as Opportunity[])
      .map((opp) => ({
        ...(() => { const m = calculateMatchScore(project as Project, opp); return {
          project_id: projectId, opportunity_id: opp.id,
          score: m.score, tier: m.tier ?? "possible",
          confidence: "medium" as const, reasons: m.reasons ?? [],
        }; })(),
      }))
      .filter((m) => m.score > 0);

    if (basicMatches.length) {
      await supabase.from("matches").upsert(basicMatches, {
        onConflict: "project_id,opportunity_id",
      });
    }
  }

  // ── STEP 2: Full AI engine ────────────────────────────────────────────────
  try {
    const { runAIEnhancedEngine } = await import("@/services/aiEngine");

    const engine = await Promise.race([
      runAIEnhancedEngine({
        project: project as Project,
        opportunities: (opps ?? []) as Opportunity[],
        opportunityExtras,
        producerProfiles,
        cerebrasApiKey: process.env.CEREBERAS_API,
        groqApiKey: process.env.GROQ_API_KEY,
        openaiApiKey: process.env.OPENAI_API_KEY,
        useWebSearch: process.env.OPENAI_WEB_SEARCH === "true",
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Engine timeout")), 40_000)
      ),
    ]);

    if (engine.matches.length) {
      await supabase.from("matches").upsert(
        engine.matches.map((m) => ({
          project_id: projectId,
          opportunity_id: m.opportunity.id,
          score: m.match.score,
          tier: m.match.tier,
          confidence: m.match.confidence,
          reasons: m.match.reasons,
        })),
        { onConflict: "project_id,opportunity_id" }
      );
    }

    await supabase.from("project_intelligence").upsert({
      project_id: projectId,
      funding_readiness: engine.funding_readiness,
      funding_discovery: engine.funding_discovery,
      obstacles: engine.obstacles,
      roadmap: engine.roadmap,
      producer_matches: engine.producer_matches,
      executive_producer: engine.executive_producer,
      dream_scenario: engine.dream_scenario,
      project_profile: (engine as any).project_profile ?? {},
      semantic_matches: (engine as any).semantic_matches ?? [],
      ai_obstacles: (engine as any).ai_obstacles ?? [],
      market_intelligence: (engine as any).market_intelligence ?? {},
      enhanced_ep_brief: (engine as any).enhanced_ep_brief ?? {},
      engine_version: (engine as any).engine_version ?? "v1_hybrid",
      generated_by: engine.executive_producer.generated_by,
      generated_at: engine.generated_at,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Engine failed";
    console.error("[rerunEngine]", err);
    revalidatePath(`/dashboard/projects/${projectId}`);
    return {
      success: false,
      error: `${msg} — basic matches saved, AI analysis incomplete`,
    };
  }

  // ── EP Brief: fire-and-forget ─────────────────────────────────────────────
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (supabaseUrl && serviceKey) {
    await supabase
      .from("project_intelligence")
      .update({ ep_brief_status: "pending" })
      .eq("project_id", projectId);

    fetch(`${supabaseUrl}/functions/v1/ep-brief`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ project_id: projectId }),
    }).catch((err) =>
      console.error("[rerunEngine] EP Brief edge fn failed:", err)
    );
  }

  revalidatePath(`/dashboard/projects/${projectId}`);
  revalidatePath("/dashboard");

  // Fire "engine ready" email — non-blocking
  try {
    const { sendEngineReady } = await import("@/lib/email");
    await sendEngineReady({
      to: user.email!,
      filmmakerName: (project as any).profiles?.full_name ?? project.owner_id,
      projectTitle: (project as Project).title,
      projectId,
    });
  } catch (e) {
    console.error("[engine] email failed:", e);
  }

  // Write in-app notification
  try {
    await supabase.from("notifications").insert({
      user_id: user.id,
      kind:    "match_found",
      title:   "Intelligence report ready",
      body:    `Your FYLYMPITCH report for "${(project as Project).title}" is ready.`,
      link:    `/dashboard/projects/${projectId}`,
      read:    false,
    });
  } catch (e) {
    console.error("[engine] notification failed:", e);
  }

  return { success: true };
}
