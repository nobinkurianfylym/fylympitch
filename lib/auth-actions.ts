"use server";
// ── Lightweight auth + notification actions ──────────────────
// Kept separate from lib/actions.ts so that layouts (producer, dashboard)
// can import signOut without pulling the entire AI engine into their
// module graph — which caused Cloudflare Workers CPU limit (Error 1102).

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function markAllRead() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", user.id)
    .eq("read", false);
  revalidatePath("/dashboard/notifications");
  revalidatePath("/producer/notifications");
}

export async function deleteNotification(formData: FormData) {
  const id = formData.get("notification_id") as string;
  if (!id) return;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from("notifications")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  revalidatePath("/dashboard/notifications");
  revalidatePath("/producer/notifications");
}

export async function deleteAllNotifications() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from("notifications")
    .delete()
    .eq("user_id", user.id);
  revalidatePath("/dashboard/notifications");
  revalidatePath("/producer/notifications");
}
