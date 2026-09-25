"use server";
// lib/featured-actions.ts
//
// Admin CRUD for the homepage featured column. RLS on
// featured_slots is what authorises every write; assertAdmin here
// is so the UI gets a sentence rather than a silent no-op.

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const BUCKET = "featured-images";

async function assertAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", supabase: null, userId: null };
  const { data: me } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") return { error: "Not admin", supabase: null, userId: null };
  return { error: null, supabase, userId: user.id };
}

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const nil = (v: string) => (v === "" ? null : v);

function refresh() {
  revalidatePath("/admin/featured");
  revalidatePath("/");
}

export async function createFeaturedSlot(formData: FormData): Promise<{ error?: string }> {
  const { error, supabase, userId } = await assertAdmin();
  if (error || !supabase) return { error: error ?? "Not admin" };

  const kind = str(formData, "kind");
  if (!["fund", "producer", "project", "custom"].includes(kind)) {
    return { error: "Pick what kind of card this is." };
  }

  const refId = nil(str(formData, "ref_id"));
  const title = nil(str(formData, "title"));

  if (kind === "custom" && !title) return { error: "A custom card needs a title." };
  if (kind !== "custom" && !refId)  return { error: "Paste the id of the fund, producer or project." };
  if (refId && !/^[0-9a-f-]{36}$/i.test(refId)) return { error: "That does not look like an id." };

  // Free-text rows, one per line: "Up to | $120,000 | gold"
  const rows = str(formData, "rows_text")
    .split("\n")
    .map(line => line.split("|").map(p => p.trim()))
    .filter(p => p[0] && p[1])
    .slice(0, 3)
    .map(p => ({ label: p[0], value: p[1], gold: (p[2] ?? "").toLowerCase() === "gold" }));

  // New cards go to the back of their own queue.
  const { data: last } = await supabase
    .from("featured_slots")
    .select("sort_order")
    .eq("kind", kind)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error: insErr } = await supabase.from("featured_slots").insert({
    kind,
    ref_id:    kind === "custom" ? null : refId,
    title,
    subtitle:  nil(str(formData, "subtitle")),
    hook:      nil(str(formData, "hook")),
    image_url: nil(str(formData, "image_url")),
    link_url:  nil(str(formData, "link_url")),
    cta_label: nil(str(formData, "cta_label")),
    rows,
    sort_order: (last?.sort_order ?? 0) + 10,
    is_active: formData.get("is_active") === "on",
    created_by: userId,
  });

  if (insErr) return { error: insErr.message };
  refresh();
  return {};
}

/**
 * Edit an existing card. The image round-trips through a hidden field, so
 * leaving it alone keeps it; replacing it deletes the old file from our
 * bucket, because nothing else ever references it.
 *
 * `kind` is not editable. Changing it would leave a ref_id pointing at the
 * wrong table, and deleting and re-adding is both clearer and safer.
 */
export async function updateFeaturedSlot(formData: FormData): Promise<{ error?: string }> {
  const { error, supabase } = await assertAdmin();
  if (error || !supabase) return { error: error ?? "Not admin" };

  const id = str(formData, "id");
  if (!id) return { error: "Missing id." };

  const { data: existing } = await supabase
    .from("featured_slots").select("kind, image_url").eq("id", id).maybeSingle();
  if (!existing) return { error: "That card no longer exists." };

  const refId = nil(str(formData, "ref_id"));
  const title = nil(str(formData, "title"));

  if (existing.kind === "custom" && !title) return { error: "A custom card needs a title." };
  if (existing.kind !== "custom" && !refId)  return { error: "Paste the id of the fund, producer or project." };
  if (refId && !/^[0-9a-f-]{36}$/i.test(refId)) return { error: "That does not look like an id." };

  const rows = str(formData, "rows_text")
    .split("\n")
    .map(line => line.split("|").map(p => p.trim()))
    .filter(p => p[0] && p[1])
    .slice(0, 3)
    .map(p => ({ label: p[0], value: p[1], gold: (p[2] ?? "").toLowerCase() === "gold" }));

  const imageUrl = nil(str(formData, "image_url"));

  const { error: upErr } = await supabase.from("featured_slots").update({
    ref_id:    existing.kind === "custom" ? null : refId,
    title,
    subtitle:  nil(str(formData, "subtitle")),
    hook:      nil(str(formData, "hook")),
    image_url: imageUrl,
    link_url:  nil(str(formData, "link_url")),
    cta_label: nil(str(formData, "cta_label")),
    rows,
    is_active: formData.get("is_active") === "on",
  }).eq("id", id);

  if (upErr) return { error: upErr.message };

  // The old image is now unreferenced. Only ever our own bucket.
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const old = existing.image_url ?? "";
  if (old && old !== imageUrl && old.includes(marker)) {
    const path = old.split(marker)[1];
    if (path) await supabase.storage.from(BUCKET).remove([decodeURIComponent(path)]);
  }

  refresh();
  return {};
}

export async function deleteFeaturedSlot(formData: FormData): Promise<{ error?: string }> {
  const { error, supabase } = await assertAdmin();
  if (error || !supabase) return { error: error ?? "Not admin" };

  const id = str(formData, "id");

  // Take the image with it. Only ever our own bucket: an image_url
  // pointing somewhere else is a link, not a file we own.
  const { data: row } = await supabase
    .from("featured_slots").select("image_url").eq("id", id).maybeSingle();

  const { error: delErr } = await supabase.from("featured_slots").delete().eq("id", id);
  if (delErr) return { error: delErr.message };

  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const url = row?.image_url ?? "";
  if (url.includes(marker)) {
    const path = url.split(marker)[1];
    if (path) await supabase.storage.from(BUCKET).remove([decodeURIComponent(path)]);
  }

  refresh();
  return {};
}

export async function toggleFeaturedActive(formData: FormData): Promise<{ error?: string }> {
  const { error, supabase } = await assertAdmin();
  if (error || !supabase) return { error: error ?? "Not admin" };

  const id = str(formData, "id");
  const { data: row } = await supabase
    .from("featured_slots").select("is_active").eq("id", id).maybeSingle();
  if (!row) return { error: "Not found" };

  const { error: upErr } = await supabase
    .from("featured_slots").update({ is_active: !row.is_active }).eq("id", id);
  if (upErr) return { error: upErr.message };

  refresh();
  return {};
}

/**
 * Move a card up or down within its own kind. Swapping sort_order
 * with the neighbour keeps the numbers small and stable, rather
 * than renumbering the whole queue on every click.
 */
export async function moveFeaturedSlot(formData: FormData): Promise<{ error?: string }> {
  const { error, supabase } = await assertAdmin();
  if (error || !supabase) return { error: error ?? "Not admin" };

  const id  = str(formData, "id");
  const dir = str(formData, "direction");
  if (dir !== "up" && dir !== "down") return { error: "Bad direction" };

  const { data: me } = await supabase
    .from("featured_slots").select("id, kind, sort_order").eq("id", id).maybeSingle();
  if (!me) return { error: "Not found" };

  const { data: neighbour } = await supabase
    .from("featured_slots")
    .select("id, sort_order")
    .eq("kind", me.kind)
    .neq("id", id)
    [dir === "up" ? "lt" : "gt"]("sort_order", me.sort_order)
    .order("sort_order", { ascending: dir !== "up" })
    .limit(1)
    .maybeSingle();

  if (!neighbour) return {};

  await supabase.from("featured_slots")
    .update({ sort_order: neighbour.sort_order }).eq("id", me.id);
  await supabase.from("featured_slots")
    .update({ sort_order: me.sort_order }).eq("id", neighbour.id);

  refresh();
  return {};
}

// ── Form-bound wrappers ───────────────────────────────────────
// <form action={fn}> requires void | Promise<void>. The functions
// above return a result object so they stay usable from a client
// component; these three are used directly as form actions in the
// admin list, where the page simply re-renders. A failure is logged
// rather than swallowed silently.

async function run(
  fn: (f: FormData) => Promise<{ error?: string }>,
  formData: FormData,
  name: string,
): Promise<void> {
  const res = await fn(formData);
  if (res?.error) console.error(`[featured] ${name}: ${res.error}`);
}

export async function deleteFeaturedSlotForm(formData: FormData): Promise<void> {
  await run(deleteFeaturedSlot, formData, "delete");
}

export async function toggleFeaturedActiveForm(formData: FormData): Promise<void> {
  await run(toggleFeaturedActive, formData, "toggle");
}

export async function moveFeaturedSlotForm(formData: FormData): Promise<void> {
  await run(moveFeaturedSlot, formData, "move");
}
