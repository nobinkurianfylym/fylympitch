// supabase/functions/ep-brief/index.ts
// ============================================================
// Async EP Brief generator — Supabase Edge Function
//
// Called fire-and-forget from createProject() after the base
// engine has already saved matches and core intelligence.
//
// Flow:
//   1. Receive { project_id } in POST body
//   2. Load project + top matches from DB
//   3. Call OpenAI gpt-4o-mini (with web_search_preview if enabled)
//   4. Upsert result into project_intelligence
//   5. Mark ep_brief_status = 'done'
//
// The results page checks ep_brief_status and shows a skeleton
// until this function completes (usually 3-8 seconds).
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_KEY   = Deno.env.get("OPENAI_API_KEY");
const USE_WEB_SEARCH = Deno.env.get("OPENAI_WEB_SEARCH") === "true";

const EP_SYSTEM_PROMPT = `You are FYLYMPITCH's AI Executive Producer — a senior film finance specialist 
with deep knowledge of international co-production, festival strategy, and independent film funding.

Given a film project and its ranked funding matches, respond with STRICT JSON only:
{
  "next_best_move": {
    "title": string,
    "opportunity_id": string | null,
    "funding_range": string,
    "deadline_days": number | null,
    "success_chance": number,
    "action_label": string
  },
  "summary": string,
  "strategic_notes": string,
  "immediate_actions": [
    { "priority": "critical"|"high"|"medium", "title": string, "description": string }
  ]
}

Rules:
- "summary": 2–3 direct, specific sentences about this project's funding position
- "strategic_notes": 1–2 sentences on the single most important strategic move
- "immediate_actions": 2–3 concrete actions the filmmaker should take this week
- Pick "next_best_move" from the provided top_matches (use its id as opportunity_id)
- If no suitable match exists, set opportunity_id to null and recommend a profile improvement
- Be specific about THIS project — not generic filmmaking advice`;

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Auth check — only internal calls with service role
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.includes(SERVICE_KEY.slice(-8))) {
    return new Response("Unauthorized", { status: 401 });
  }

  let project_id: string;
  try {
    const body = await req.json();
    project_id = body.project_id;
    if (!project_id) throw new Error("missing project_id");
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  // Mark as processing
  await supabase
    .from("project_intelligence")
    .update({ ep_brief_status: "processing" })
    .eq("project_id", project_id);

  try {
    // Load project
    const { data: project } = await supabase
      .from("projects")
      .select("*")
      .eq("id", project_id)
      .single();

    if (!project) throw new Error("project not found");

    // Load top 10 matches with opportunity details
    const { data: matches } = await supabase
      .from("matches")
      .select("score, tier, reasons, opportunities!inner(*)")
      .eq("project_id", project_id)
      .order("score", { ascending: false })
      .limit(10);

    const topMatches = (matches ?? []).map((m: any) => ({
      id: m.opportunities.id,
      title: m.opportunities.title,
      type: m.opportunities.opp_type,
      score: m.score,
      tier: m.tier,
      max_award_usd: m.opportunities.max_award_usd,
      deadline: m.opportunities.deadline,
      deadline_days: m.opportunities.deadline
        ? Math.ceil((new Date(m.opportunities.deadline).getTime() - Date.now()) / 86_400_000)
        : null,
      description: m.opportunities.description?.slice(0, 400) ?? "",
      reasons: m.reasons ?? [],
    }));

    // Load existing intelligence for obstacles context
    const { data: intel } = await supabase
      .from("project_intelligence")
      .select("obstacles, ai_obstacles")
      .eq("project_id", project_id)
      .single();

    const obstacles = [
      ...(intel?.ai_obstacles ?? []),
      ...(intel?.obstacles ?? []),
    ].slice(0, 5).map((o: any) => o.label || o.ai_insight || o);

    if (!OPENAI_KEY) {
      // No API key — write heuristic brief and mark done
      const top = topMatches[0];
      const heuristic = {
        next_best_move: {
          title: top ? `Apply to ${top.title}` : "Complete your project profile",
          opportunity_id: top?.id ?? null,
          funding_range: top?.max_award_usd ? `Up to $${(top.max_award_usd / 1000).toFixed(0)}K` : "—",
          deadline_days: top?.deadline_days ?? null,
          success_chance: top?.score ?? 0,
          action_label: top ? "Apply" : "Edit project",
        },
        summary: top
          ? `"${project.title}" scores ${top.score}/100 against "${top.title}", its strongest current match. ${obstacles.length ? `Addressing "${obstacles[0]}" would improve eligibility across similar opportunities.` : "The project profile is well-positioned."}`
          : `"${project.title}" needs more profile information to match against active opportunities. Complete budget, funding need, and synopsis to improve match quality.`,
        strategic_notes: top ? `Focus on ${top.title} immediately — it closes in ${top.deadline_days ?? "upcoming"} days.` : "Complete your project profile to unlock matches.",
        immediate_actions: [],
        generated_by: "heuristic",
      };

      await supabase.from("project_intelligence").update({
        executive_producer: heuristic,
        enhanced_ep_brief: heuristic,
        ep_brief_status: "done",
      }).eq("project_id", project_id);

      return new Response(JSON.stringify({ ok: true, generated_by: "heuristic" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // ── Call OpenAI ───────────────────────────────────────────────────────────
    const messages: any[] = [
      { role: "system", content: EP_SYSTEM_PROMPT },
      {
        role: "user",
        content: JSON.stringify({
          project: {
            title: project.title,
            genre: project.genre,
            format: project.format,
            stage: project.stage,
            country: project.country,
            language: project.language,
            budget_usd: project.budget_usd,
            funding_needed_usd: project.funding_needed_usd,
            logline: project.logline,
            synopsis: project.synopsis?.slice(0, 800) ?? null,
          },
          top_matches: topMatches,
          current_obstacles: obstacles,
        }),
      },
    ];

    // Use Responses API with web_search_preview if enabled
    let briefData: any;
    if (USE_WEB_SEARCH) {
      const res = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_KEY}` },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          tools: [{ type: "web_search_preview" }],
          input: messages,
        }),
      });
      if (!res.ok) throw new Error(`OpenAI Responses API ${res.status}`);
      const data = await res.json();
      const text = data.output?.find((b: any) => b.type === "message")?.content
        ?.find((c: any) => c.type === "output_text")?.text ?? "{}";
      // Extract JSON from potential prose
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      briefData = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    } else {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_KEY}` },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          response_format: { type: "json_object" },
          temperature: 0.35,
          messages,
        }),
      });
      if (!res.ok) throw new Error(`OpenAI ${res.status}`);
      const data = await res.json();
      briefData = JSON.parse(data.choices[0].message.content);
    }

    const epBrief = {
      ...briefData,
      generated_by: USE_WEB_SEARCH ? "openai_websearch" : "openai",
    };

    // Upsert into project_intelligence
    await supabase.from("project_intelligence").update({
      executive_producer: epBrief,
      enhanced_ep_brief: epBrief,
      ep_brief_status: "done",
    }).eq("project_id", project_id);

    return new Response(JSON.stringify({ ok: true, generated_by: epBrief.generated_by }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("[ep-brief]", err);
    await supabase.from("project_intelligence").update({
      ep_brief_status: "failed",
    }).eq("project_id", project_id);
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
