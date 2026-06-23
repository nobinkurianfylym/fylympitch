"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function toggleSavedOpportunity(
  opportunityId: string,
  projectId?: string
): Promise<{ saved: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { saved: false, error: "Not authenticated" };

  // Check if already saved
  const { data: existing } = await supabase
    .from("saved_opportunities")
    .select("id")
    .eq("user_id", user.id)
    .eq("opportunity_id", opportunityId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("saved_opportunities")
      .delete()
      .eq("id", existing.id);
    if (error) return { saved: true, error: error.message };
    revalidatePath("/dashboard/saved");
    revalidatePath("/dashboard/opportunities");
    if (projectId) revalidatePath(`/dashboard/projects/${projectId}`);
    return { saved: false };
  } else {
    const payload: Record<string, unknown> = {
      user_id:        user.id,
      opportunity_id: opportunityId,
    };
    if (projectId) payload.project_id = projectId;
    const { error } = await supabase
      .from("saved_opportunities")
      .insert(payload);
    if (error) return { saved: false, error: error.message };
    revalidatePath("/dashboard/saved");
    revalidatePath("/dashboard/opportunities");
    if (projectId) revalidatePath(`/dashboard/projects/${projectId}`);
    return { saved: true };
  }
}

export async function getSavedOpportunityIds(
  opportunityIds: string[]
): Promise<Set<string>> {
  if (!opportunityIds.length) return new Set();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Set();

  const { data } = await supabase
    .from("saved_opportunities")
    .select("opportunity_id")
    .eq("user_id", user.id)
    .in("opportunity_id", opportunityIds);

  return new Set((data ?? []).map((r: any) => r.opportunity_id));
}
