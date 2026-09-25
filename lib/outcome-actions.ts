"use server";
// lib/outcome-actions.ts
//
// One filmmaker-facing action. Authorisation lives in the SQL
// function, which only updates a row whose applicant_id is the
// caller, so there is nothing to check twice here.

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function recordOutcome(
  applicationId: string,
  outcome: "accepted" | "rejected" | "waiting" | "dismiss",
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const { error } = await supabase.rpc("record_application_outcome", {
    p_application_id: applicationId,
    p_outcome: outcome,
  });

  if (error) return { error: error.message };

  revalidatePath("/dashboard/applications");
  revalidatePath("/dashboard/notifications");
  return {};
}
