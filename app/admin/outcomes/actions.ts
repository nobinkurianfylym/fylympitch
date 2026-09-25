"use server";
// app/admin/outcomes/actions.ts
// Admin-triggered only. The SQL function gates on the caller's role itself.

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type OutcomeAskItem = {
  application_id: string;
  name: string;
  project: string;
  fund: string;
  applied_on: string;
  deadline: string | null;
};

export type OutcomeRunResult = {
  run_id: string;
  dry_run: boolean;
  filmmakers: number;
  asks: number;
  items: OutcomeAskItem[];
  error?: string;
};

export async function runOutcomeAsk(
  _prev: OutcomeRunResult | null,
  formData: FormData,
): Promise<OutcomeRunResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return empty("Not authenticated");

  const weeks = Number(formData.get("weeks_after") ?? 3);
  const send  = formData.get("mode") === "send";

  const { data, error } = await supabase.rpc("application_outcome_run", {
    p_weeks_after: Number.isFinite(weeks) ? Math.min(52, Math.max(1, weeks)) : 3,
    p_dry_run: !send,
  });

  if (error) return empty(error.message);

  revalidatePath("/admin/outcomes");
  return data as OutcomeRunResult;
}

function empty(message: string): OutcomeRunResult {
  return { run_id: "", dry_run: true, filmmakers: 0, asks: 0, items: [], error: message };
}
