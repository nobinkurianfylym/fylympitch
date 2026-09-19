"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { normalizeUrl } from "@/lib/normalize-url";

// Admin-curated links to services filmmakers use. Admin writes them here;
// published rows surface in the filmmaker dashboard sidebar and on
// /dashboard/resources.

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if ((profile as { role?: string } | null)?.role !== "admin") redirect("/dashboard");
  return { supabase, user };
}

function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}

const MAX_DESCRIPTION = 280;

/** Both surfaces read through the dashboard layout, which is force-dynamic,
 *  so these are belt to that braces rather than the thing making it work. */
function revalidateResourceSurfaces() {
  revalidatePath("/dashboard", "layout");
  revalidatePath("/dashboard/resources");
  revalidatePath("/admin/resources");
}

type Result = { error: string } | undefined;

function readForm(fd: FormData): { values: Record<string, unknown> } | { error: string } {
  const title = str(fd, "title");
  const description = str(fd, "description");

  if (!title) return { error: "Title is required." };
  if (!description) return { error: "Description is required." };
  if (description.length > MAX_DESCRIPTION) {
    return { error: `Description is ${description.length} characters. The limit is ${MAX_DESCRIPTION}, because it has to fit the sidebar and the card.` };
  }

  // normalizeUrl supplies the scheme, so an admin can type "frame.io" and it
  // is stored as https://frame.io. It returns null for anything that is not a
  // plausible address, which is how a typo gets caught here instead of
  // shipping as a dead link.
  const url = normalizeUrl(str(fd, "url"));
  if (!url) return { error: "Link does not look like a web address." };

  // Either an uploaded file's public URL (set by the form) or one typed in.
  const rawImage = str(fd, "image_url");
  const image_url = rawImage ? normalizeUrl(rawImage) : null;
  if (rawImage && !image_url) return { error: "Image URL does not look like a web address." };

  const sortRaw = str(fd, "sort_order");
  const sort_order = sortRaw ? Number(sortRaw) : 0;
  if (!Number.isFinite(sort_order)) return { error: "Order must be a number." };

  return {
    values: {
      title,
      description,
      url,
      image_url,
      category: str(fd, "category") || null,
      sort_order,
      is_published: fd.get("is_published") === "on",
    },
  };
}

export async function adminCreateResource(formData: FormData): Promise<Result> {
  const { supabase, user } = await requireAdmin();
  const parsed = readForm(formData);
  if ("error" in parsed) return parsed;

  const { error } = await supabase
    .from("filmmaking_resources")
    .insert({ ...parsed.values, created_by: user.id });

  if (error) {
    // Surfaced rather than swallowed: the most likely cause is that migration
    // 084 has not been run, and a silent failure would look like a UI bug.
    return { error: `Could not save: ${error.message}` };
  }

  await supabase.from("audit_logs").insert({
    actor_id: user.id, action: "resource_created", target: "filmmaking_resource", target_id: null,
  });

  revalidateResourceSurfaces();
}

export async function adminUpdateResource(formData: FormData): Promise<Result> {
  const { supabase, user } = await requireAdmin();
  const id = str(formData, "id");
  if (!id) return { error: "Missing resource id." };

  const parsed = readForm(formData);
  if ("error" in parsed) return parsed;

  const { error } = await supabase
    .from("filmmaking_resources").update(parsed.values).eq("id", id);
  if (error) return { error: `Could not save: ${error.message}` };

  await supabase.from("audit_logs").insert({
    actor_id: user.id, action: "resource_updated", target: "filmmaking_resource", target_id: id,
  });

  revalidateResourceSurfaces();
}

/** Publish / unpublish from the list, without opening the editor. */
export async function adminToggleResourcePublished(formData: FormData): Promise<void> {
  const { supabase, user } = await requireAdmin();
  const id = str(formData, "id");
  const next = str(formData, "next") === "true";
  if (!id) return;

  await supabase.from("filmmaking_resources").update({ is_published: next }).eq("id", id);
  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: next ? "resource_published" : "resource_unpublished",
    target: "filmmaking_resource",
    target_id: id,
  });

  revalidateResourceSurfaces();
}

export async function adminDeleteResource(formData: FormData): Promise<void> {
  const { supabase, user } = await requireAdmin();
  const id = str(formData, "id");
  if (!id) return;

  // Read the image first. Deleting the row without this orphans the file in
  // the bucket forever -- nothing else references it.
  const { data: existing } = await supabase
    .from("filmmaking_resources").select("image_url").eq("id", id).single();

  await supabase.from("filmmaking_resources").delete().eq("id", id);

  const imageUrl = (existing as { image_url?: string | null } | null)?.image_url;
  if (imageUrl) {
    // Only our own bucket. An image_url pointing at someone else's site is a
    // link, not a file we own, and must not be touched.
    const marker = "/storage/v1/object/public/resource-images/";
    const at = imageUrl.indexOf(marker);
    if (at !== -1) {
      const path = decodeURIComponent(imageUrl.slice(at + marker.length).split("?")[0]);
      if (path) await supabase.storage.from("resource-images").remove([path]);
    }
  }

  await supabase.from("audit_logs").insert({
    actor_id: user.id, action: "resource_deleted", target: "filmmaking_resource", target_id: id,
  });

  revalidateResourceSurfaces();
}
