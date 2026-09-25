import type { MetadataRoute } from "next";
import { createAnonClient } from "@/lib/supabase/anon";
import { SITE, opportunityIndexability, projectIndexability, profileIndexability } from "@/lib/seo";
import { loadIndexableOpportunities, countriesWithCounts, organisationsWithCounts, HUB_MIN_RECORDS } from "@/lib/hubs";
import { OPPORTUNITY_FAMILIES, familyForType } from "@/lib/opportunity-taxonomy";
import { FACETS, rowsForFacet, facetIndexability } from "@/lib/opportunity-facets";
import { GUIDES } from "@/lib/guides";
import { GLOSSARY } from "@/lib/glossary";

export const revalidate = 3600; // regenerate hourly

const BASE = SITE.host;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Anonymous read: the sitemap is the same for everyone, and reading
  // cookies() here would quietly opt the route out of `revalidate`.
  const supabase = createAnonClient();

  // ── Static / hub entry pages ──────────────────────────────────
  const statics: MetadataRoute.Sitemap = [
    { url: BASE, changeFrequency: "weekly", priority: 1.0 },
    { url: `${BASE}/opportunities`, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE}/deadlines`, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE}/opportunities/country`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${BASE}/opportunities/for`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${BASE}/organisations`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${BASE}/guides`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/glossary`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/filmprojects`, changeFrequency: "daily", priority: 0.7 },
    { url: `${BASE}/signup`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${BASE}/list`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${BASE}/terms`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${BASE}/cookies`, changeFrequency: "yearly", priority: 0.2 },
  ];

  // ── Opportunity record pages (indexation-threshold gated) ─────
  // Only submit records that actually earn a place in the index. Thin or
  // producer-brief records are intentionally excluded (they render noindex).
  // select("*") for the same reason as the detail page: this list used to name
  // min_award_usd, which does not exist, so PostgREST rejected the request and
  // every single fund URL dropped out of the sitemap without a word. The
  // sitemap looked fine — it just had 36 entries instead of ~190.
  const { data: opps, error: oppErr } = await supabase
    .from("opportunities")
    .select("*")
    .eq("is_active", true)
    // No .order() on purpose. PostgREST rejects the whole request when ORDER BY
    // names a column that does not exist — the same failure mode as the select
    // list, and just as silent. A sitemap has no use for ordering, so this is a
    // dependency with a real downside and no upside. (slug is NOT NULL per
    // migration 030, so it needs no filter either.)
    .limit(5000);

  if (oppErr) console.error("[sitemap] opportunity query failed:", oppErr.message);

  const oppUrls: MetadataRoute.Sitemap = (opps ?? [])
    .filter((o: any) => opportunityIndexability(o).index)
    .map((o: any) => ({
      url: `${BASE}/opportunities/${o.slug}`,
      lastModified: o.updated_at ?? o.created_at ?? new Date().toISOString(),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));

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

  // ── Public announcements ──────────────────────────────────────
  // Only announcements sent to everyone get a public page (migration 077
  // enforces that with a check constraint), so this list is already the
  // publishable set — no extra filtering needed here.
  // admin_broadcasts is admin-only for select (063) and the sitemap is built by
  // an anonymous client, so this goes through a SECURITY DEFINER index function
  // that returns nothing but the slug and the dates. Returns empty (and the
  // sitemap simply omits announcements) until migration 078 has been run.
  const { data: announcements } = await supabase.rpc("public_announcement_index");

  const announcementUrls: MetadataRoute.Sitemap = (announcements ?? []).map((a: any) => ({
    url: `${BASE}/announcements/${a.public_slug}`,
    lastModified: a.edited_at ?? a.created_at ?? new Date().toISOString(),
    changeFrequency: "yearly" as const,
    priority: 0.4,
  }));

  // ── Hubs ─────────────────────────────────────────────────────
  // Same gate the pages themselves apply: a hub below HUB_MIN_RECORDS
  // renders noindex, so submitting it here would only ask a crawler to
  // fetch a page we have told it to ignore.
  const hubRows = await loadIndexableOpportunities();
  const now = new Date().toISOString();

  const familyUrls: MetadataRoute.Sitemap = OPPORTUNITY_FAMILIES
    .map(f => ({ f, n: hubRows.filter(r => familyForType(r.opp_type)?.slug === f.slug).length }))
    .filter(x => x.n >= HUB_MIN_RECORDS)
    .map(({ f }) => ({
      url: `${BASE}/opportunities/type/${f.slug}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.8,
    }));

  const countryUrls: MetadataRoute.Sitemap = countriesWithCounts(hubRows).map(c => ({
    url: `${BASE}/opportunities/country/${c.slug}`,
    lastModified: now,
    changeFrequency: "daily" as const,
    priority: 0.8,
  }));

  // Facets apply a second gate on top of HUB_MIN_RECORDS: one that lists
  // almost the whole catalogue is a duplicate of /opportunities and renders
  // noindex, so it has no business in the sitemap either.
  const facetUrls: MetadataRoute.Sitemap = FACETS
    .map(f => ({ f, n: rowsForFacet(f, hubRows).length }))
    .filter(x => facetIndexability(x.n, hubRows.length).index)
    .map(({ f }) => ({
      url: `${BASE}/opportunities/for/${f.slug}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.8,
    }));

  const organisationUrls: MetadataRoute.Sitemap = organisationsWithCounts(hubRows).map(o => ({
    url: `${BASE}/organisations/${o.slug}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  // ── Editorial ────────────────────────────────────────────────
  const guideUrls: MetadataRoute.Sitemap = GUIDES.map(g => ({
    url: `${BASE}/guides/${g.slug}`,
    lastModified: g.updated,
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  const glossaryUrls: MetadataRoute.Sitemap = GLOSSARY.map(t => ({
    url: `${BASE}/glossary/${t.slug}`,
    changeFrequency: "yearly" as const,
    priority: 0.5,
  }));

  return [
    ...statics, ...oppUrls, ...projectUrls, ...profileUrls, ...announcementUrls,
    ...familyUrls, ...countryUrls, ...facetUrls, ...organisationUrls,
    ...guideUrls, ...glossaryUrls,
  ];
}
