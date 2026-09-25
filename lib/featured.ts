// lib/featured.ts
//
// Which card the homepage shows today, and what the next two weeks
// look like.
//
// The rotation is the date and nothing else. No cron, no stored
// pointer, no "last shown" column to drift out of sync. Every
// render on a given day picks the same card, and a day that is
// missed simply never happens rather than shunting the queue.

import { createClient } from "@/lib/supabase/server";
import { preferThumb } from "@/lib/poster-url";

export type FeaturedKind = "fund" | "producer" | "project" | "custom";

export type FeaturedRow = { label: string; value: string; gold?: boolean };

export type FeaturedSlot = {
  id: string;
  kind: FeaturedKind;
  ref_id: string | null;
  title: string | null;
  subtitle: string | null;
  hook: string | null;
  image_url: string | null;
  link_url: string | null;
  cta_label: string | null;
  rows: FeaturedRow[];
  sort_order: number;
  is_active: boolean;
  created_at: string;
};

export type FeaturedCardData = {
  kind: FeaturedKind;
  kindLabel: string;
  title: string;
  subtitle: string | null;
  hook: string | null;
  imageUrl: string | null;
  href: string;
  ctaLabel: string;
  rows: FeaturedRow[];
};

const KIND_ORDER: FeaturedKind[] = ["fund", "producer", "project", "custom"];

const KIND_LABEL: Record<FeaturedKind, string> = {
  fund: "Featured fund",
  producer: "Featured producer",
  project: "Featured project",
  custom: "Featured",
};

const DEFAULT_CTA: Record<FeaturedKind, string> = {
  fund: "See if you qualify",
  producer: "Send your pitch",
  project: "View the project",
  custom: "Find out more",
};

/** Days since epoch in UTC. Changes at midnight UTC, everywhere, at once. */
export function dayNumber(d = new Date()): number {
  return Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 86_400_000);
}

/**
 * Pick the slot for a given day from a list of active slots.
 *
 * Only kinds that actually have entries take part, so a queue with
 * nothing but funds shows a fund every day rather than going blank
 * two days in three. Within a kind the queue advances one step each
 * time that kind comes round.
 */
export function pickForDay(slots: FeaturedSlot[], day: number): FeaturedSlot | null {
  const present = KIND_ORDER.filter(k => slots.some(s => s.kind === k));
  if (present.length === 0) return null;

  const kind = present[((day % present.length) + present.length) % present.length];
  const queue = slots
    .filter(s => s.kind === kind)
    .sort((a, b) =>
      a.sort_order - b.sort_order ||
      a.created_at.localeCompare(b.created_at));

  if (queue.length === 0) return null;
  const turn = Math.floor(day / present.length);
  return queue[((turn % queue.length) + queue.length) % queue.length];
}

async function activeSlots(): Promise<FeaturedSlot[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("featured_slots")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  return ((data ?? []) as any[]).map(r => ({
    ...r,
    rows: Array.isArray(r.rows) ? r.rows : [],
  })) as FeaturedSlot[];
}

function daysUntil(dateISO: string | null): string | null {
  if (!dateISO) return null;
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const then = new Date(dateISO + "T00:00:00Z");
  const n = Math.round((then.getTime() - today.getTime()) / 86_400_000);
  if (n < 0)  return null;
  if (n === 0) return "today";
  if (n === 1) return "tomorrow";
  return `in ${n} days`;
}

const money = (n: number | null) =>
  typeof n === "number" && n > 0 ? `$${n.toLocaleString("en-US")}` : null;

/**
 * Fill a slot out from whatever it points at. Overrides always win,
 * so an admin can fix a title or a hook without touching the fund,
 * the profile or the project it refers to.
 */
async function hydrate(slot: FeaturedSlot): Promise<FeaturedCardData | null> {
  const supabase = await createClient();

  let title    = slot.title ?? null;
  let subtitle = slot.subtitle ?? null;
  let image    = slot.image_url ?? null;
  let href     = slot.link_url ?? null;
  let rows: FeaturedRow[] = slot.rows.length ? slot.rows : [];
  let hook     = slot.hook ?? null;

  if (slot.kind === "fund" && slot.ref_id) {
    const { data: o } = await supabase
      .from("opportunities")
      .select("id, slug, title, organization_name, opp_type, max_award_usd, country, deadline, deadline_type")
      .eq("id", slot.ref_id)
      .maybeSingle();
    if (!o) return null;

    title    ??= (o.organization_name?.trim() || o.title);
    subtitle ??= String(o.opp_type ?? "").replace(/_/g, " ");
    href     ??= o.slug ? `/opportunities/${o.slug}` : `/dashboard/opportunities/${o.id}`;

    if (!rows.length) {
      const award  = money(o.max_award_usd);
      const closes = o.deadline_type === "rolling"
        ? "Open now"
        : daysUntil(o.deadline);
      rows = [
        award  ? { label: "Up to",   value: award, gold: true } : null,
        { label: "Open to", value: o.country?.trim() || "Worldwide" },
        closes ? { label: o.deadline_type === "rolling" ? "Status" : "Closes", value: closes, gold: true } : null,
      ].filter(Boolean) as FeaturedRow[];
    }

    // The one line no competitor can print. Counted live, and dropped
    // entirely when it is too small to be flattering rather than shown
    // as "1 project".
    if (!hook) {
      const { count } = await supabase
        .from("matches")
        .select("project_id", { count: "exact", head: true })
        .eq("opportunity_id", o.id)
        .gte("score", 70);
      if ((count ?? 0) >= 3) hook = `${count} projects here match this fund at 70 or above.`;
    }
  }

  if (slot.kind === "producer" && slot.ref_id) {
    const { data: p } = await supabase
      .from("profiles")
      .select("id, username, full_name, company, country")
      .eq("id", slot.ref_id)
      .maybeSingle();
    if (!p) return null;

    title    ??= (p.company?.trim() || p.full_name?.trim() || "Producer");
    subtitle ??= p.country?.trim() || null;
    href     ??= p.username ? `/u/${p.username}` : "/filmprojects";

    if (!rows.length) {
      const { data: pp } = await supabase
        .from("producer_profiles")
        .select("genres, formats, budget_range, accepting_pitches, open_to_coproduction")
        .eq("user_id", p.id)
        .maybeSingle();
      rows = [
        pp?.genres?.length ? { label: "Wants", value: pp.genres.slice(0, 2).join(" · ") } : null,
        pp?.budget_range   ? { label: "Budget", value: String(pp.budget_range), gold: true } : null,
        pp?.accepting_pitches
          ? { label: "Status", value: "Accepting pitches", gold: true }
          : pp?.open_to_coproduction
            ? { label: "Open to", value: "Co-production" }
            : null,
      ].filter(Boolean) as FeaturedRow[];
    }
  }

  if (slot.kind === "project" && slot.ref_id) {
    const { data: pr } = await supabase
      .from("projects")
      .select("id, slug, title, format, country, budget_usd, finance_secured_usd, stage, poster_path, is_public, admin_hidden")
      .eq("id", slot.ref_id)
      .maybeSingle();
    // Never feature something that is not public. A private pitch on the
    // homepage would be the worst bug this feature could have.
    if (!pr || !pr.is_public || pr.admin_hidden) return null;

    title    ??= pr.title;
    subtitle ??= [pr.format, pr.country?.trim()].filter(Boolean).join(" · ") || null;
    href     ??= pr.slug ? `/filmprojects/${pr.slug}` : `/filmprojects/${pr.id}`;

    if (!image && pr.poster_path) {
      // Posters are a full/thumb pair in the `thumbnails` bucket. The card is
      // at most 300px tall, so the thumb is the right one to pull.
      const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
      image = `${base}/storage/v1/object/public/thumbnails/${preferThumb(pr.poster_path)}`;
    }

    if (!rows.length) {
      const budget = money(pr.budget_usd);
      const pct = pr.budget_usd && pr.finance_secured_usd
        ? Math.round((pr.finance_secured_usd / pr.budget_usd) * 100)
        : null;
      rows = [
        budget ? { label: "Budget", value: budget, gold: true } : null,
        pct !== null ? { label: "Secured", value: `${pct}%` } : null,
        pr.stage ? { label: "Stage", value: String(pr.stage).replace(/_/g, " ") } : null,
      ].filter(Boolean) as FeaturedRow[];
    }
  }

  if (!title) return null;

  return {
    kind: slot.kind,
    kindLabel: KIND_LABEL[slot.kind],
    title,
    subtitle,
    hook,
    imageUrl: image,
    href: href ?? "/opportunities",
    ctaLabel: slot.cta_label?.trim() || DEFAULT_CTA[slot.kind],
    rows: rows.slice(0, 3),
  };
}

const AUTO_KINDS: FeaturedKind[] = ["fund", "producer", "project"];

/**
 * When the admin queue is empty, the column runs itself: a fund, then a
 * producer, then a project, then round again. Each kind keeps its own
 * candidate list and advances one place every time its turn comes, so the
 * same fund is not shown three weeks running.
 *
 * A kind with no candidates is skipped rather than shown blank, so a
 * platform with nine producers still fills all three days.
 */
async function autoPick(day: number): Promise<{ kind: FeaturedKind; ref_id: string } | null> {
  const supabase = await createClient();
  const start = ((day % AUTO_KINDS.length) + AUTO_KINDS.length) % AUTO_KINDS.length;
  const turn  = Math.floor(day / AUTO_KINDS.length);

  for (let step = 0; step < AUTO_KINDS.length; step++) {
    const kind = AUTO_KINDS[(start + step) % AUTO_KINDS.length];
    let ids: string[] = [];

    if (kind === "fund") {
      // Closing soonest first: the most useful fund to put in front of
      // someone is the one they are about to miss.
      const { data } = await supabase
        .from("opportunities")
        .select("id")
        .eq("is_active", true)
        .eq("deadline_type", "fixed")
        .gte("deadline", new Date().toISOString().slice(0, 10))
        .order("deadline", { ascending: true })
        .limit(20);
      ids = (data ?? []).map((r: any) => r.id);

      // No dated fund due? Use the ones that are open right now instead.
      if (ids.length === 0) {
        const { data: rolling } = await supabase
          .from("opportunities")
          .select("id")
          .eq("is_active", true)
          .eq("deadline_type", "rolling")
          .order("created_at", { ascending: false })
          .limit(20);
        ids = (rolling ?? []).map((r: any) => r.id);
      }
    }

    if (kind === "producer") {
      const { data } = await supabase
        .from("profiles")
        .select("id")
        .eq("role", "producer")
        .eq("approval_status", "approved")
        .order("created_at", { ascending: true })
        .limit(20);
      ids = (data ?? []).map((r: any) => r.id);
    }

    if (kind === "project") {
      // Poster required. A project card with no artwork is the weakest
      // thing this column can show, and there is always a fund instead.
      const { data } = await supabase
        .from("projects")
        .select("id")
        .eq("is_public", true)
        .eq("admin_hidden", false)
        .not("poster_path", "is", null)
        .neq("poster_path", "")
        .order("created_at", { ascending: false })
        .limit(20);
      ids = (data ?? []).map((r: any) => r.id);
    }

    if (ids.length > 0) {
      return { kind, ref_id: ids[((turn % ids.length) + ids.length) % ids.length] };
    }
  }

  return null;
}

/**
 * Today's card. The admin queue wins. With nothing queued, the column
 * rotates fund, producer, project on its own, so it is never blank and
 * never the same thing two days running.
 */
export async function getFeaturedToday(): Promise<FeaturedCardData | null> {
  const slots = await activeSlots();
  const day   = dayNumber();

  const chosen = pickForDay(slots, day);
  if (chosen) {
    const card = await hydrate(chosen);
    if (card) return card;
  }

  const auto = await autoPick(day);
  if (!auto) return null;

  return hydrate({
    id: "auto", kind: auto.kind, ref_id: auto.ref_id,
    title: null, subtitle: null, hook: null, image_url: null,
    link_url: null, cta_label: null, rows: [],
    sort_order: 0, is_active: true, created_at: "",
  });
}

/**
 * What the next `days` days will show. Powers the admin schedule.
 *
 * When no queued slot covers a day, `autoKind` says which kind the
 * automatic rotation will reach for. It is computed from the date alone,
 * without touching the database, because the schedule view only needs the
 * shape of the week, not the specific record.
 */
export async function getUpcoming(days = 14): Promise<
  { date: string; slot: FeaturedSlot | null; autoKind: FeaturedKind }[]
> {
  const slots = await activeSlots();
  const today = dayNumber();
  return Array.from({ length: days }, (_, i) => {
    const day = today + i;
    const d = new Date(day * 86_400_000);
    return {
      date: d.toISOString().slice(0, 10),
      slot: pickForDay(slots, day),
      autoKind: AUTO_KINDS[((day % AUTO_KINDS.length) + AUTO_KINDS.length) % AUTO_KINDS.length],
    };
  });
}
