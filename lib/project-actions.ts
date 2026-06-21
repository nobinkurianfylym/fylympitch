"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

export async function deleteProject(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = str(formData, "project_id");
  await supabase.from("projects").delete().eq("id", id).eq("owner_id", user.id);
  revalidatePath("/dashboard/projects");
  redirect("/dashboard/projects");
}

export async function respondToOffer(formData: FormData) {
  const { supabase, user } = await requireUser();
  const offer_id = str(formData, "offer_id");
  const decision =
    str(formData, "decision") === "accepted" ? "accepted" : "declined";

  const { data: offer } = await supabase
    .from("offers")
    .select("id, project_id, from_user_id, projects!inner(owner_id, title)")
    .eq("id", offer_id)
    .single();
  if (!offer) return;
  await supabase.from("offers").update({ status: decision }).eq("id", offer_id);
  await supabase.from("notifications").insert({
    user_id: offer.from_user_id,
    kind: "offer_update",
    title: `Your offer was ${decision}`,
    body: null,
    link: "/producer/projects",
  });
  revalidatePath("/dashboard");
}

export async function updateProject(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const id = formData.get("project_id") as string;
  if (!id) return;

  const patch: Record<string, unknown> = {
    title:              formData.get("title"),
    logline:            formData.get("logline"),
    genre:              formData.get("genre"),
    format:             formData.get("format"),
    stage:              formData.get("stage"),
    country:            formData.get("country"),
    language:           formData.get("language") || null,
    synopsis:           formData.get("synopsis") || null,
    director_statement: formData.get("director_statement") || null,
    producer_info:      formData.get("producer_info") || null,
    director_name:      formData.get("director_name") || null,
    writer_name:        formData.get("writer_name") || null,
    budget_usd:          formData.get("budget_usd") ? Number(formData.get("budget_usd")) : null,
    finance_secured_usd: formData.get("finance_secured_usd") ? Number(formData.get("finance_secured_usd")) : null,
    funding_needed_usd:  formData.get("funding_needed_usd") ? Number(formData.get("funding_needed_usd")) : null,
    is_public:          formData.get("is_public") === "true",
    updated_at:         new Date().toISOString(),
  };

  await supabase.from("projects").update(patch).eq("id", id).eq("owner_id", user.id);

  // Revalidate public-facing pages if project is public
  const { data: updated } = await supabase
    .from("projects").select("slug, is_public").eq("id", id).single();
  if ((updated as any)?.slug) {
    if ((updated as any)?.is_public) {
      revalidatePath(`/projects/${(updated as any).slug}`);
      revalidatePath("/projects");
      revalidatePath("/sitemap.xml");
    }
  }

  revalidatePath(`/dashboard/projects/${id}`);
  revalidatePath("/dashboard");
  redirect(`/dashboard/projects/${id}`);
}
