// ============================================================
// FYLYMPITCH AI ENGINE  —  services/aiEngine.ts
//
// Wraps the existing rule-based engine (fylympitchEngine.ts)
// with an AI semantic layer. Architecture:
//
//  1. Rule-based engine runs first (fast, deterministic, always works).
//  2. AI analyses the PROJECT NARRATIVE (logline + synopsis + director's
//     statement) to extract themes, tone, cultural specificity, market
//     positioning, comparable films, and career signals.
//  3. AI analyses the TOP 20 MATCHED OPPORTUNITIES (those scoring ≥60
//     from the rule pass). Only the already-filtered shortlist goes to AI
//     — not all 116 — so API cost stays low.
//  4. AI produces SEMANTIC MATCH SCORES for each shortlisted opportunity
//     in a single batched call, then blends them with the rule score:
//       hybrid = rule * 0.6  +  semantic * 0.4
//     The weight shifts toward AI (50/50) when the project has a rich
//     narrative (synopsis + director's statement both present).
//  5. AI detects NARRATIVE OBSTACLES — things the rule-based pass misses
//     because they live in the text: weak logline structure, no cultural
//     context for international funds, budget framing issues.
//  6. ENHANCED EP BRIEF is generated with full context: project profile,
//     all hybrid-ranked matches with semantic insights, obstacles, and
//     (if OPENAI_WEB_SEARCH=true) live deadline verification via the
//     OpenAI Responses API with web_search_preview.
//  7. MARKET INTELLIGENCE: positioning statement, comparable films,
//     timing assessment, recommended festivals and markets.
//
//  Graceful degradation:
//  - No API key  → returns base engine result unchanged (no AI fields).
//  - AI call fails → that section falls back to empty/heuristic values;
//    the rest of the page continues to render from the rule-based data.
//  - Web search disabled or fails → EP brief uses training-data knowledge.
//
//  Called from: lib/actions.ts createProject(), replacing the
//  runFylympitchEngine() call with runAIEnhancedEngine().
// ============================================================

import type { Project, Opportunity, MatchResult } from "@/types";
import {
  runFylympitchEngine,
  type FylympitchEngineInput,
  type FylympitchEngineResult,
  type FundingObstacle,
} from "./fylympitchEngine.ts";

// ── Types ────────────────────────────────────────────────────

export interface ProjectSemanticProfile {
  themes: string[];
  tone: string[];
  cultural_specificity: string;
  career_signals: string[];
  market_positioning: string;
  comparable_films: string[];
  funding_gaps: string[];
  strategic_notes: string;
}

export interface OpportunitySemanticProfile {
  opportunity_id: string;
  thematic_preferences: string[];
  cultural_affinities: string[];
  career_stage_preference: string;
  narrative_preferences: string[];
  eligibility_nuances: string[];
  strategic_value: string;
}

export interface SemanticMatch {
  opportunity_id: string;
  semantic_score: number;        // 0–100
  alignment_reason: string;      // one sentence: why it fits
  strategic_insight: string;     // one sentence: what to do about it
}

export interface ImmediateAction {
  priority: "critical" | "high" | "medium";
  title: string;
  description: string;
  deadline: string | null;
  opportunity_id: string | null;
}

export interface EnhancedEPBrief {
  strategic_summary: string;
  immediate_actions: ImmediateAction[];
  six_month_roadmap: string;
  key_relationships: string[];
  market_positioning: string;
  generated_by: "openai" | "heuristic";
}

export interface AIObstacle {
  id: string;
  label: string;
  severity: "high" | "medium" | "low";
  ai_insight: string;            // narrative-derived, not just field-based
  action_label: string;
  action_href: string;
}

export interface MarketIntelligence {
  positioning_statement: string;
  timing_assessment: string;
  recommended_markets: string[];
  comparable_films: string[];
  competitive_landscape: string;
}

export interface EnhancedMatch {
  opportunity: Opportunity;
  match: MatchResult;
  semantic: SemanticMatch | null;
  hybrid_score: number;          // blended final score used for ranking
}

export interface AIEngineResult extends FylympitchEngineResult {
  // Override matches with hybrid-scored version
  matches: EnhancedMatch[];
  // AI-only fields
  project_profile: ProjectSemanticProfile;
  semantic_matches: SemanticMatch[];
  enhanced_ep_brief: EnhancedEPBrief;
  ai_obstacles: AIObstacle[];
  market_intelligence: MarketIntelligence;
  engine_version: "v2_ai_hybrid" | "v1_hybrid";
}

// ── OpenAI helpers ───────────────────────────────────────────

const COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";
const RESPONSES_URL   = "https://api.openai.com/v1/responses";   // Responses API (web search)
const MODEL_FAST      = "gpt-4o-mini";                            // analysis + matching
const MODEL_SEARCH    = "gpt-4o-mini-search-preview";             // EP brief + web search

interface Message { role: "system" | "user" | "assistant"; content: string; }

async function callCompletions(
  messages: Message[],
  apiKey: string,
  maxTokens = 2000
): Promise<string> {
  try {
    const res = await fetch(COMPLETIONS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: MODEL_FAST, max_tokens: maxTokens, messages }),
    });
    if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? "";
  } catch (e) {
    console.error("[aiEngine] completions error:", e);
    return "";
  }
}

async function callWithWebSearch(prompt: string, apiKey: string): Promise<string> {
  try {
    const res = await fetch(RESPONSES_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: MODEL_SEARCH,
        tools: [{ type: "web_search_preview" }],
        input: prompt,
        max_output_tokens: 3000,
      }),
    });
    if (!res.ok) throw new Error(`OpenAI Responses HTTP ${res.status}`);
    const data = await res.json();
    // Responses API returns output array
    const text = (data.output ?? [])
      .find((item: any) => item.type === "message")
      ?.content?.find((c: any) => c.type === "output_text")
      ?.text ?? "";
    return text;
  } catch (e) {
    console.error("[aiEngine] web search error:", e);
    return "";
  }
}

function safeJSON<T>(raw: string, fallback: T): T {
  try {
    const clean = raw.replace(/```json|```/g, "").trim();
    const start = clean.search(/[\[{]/);
    if (start < 0) return fallback;
    return JSON.parse(clean.slice(start)) as T;
  } catch {
    return fallback;
  }
}

// ── Step 1: Analyse the project narrative ────────────────────

async function analyzeProject(
  project: Project,
  apiKey: string
): Promise<ProjectSemanticProfile> {
  const hasNarrative = !!(project.synopsis || project.director_statement);

  const prompt = `You are a senior film financing consultant. Read this project and extract a semantic profile for funding matching. Be specific and actionable — avoid generic descriptions.

TITLE: ${project.title}
GENRE: ${project.genre} | FORMAT: ${project.format} | COUNTRY: ${project.country} | LANGUAGE: ${project.language}
STAGE: ${project.stage} | BUDGET: $${project.budget_usd?.toLocaleString() ?? "unspecified"} | SEEKING: $${project.funding_needed_usd?.toLocaleString() ?? "unspecified"}
LOGLINE: ${project.logline}
SYNOPSIS: ${project.synopsis ?? "(not provided)"}
DIRECTOR'S STATEMENT: ${project.director_statement ?? "(not provided)"}
PRODUCER INFO: ${project.producer_info ?? "(not provided)"}

Return ONLY valid JSON with this structure:
{
  "themes": ["3-6 specific thematic territories, e.g. 'coastal community erasure' not just 'community'"],
  "tone": ["2-4 tonal qualities e.g. 'intimate social realism', 'magical naturalism'"],
  "cultural_specificity": "exact cultural context in one sentence, naming specific traditions/places/communities",
  "career_signals": ["signals about filmmaker's career stage — debut, emerging, mid-career, etc."],
  "market_positioning": "one precise sentence: where this fits in the current international festival/market landscape",
  "comparable_films": ["2-3 real films that secured similar funding — be specific, name actual films"],
  "funding_gaps": ["specific things missing that would strengthen funding applications"],
  "strategic_notes": "one paragraph of strategic insight that a financing consultant would actually say to this filmmaker"
}`;

  const raw = await callCompletions([{ role: "user", content: prompt }], apiKey, 1500);
  return safeJSON<ProjectSemanticProfile>(raw, {
    themes: [],
    tone: [],
    cultural_specificity: "",
    career_signals: [],
    market_positioning: "",
    comparable_films: [],
    funding_gaps: [],
    strategic_notes: "",
  });
}

// ── Step 2: Analyse top-matched opportunities (batched) ──────

async function analyzeOpportunitiesBatch(
  opportunities: Opportunity[],
  apiKey: string
): Promise<Map<string, OpportunitySemanticProfile>> {
  const results = new Map<string, OpportunitySemanticProfile>();
  const BATCH = 12; // 12 per call keeps prompt size manageable

  for (let i = 0; i < opportunities.length; i += BATCH) {
    const batch = opportunities.slice(i, i + BATCH);

    const prompt = `You are an expert in international film financing. Analyse these funding opportunities and extract their real preferences — go beyond the surface metadata to identify what these funds actually look for based on their descriptions and historical track record.

${batch.map((o, idx) => `
OPPORTUNITY ${idx + 1}:
ID: ${o.id}
TITLE: ${o.title}
TYPE: ${o.opp_type}
COUNTRY: ${o.country ?? "Global"} | REGION: ${(o as any).region ?? "Global"}
GENRES: ${(o as any).genres?.join(", ") ?? "all genres"}
FORMATS: ${(o as any).formats?.join(", ") ?? "all formats"}
MAX AWARD: $${o.max_award_usd?.toLocaleString() ?? "varies"}
DESCRIPTION: ${o.description ?? "(no description)"}
`).join("\n---\n")}

Return ONLY a valid JSON array with one object per opportunity in the same order:
[
  {
    "opportunity_id": "the exact id provided",
    "thematic_preferences": ["what themes this fund actually gravitates toward"],
    "cultural_affinities": ["specific cultures, regions, communities this fund has funded or favours"],
    "career_stage_preference": "debut/emerging/mid-career/established/all",
    "narrative_preferences": ["cinematic styles and storytelling approaches it favours"],
    "eligibility_nuances": ["subtle requirements beyond the obvious — completion status, language, nationality"],
    "strategic_value": "what unique non-monetary value this offers — market access, mentorship, co-production network, etc."
  }
]`;

    const raw = await callCompletions([{ role: "user", content: prompt }], apiKey, 2500);
    const parsed = safeJSON<OpportunitySemanticProfile[]>(raw, []);
    for (const profile of parsed) {
      if (profile.opportunity_id) results.set(profile.opportunity_id, profile);
    }
  }

  return results;
}

// ── Step 3: Semantic match scores (single batched call) ──────

async function computeSemanticScores(
  project: Project,
  projectProfile: ProjectSemanticProfile,
  topMatches: { opportunity: Opportunity; ruleScore: number }[],
  opportunityProfiles: Map<string, OpportunitySemanticProfile>,
  apiKey: string
): Promise<SemanticMatch[]> {
  const prompt = `You are an expert film financing consultant. Score the semantic alignment between this project and each funding opportunity. Look beyond field matching to thematic resonance, cultural fit, narrative style, and strategic value.

PROJECT:
Title: ${project.title} | ${project.genre} ${project.format} from ${project.country}
Logline: ${project.logline}

PROJECT SEMANTIC PROFILE:
- Themes: ${projectProfile.themes.join(", ")}
- Tone: ${projectProfile.tone.join(", ")}
- Cultural context: ${projectProfile.cultural_specificity}
- Career signals: ${projectProfile.career_signals.join(", ")}
- Market positioning: ${projectProfile.market_positioning}

OPPORTUNITIES TO SCORE:
${topMatches.map(({ opportunity: o, ruleScore }) => {
  const p = opportunityProfiles.get(o.id);
  return `
ID: ${o.id} | TITLE: ${o.title} | RULE SCORE: ${ruleScore}
Thematic preferences: ${p?.thematic_preferences?.join(", ") ?? "unknown"}
Cultural affinities: ${p?.cultural_affinities?.join(", ") ?? "unknown"}
Career stage: ${p?.career_stage_preference ?? "all"}
Narrative preferences: ${p?.narrative_preferences?.join(", ") ?? "any"}
Eligibility nuances: ${p?.eligibility_nuances?.join("; ") ?? "standard"}
Strategic value: ${p?.strategic_value ?? "funding"}`;
}).join("\n---\n")}

For each opportunity, provide:
- semantic_score (0-100): how well the project's narrative, themes and cultural context align with what this fund actually looks for
- alignment_reason: one specific sentence explaining the KEY alignment (reference actual themes/aspects of both)
- strategic_insight: one actionable sentence about HOW to approach this opportunity for this specific project

Return ONLY a valid JSON array in the same order as the opportunities above:
[
  {
    "opportunity_id": "exact id",
    "semantic_score": 0-100,
    "alignment_reason": "specific sentence",
    "strategic_insight": "specific actionable sentence"
  }
]`;

  const raw = await callCompletions([{ role: "user", content: prompt }], apiKey, 2500);
  return safeJSON<SemanticMatch[]>(raw, []);
}

// ── Step 4: AI-detected narrative obstacles ──────────────────

async function detectAIObstacles(
  project: Project,
  projectProfile: ProjectSemanticProfile,
  topMatches: { opportunity: Opportunity; hybridScore: number }[],
  apiKey: string
): Promise<AIObstacle[]> {
  const prompt = `You are a veteran film financing consultant. Analyse this project and identify the real obstacles blocking it from financing — go beyond obvious missing fields to identify narrative, structural and strategic problems.

PROJECT:
${project.title} | ${project.genre} ${project.format} | ${project.country} | Seeking $${project.funding_needed_usd?.toLocaleString()}
Logline: ${project.logline}
Synopsis: ${project.synopsis?.slice(0, 600) ?? "(not provided)"}
Director's statement: ${project.director_statement?.slice(0, 400) ?? "(not provided)"}
Producer info: ${project.producer_info ?? "(not provided)"}

SEMANTIC PROFILE:
Themes: ${projectProfile.themes.join(", ")}
Funding gaps identified: ${projectProfile.funding_gaps.join("; ")}

TOP MISSED MATCHES (scored below 80 despite seeming relevant):
${topMatches.filter(m => m.hybridScore < 80).slice(0, 4).map(m => `- ${m.opportunity.title} (${m.hybridScore}/100)`).join("\n")}

Identify 3-5 specific obstacles. Mix obvious ones (missing co-producer) with narrative/strategic ones (logline doesn't communicate the film's international appeal, budget too high for development-stage funds, director's statement doesn't address why this story needs to be told now).

Return ONLY valid JSON array:
[
  {
    "id": "unique_snake_case_id",
    "label": "short obstacle name (5 words max)",
    "severity": "high|medium|low",
    "ai_insight": "specific insight derived from reading the actual project text — reference real details",
    "action_label": "specific action to take",
    "action_href": "/dashboard/projects/${project.id}/edit"
  }
]`;

  const raw = await callCompletions([{ role: "user", content: prompt }], apiKey, 1500);
  return safeJSON<AIObstacle[]>(raw, []);
}

// ── Step 5: Market intelligence ──────────────────────────────

async function generateMarketIntelligence(
  project: Project,
  projectProfile: ProjectSemanticProfile,
  apiKey: string
): Promise<MarketIntelligence> {
  const prompt = `You are a film market strategist. Provide market intelligence for this project to help position it for international co-production and financing.

PROJECT:
${project.title} | ${project.genre} ${project.format} | ${project.country} | Stage: ${project.stage}
Logline: ${project.logline}
Themes: ${projectProfile.themes.join(", ")}
Comparable films: ${projectProfile.comparable_films.join(", ")}
Market positioning: ${projectProfile.market_positioning}

Return ONLY valid JSON:
{
  "positioning_statement": "one precise paragraph on how to position this film in the current international market — specific festivals, buyer profiles, audience territories",
  "timing_assessment": "one sentence on whether now is a good or challenging time for this type of film and why",
  "recommended_markets": ["specific film markets and co-production forums to target in priority order"],
  "comparable_films": ["3-4 recent comparable films that succeeded in financing, with brief note on how each was financed"],
  "competitive_landscape": "one paragraph on what makes this project stand out from (and compete with) similar films currently seeking financing"
}`;

  const raw = await callCompletions([{ role: "user", content: prompt }], apiKey, 1200);
  return safeJSON<MarketIntelligence>(raw, {
    positioning_statement: "",
    timing_assessment: "",
    recommended_markets: [],
    comparable_films: [],
    competitive_landscape: "",
  });
}

// ── Step 6: Enhanced EP brief (with optional web search) ────

async function generateEnhancedEPBrief(
  project: Project,
  projectProfile: ProjectSemanticProfile,
  topMatches: EnhancedMatch[],
  aiObstacles: AIObstacle[],
  apiKey: string,
  useWebSearch: boolean
): Promise<EnhancedEPBrief> {
  const matchesSummary = topMatches.slice(0, 8).map((m) => {
    const insight = m.semantic?.strategic_insight ?? m.match.reasons[0] ?? "";
    return `- ${m.opportunity.title} (${m.hybrid_score}/100): ${insight}`;
  }).join("\n");

  const obstaclesSummary = aiObstacles.length
    ? aiObstacles.map((o) => `- [${o.severity.toUpperCase()}] ${o.label}: ${o.ai_insight}`).join("\n")
    : "No major obstacles identified.";

  const prompt = `You are a senior Executive Producer with 20 years of international film financing experience. You have directly financed films at Sundance, IDFA, Berlinale and Cannes. Give brutally honest, specific, actionable advice — not generic guidance.

PROJECT: ${project.title}
${project.genre} ${project.format} | ${project.country} | ${project.language} | Stage: ${project.stage}
Budget: $${project.budget_usd?.toLocaleString()} | Seeking: $${project.funding_needed_usd?.toLocaleString()}
Logline: ${project.logline}

STRATEGIC PROFILE:
Themes: ${projectProfile.themes.join(", ")}
Cultural context: ${projectProfile.cultural_specificity}
Market positioning: ${projectProfile.market_positioning}
Career signals: ${projectProfile.career_signals.join(", ")}
Strategic notes: ${projectProfile.strategic_notes}

TOP MATCHED OPPORTUNITIES:
${matchesSummary}

OBSTACLES TO ADDRESS:
${obstaclesSummary}

${useWebSearch ? "Use web search to verify current deadline status and any recent news about the top 3 opportunities before writing the brief." : ""}

Return ONLY valid JSON:
{
  "strategic_summary": "2-3 paragraphs of frank strategic assessment. Be specific. Name real funds, real deadlines, real relationships. Tell them what most consultants wouldn't say.",
  "immediate_actions": [
    {
      "priority": "critical|high|medium",
      "title": "specific action title",
      "description": "exactly what to do, when, and why — include specific names/deadlines where known",
      "deadline": "specific deadline or timeframe, or null",
      "opportunity_id": "opportunity id if this action is about a specific fund, or null"
    }
  ],
  "six_month_roadmap": "paragraph describing the sequenced financing strategy — what to apply for first, second, third and why that order matters",
  "key_relationships": ["specific types of people and organizations to approach — be concrete about role and why they matter for this project"],
  "market_positioning": "one paragraph on the exact market positioning strategy — which festivals to target first and why, framed as a co-production opportunity"
}`;

  let raw: string;
  if (useWebSearch) {
    raw = await callWithWebSearch(prompt, apiKey);
  } else {
    raw = await callCompletions(
      [
        { role: "system", content: "You are a senior Executive Producer with 20 years of international film financing experience. Be specific, direct and actionable." },
        { role: "user", content: prompt },
      ],
      apiKey,
      2500
    );
  }

  if (!raw) {
    return {
      strategic_summary: "Unable to generate brief. Please check your OpenAI API key.",
      immediate_actions: [],
      six_month_roadmap: "",
      key_relationships: [],
      market_positioning: "",
      generated_by: "heuristic",
    };
  }

  const parsed = safeJSON<Omit<EnhancedEPBrief, "generated_by">>(raw, {
    strategic_summary: "",
    immediate_actions: [],
    six_month_roadmap: "",
    key_relationships: [],
    market_positioning: "",
  });

  return { ...parsed, generated_by: "openai" };
}

// ── Heuristic fallbacks ──────────────────────────────────────

function heuristicProfile(project: Project): ProjectSemanticProfile {
  return {
    themes: [project.genre],
    tone: [],
    cultural_specificity: `${project.language} language film from ${project.country}`,
    career_signals: [],
    market_positioning: `${project.genre} ${project.format} seeking international co-production`,
    comparable_films: [],
    funding_gaps: [],
    strategic_notes: "",
  };
}

function heuristicMarketIntel(project: Project): MarketIntelligence {
  return {
    positioning_statement: `${project.title} is a ${project.genre} ${project.format} from ${project.country} currently at ${project.stage} stage.`,
    timing_assessment: "",
    recommended_markets: ["NFDC Film Bazaar", "Berlinale Co-Production Market", "Cannes Marché du Film"],
    comparable_films: [],
    competitive_landscape: "",
  };
}

// ── Main orchestrator ────────────────────────────────────────

export interface AIEngineInput extends FylympitchEngineInput {
  /** Set OPENAI_WEB_SEARCH=true in env to enable live deadline verification */
  useWebSearch?: boolean;
}

export async function runAIEnhancedEngine(input: AIEngineInput): Promise<AIEngineResult> {
  const { project, openaiApiKey, useWebSearch = false } = input;

  // ── Always run the rule-based engine first ──
  const base = await runFylympitchEngine(input);

  // ── No API key → return base result with empty AI fields ──
  if (!openaiApiKey) {
    return {
      ...base,
      matches: base.matches.map((m) => ({
        ...m,
        semantic: null,
        hybrid_score: m.match.score,
      })),
      project_profile: heuristicProfile(project),
      semantic_matches: [],
      enhanced_ep_brief: {
        strategic_summary: base.executive_producer.summary,
        immediate_actions: [],
        six_month_roadmap: base.roadmap.recommendation,
        key_relationships: [],
        market_positioning: base.roadmap.recommendation,
        generated_by: "heuristic",
      },
      ai_obstacles: [],
      market_intelligence: heuristicMarketIntel(project),
      engine_version: "v1_hybrid",
    };
  }

  // ── Determine AI confidence weight based on narrative richness ──
  const narrativeRich = !!(project.synopsis && project.director_statement);
  const AI_WEIGHT   = narrativeRich ? 0.5 : 0.4;
  const RULE_WEIGHT = 1 - AI_WEIGHT;

  // ── Step 1: Analyse the project ──
  console.log("[aiEngine] Analysing project narrative…");
  const projectProfile = await analyzeProject(project, openaiApiKey);

  // ── Step 2: Filter to top rule-based matches (≥60) for AI pass ──
  const ruleMatches = base.matches.filter((m) => m.match.score >= 60).slice(0, 20);

  // ── Step 3: Analyse top opportunities in batches ──
  console.log(`[aiEngine] Analysing ${ruleMatches.length} shortlisted opportunities…`);
  const opportunityProfiles = await analyzeOpportunitiesBatch(
    ruleMatches.map((m) => m.opportunity),
    openaiApiKey
  );

  // ── Step 4: Semantic scoring ──
  console.log("[aiEngine] Computing semantic match scores…");
  const semanticScores = await computeSemanticScores(
    project,
    projectProfile,
    ruleMatches.map((m) => ({ opportunity: m.opportunity, ruleScore: m.match.score })),
    opportunityProfiles,
    openaiApiKey
  );

  const semanticById = new Map(semanticScores.map((s) => [s.opportunity_id, s]));

  // ── Step 5: Build enhanced matches with hybrid scores ──
  const enhancedMatches: EnhancedMatch[] = base.matches.map((m) => {
    const semantic = semanticById.get(m.opportunity.id) ?? null;
    const hybrid_score = semantic
      ? Math.min(100, Math.round(m.match.score * RULE_WEIGHT + semantic.semantic_score * AI_WEIGHT))
      : m.match.score;
    return { ...m, semantic, hybrid_score };
  }).sort((a, b) => b.hybrid_score - a.hybrid_score);

  // ── Step 6: AI obstacle detection ──
  console.log("[aiEngine] Detecting narrative obstacles…");
  const aiObstacles = await detectAIObstacles(
    project,
    projectProfile,
    enhancedMatches.map((m) => ({ opportunity: m.opportunity, hybridScore: m.hybrid_score })),
    openaiApiKey
  );

  // ── Step 7: Market intelligence ──
  console.log("[aiEngine] Generating market intelligence…");
  const marketIntelligence = await generateMarketIntelligence(project, projectProfile, openaiApiKey);

  // ── Step 8: Enhanced EP brief (with optional web search) ──
  console.log(`[aiEngine] Generating enhanced EP brief (web search: ${useWebSearch})…`);
  const enhancedEPBrief = await generateEnhancedEPBrief(
    project,
    projectProfile,
    enhancedMatches,
    aiObstacles,
    openaiApiKey,
    useWebSearch
  );

  // ── Merge AI obstacles with rule-based obstacles ──
  // AI obstacles take precedence; keep any rule-based ones not already covered
  const aiObstacleIds = new Set(aiObstacles.map((o) => o.id));
  const remainingRuleObstacles: AIObstacle[] = base.obstacles
    .filter((o) => !aiObstacleIds.has(o.id))
    .map((o) => ({
      id: o.id,
      label: o.label,
      severity: o.severity,
      ai_insight: o.label,    // no AI insight for rule-based
      action_label: o.action_label,
      action_href: o.action_href,
    }));

  const allObstacles = [...aiObstacles, ...remainingRuleObstacles];

  console.log("[aiEngine] Done. Engine version: v2_ai_hybrid");

  return {
    ...base,
    matches: enhancedMatches,
    project_profile: projectProfile,
    semantic_matches: semanticScores,
    enhanced_ep_brief: enhancedEPBrief,
    ai_obstacles: allObstacles,
    market_intelligence: marketIntelligence,
    engine_version: "v2_ai_hybrid",
    // Override the basic EP brief summary with the enhanced one
    executive_producer: {
      ...base.executive_producer,
      summary: enhancedEPBrief.strategic_summary,
      generated_by: "openai",
    },
  };
}
