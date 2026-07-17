"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Logs a single opportunity view to activity_logs.
 *
 * RLS ("write own activity") only permits inserts where user_id = auth.uid(),
 * so anonymous visitors are a deliberate no-op rather than an error — the
 * "Opportunity views" metric on /admin therefore counts signed-in views only.
 *
 * Fire-and-forget: never throws into the render path.
 */
export async function logOpportunityView(opportunityId: string) {
  if (!opportunityId) return;

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return; // anon view — cannot be attributed, so it is not counted

    await supabase.from("activity_logs").insert({
      user_id: user.id,
      action: "opportunity_viewed",
      entity: "opportunity",
      entity_id: opportunityId,
    });
  } catch {
    // View logging must never break the page it is measuring.
  }
}
