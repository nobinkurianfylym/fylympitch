import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";
import { SITE, opportunityIndexability, projectIndexability, profileIndexability } from "@/lib/seo";
import { OPPORTUNITY_FAMILIES, countrySlug } from "@/lib/opportunity-taxonomy";
import { countriesWithCounts, HUB_MIN_RECORDS, type HubRow } from "@/lib/hubs";

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

  // ── Hub pages (threshold-gated) ───────────────────────────────
  const indexable = (opps ?? []).filter((o: any) => opportunityIndexability(o).index) as unknown as HubRow[];
  const hubUrls: MetadataRoute.Sitemap = [
    { url: `${BASE}/opportunities/type`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${BASE}/opportunities/country`, changeFrequency: "weekly", priority: 0.7 },
  ];

  // Family hubs
  for (const fam of OPPORTUNITY_FAMILIES) {
    const rows = indexable.filter((r) => fam.types.includes(r.opp_type ?? ""));
    if (rows.length >= HUB_MIN_RECORDS)
      hubUrls.push({ url: `${BASE}/opportunities/type/${fam.slug}`, changeFrequency: "weekly", priority: 0.75 });
  }

  // Country hubs + country×family combos
  const countries = countriesWithCounts(indexable);
  for (const c of countries) {
    hubUrls.push({ url: `${BASE}/opportunities/country/${c.slug}`, changeFrequency: "weekly", priority: 0.7 });
    for (const fam of OPPORTUNITY_FAMILIES) {
      const n = indexable.filter((r) => r.country && countrySlug(r.country) === c.slug && fam.types.includes(r.opp_type ?? "")).length;
      if (n >= HUB_MIN_RECORDS)
        hubUrls.push({ url: `${BASE}/opportunities/country/${c.slug}/${fam.slug}`, changeFrequency: "weekly", priority: 0.65 });
    }
  }

  // ── Public project pages ──────────────────────────────────────
  const { data: projects } = await supabase
    .from("projects")
    .select("slug, updated_at, title, logline, synopsis, is_public, admin_hidden")
    .eq("is_public", true)
    .eq("admin_hidden", false)
    .not("slug", "is", null)
    .order("created_at", { ascending: false })
    .limit(2000);

  const projectUrls: MetadataRoute.Sitemap = (projects ?? [])
    .filter((p: any) => projectIndexability(p).index)
    .map((p: any) => ({
    url: `${BASE}/filmprojects/${p.slug}`,
    lastModified: p.updated_at ?? new Date().toISOString(),
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  // ── Public user profiles ──────────────────────────────────────
  const { data: profiles } = await supabase
    .from("profiles")
    .select("username, updated_at, full_name, bio, company, role")
    .not("username", "is", null)
    .order("created_at", { ascending: false })
    .limit(2000);

  const profileUrls: MetadataRoute.Sitemap = (profiles ?? [])
    .filter((p: any) => profileIndexability(p).index)
    .map((p: any) => ({
      url: `${BASE}/u/${p.username}`,
      lastModified: p.updated_at ?? new Date().toISOString(),
      changeFrequency: "monthly" as const,
      priority: 0.5,
    }));

  return [...statics, ...oppUrls, ...hubUrls, ...projectUrls, ...profileUrls];
}
