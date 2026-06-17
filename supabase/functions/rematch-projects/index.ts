// supabase/functions/rematch-projects/index.ts
// ============================================================
// Re-match trigger — Supabase Edge Function
//
// Called when a new opportunity is added/activated (via DB trigger
// → rematch_queue table → this function polls or is triggered).
//
// For each pending item in rematch_queue:
//   1. Load the new opportunity
//   2. Load all existing projects
//   3. Run calculateMatchScore for each project
//   4. Upsert new/updated scores into matches
//   5. Send notifications to filmmakers whose score is ≥ 75
//   6. Mark queue item as done
//
// Can also be called directly: POST { opportunity_id } to trigger
// a one-off rematch for a specific opportunity.
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Lightweight match scoring — mirrors matching.ts logic without imports
function calculateScore(project: any, opp: any): number {
  let score = 50; // base

  // Genre match
  if (opp.genres?.includes(project.genre)) score += 12;

  // Format match
  if (opp.formats?.includes(project.format)) score += 10;

  // Country / region match
  if (opp.country === project.country) score += 8;
  if (opp.region && project.country) {
    const regionMap: Record<string, string[]> = {
      "South Asia": ["India", "Pakistan", "Bangladesh", "Sri Lanka", "Nepal"],
      "Southeast Asia": ["Indonesia", "Thailand", "Vietnam", "Philippines", "Malaysia"],
      "East Asia": ["China", "Japan", "South Korea", "Taiwan"],
      "Middle East": ["Qatar", "UAE", "Saudi Arabia", "Jordan", "Lebanon"],
      "Africa": ["Nigeria", "Kenya", "South Africa", "Ghana", "Ethiopia"],
      "Europe": ["France", "Germany", "UK", "Italy", "Spain", "Netherlands", "Sweden", "Denmark", "Norway"],
      "Latin America": ["Brazil", "Mexico", "Argentina", "Colombia", "Chile"],
    };
    if (regionMap[opp.region]?.includes(project.country)) score += 6;
  }

  // Language
  if (opp.languages?.includes(project.language)) score += 6;

  // Stage
  if (opp.stages?.includes(project.stage)) score += 8;

  // Budget fit
  if (project.budget_usd && opp.min_budget_usd && opp.max_budget_usd) {
    if (project.budget_usd >= opp.min_budget_usd && project.budget_usd <= opp.max_budget_usd) {
      score += 8;
    }
  }

  // Career stage bonus
  if (opp.career_stages?.length && project.career_stage) {
    if (opp.career_stages.some((cs: string) => cs.toLowerCase() === project.career_stage?.toLowerCase())) {
      score += 6;
    }
  }

  // Match weight multiplier
  const weightMult: Record<string, number> = { high: 1.08, medium: 1.0, low: 0.92 };
  if (opp.match_weight) score = Math.round(score * (weightMult[opp.match_weight] ?? 1));

  return Math.min(100, Math.max(0, score));
}

function tierOf(score: number): string {
  if (score >= 80) return "strong";
  if (score >= 65) return "possible";
  if (score >= 50) return "worth_watching";
  return "hidden";
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.includes(SERVICE_KEY.slice(-8))) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  let body: any = {};
  try { body = await req.json(); } catch {}

  // If a specific opportunity_id is passed, process just that one
  // Otherwise, process all pending items from rematch_queue
  const opportunityIds: string[] = [];

  if (body.opportunity_id) {
    opportunityIds.push(body.opportunity_id);
  } else {
    // Process up to 10 pending queue items
    const { data: queue } = await supabase
      .from("rematch_queue")
      .select("id, opportunity_id")
      .eq("status", "pending")
      .order("created_at")
      .limit(10);

    if (!queue?.length) {
      return new Response(JSON.stringify({ ok: true, processed: 0 }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Mark as processing
    await supabase
      .from("rematch_queue")
      .update({ status: "processing" })
      .in("id", queue.map((q) => q.id));

    opportunityIds.push(...queue.map((q) => q.opportunity_id));
  }

  let totalMatches = 0;
  let totalNotifications = 0;

  for (const oppId of opportunityIds) {
    try {
      // Load opportunity
      const { data: opp } = await supabase
        .from("opportunities")
        .select("*")
        .eq("id", oppId)
        .single();

      if (!opp || !opp.is_active) continue;

      // Load all projects
      const { data: projects } = await supabase
        .from("projects")
        .select("id, owner_id, title, genre, format, language, country, stage, budget_usd, career_stage");

      if (!projects?.length) continue;

      // Score all projects against this opportunity
      const newMatches = [];
      const notificationTargets = [];

      for (const project of projects) {
        const score = calculateScore(project, opp);
        const tier = tierOf(score);

        if (score > 0) {
          newMatches.push({
            project_id: project.id,
            opportunity_id: oppId,
            score,
            tier,
            confidence: score >= 75 ? "high" : "medium",
            reasons: [],
          });
          totalMatches++;

          // Notify filmmakers with strong/possible matches
          if (score >= 75) {
            notificationTargets.push({
              user_id: project.owner_id,
              kind: "match",
              title: "New funding match",
              body: `"${opp.title}" matches "${project.title}" with a score of ${score}/100.${opp.deadline ? ` Deadline: ${new Date(opp.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric" })}.` : ""}`,
              link: `/dashboard/projects/${project.id}`,
            });
            totalNotifications++;
          }
        }
      }

      // Upsert matches
      if (newMatches.length) {
        await supabase.from("matches").upsert(newMatches, {
          onConflict: "project_id,opportunity_id",
        });
      }

      // Insert notifications (de-dupe by not inserting if same user+opp notified recently)
      if (notificationTargets.length) {
        await supabase.from("notifications").insert(notificationTargets);
      }

      // Mark queue item done
      if (!body.opportunity_id) {
        await supabase
          .from("rematch_queue")
          .update({ status: "done", processed_at: new Date().toISOString() })
          .eq("opportunity_id", oppId)
          .eq("status", "processing");
      }

    } catch (err: any) {
      console.error(`[rematch-projects] Failed for opp ${oppId}:`, err);
      if (!body.opportunity_id) {
        await supabase
          .from("rematch_queue")
          .update({ status: "failed" })
          .eq("opportunity_id", oppId)
          .eq("status", "processing");
      }
    }
  }

  return new Response(
    JSON.stringify({ ok: true, matches_written: totalMatches, notifications_sent: totalNotifications }),
    { headers: { "Content-Type": "application/json" } }
  );
});
