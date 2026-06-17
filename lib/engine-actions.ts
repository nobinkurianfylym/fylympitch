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
    .select("*")
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

  // Build producer profiles
  type IndustryProfileRow = {
    id: string;
    full_name: string;
    company: string | null;
    role: "producer" | "investor" | "organization";
    industry_genres: string[] | null;
    industry_formats: string[] | null;
    industry_countries: string[] | null;
    min_budget_usd: number | null;
    max_budget_usd: number | null;
    available_funding_usd: number | null;
    festival_track_record: boolean | null;
  };

  const { data: industryProfiles } = await supabase
    .from("profiles")
    .select(
      "id, full_name, company, role, industry_genres, industry_formats, industry_countries, min_budget_usd, max_budget_usd, available_funding_usd, festival_track_record"
    )
    .in("role", ["producer", "investor", "organization"])
    .eq("approval_status", "approved");

  const producerProfiles: ProducerMatchProfile[] = (
    (industryProfiles ?? []) as IndustryProfileRow[]
  ).map((p) => ({
    id: p.id,
    full_name: p.full_name,
    company: p.company,
    role: p.role,
    genres: p.industry_genres ?? [],
    formats: p.industry_formats ?? [],
    countries: p.industry_countries ?? [],
    min_budget_usd: p.min_budget_usd,
    max_budget_usd: p.max_budget_usd,
    available_funding_usd: p.available_funding_usd,
    festival_track_record: !!p.festival_track_record,
  }));

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
  return { success: true };
}
