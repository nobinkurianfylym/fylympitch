import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";

export const revalidate = 3600; // regenerate hourly

const BASE = "https://pitch.fylym.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient();

  // ── Static pages ──────────────────────────────────────────────
  const statics: MetadataRoute.Sitemap = [
    { url: BASE,              changeFrequency: "weekly",  priority: 1.0 },
    { url: `${BASE}/funds`,   changeFrequency: "daily",   priority: 0.9 },
    { url: `${BASE}/projects`,changeFrequency: "daily",   priority: 0.8 },
    { url: `${BASE}/login`,   changeFrequency: "monthly", priority: 0.3 },
    { url: `${BASE}/signup`,  changeFrequency: "monthly", priority: 0.4 },
  ];

  // ── Fund detail pages ─────────────────────────────────────────
  const { data: funds } = await supabase
    .from("opportunities")
    .select("slug, updated_at")
    .eq("is_active", true)
    .not("slug", "is", null)
    .order("created_at", { ascending: false })
    .limit(500);

  const fundUrls: MetadataRoute.Sitemap = (funds ?? []).map((f: any) => ({
    url: `${BASE}/funds/${f.slug}`,
    lastModified: f.updated_at ?? new Date().toISOString(),
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
    .limit(500);

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
    .limit(500);

  const profileUrls: MetadataRoute.Sitemap = (profiles ?? [])
    .filter((p: any) => p.username)
    .map((p: any) => ({
      url: `${BASE}/u/${p.username}`,
      lastModified: p.updated_at ?? new Date().toISOString(),
      changeFrequency: "monthly" as const,
      priority: 0.5,
    }));

  return [...statics, ...fundUrls, ...projectUrls, ...profileUrls];
}
