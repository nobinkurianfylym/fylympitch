import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";
import { SITE, opportunityIndexability } from "@/lib/seo";

export const revalidate = 3600; // regenerate hourly

const BASE = SITE.host;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient();

  // ── Static / hub entry pages ──────────────────────────────────
  const statics: MetadataRoute.Sitemap = [
    { url: BASE, changeFrequency: "weekly", priority: 1.0 },
    { url: `${BASE}/opportunities`, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE}/filmprojects`, changeFrequency: "daily", priority: 0.7 },
    { url: `${BASE}/login`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${BASE}/signup`, changeFrequency: "monthly", priority: 0.4 },
  ];

  // ── Opportunity record pages (indexation-threshold gated) ─────
  // Only submit records that actually earn a place in the index. Thin or
  // producer-brief records are intentionally excluded (they render noindex).
  const { data: opps } = await supabase
    .from("opportunities")
    .select(
      "slug, updated_at, is_active, is_producer_post, posted_by_producer_id, title, description, opp_type, country, region, deadline, min_award_usd, max_award_usd, eligible_countries, career_stages",
    )
    .eq("is_active", true)
    .not("slug", "is", null)
    .order("updated_at", { ascending: false })
    .limit(5000);

  const oppUrls: MetadataRoute.Sitemap = (opps ?? [])
    .filter((o: any) => opportunityIndexability(o).index)
    .map((o: any) => ({
      url: `${BASE}/opportunities/${o.slug}`,
      lastModified: o.updated_at ?? new Date().toISOString(),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));

  // ── Public project pages ──────────────────────────────────────
  const { data: projects } = await supabase
    .from("projects")
    .select("slug, updated_at")
    .eq("is_public", true)
    .eq("admin_hidden", false)
    .not("slug", "is", null)
    .order("created_at", { ascending: false })
    .limit(2000);

  const projectUrls: MetadataRoute.Sitemap = (projects ?? []).map((p: any) => ({
    url: `${BASE}/filmprojects/${p.slug}`,
    lastModified: p.updated_at ?? new Date().toISOString(),
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  // ── Public user profiles ──────────────────────────────────────
  const { data: profiles } = await supabase
    .from("profiles")
    .select("username, updated_at")
    .not("username", "is", null)
    .order("created_at", { ascending: false })
    .limit(2000);

  const profileUrls: MetadataRoute.Sitemap = (profiles ?? [])
    .filter((p: any) => p.username)
    .map((p: any) => ({
      url: `${BASE}/u/${p.username}`,
      lastModified: p.updated_at ?? new Date().toISOString(),
      changeFrequency: "monthly" as const,
      priority: 0.5,
    }));

  return [...statics, ...oppUrls, ...projectUrls, ...profileUrls];
}
