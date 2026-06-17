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
    link: "/dashboard/discover",
  });
  revalidatePath("/dashboard");
}
