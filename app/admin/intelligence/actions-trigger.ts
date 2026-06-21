"use server";
// app/admin/intelligence/actions-trigger.ts
// Fire-and-forget trigger — returns immediately after starting the crawl.
// The edge function runs independently; page polls for results.

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function triggerCrawlRun(): Promise<{
  error?: string;
  data?: Record<string, unknown>;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: me } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") return { error: "Not admin" };

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!serviceKey) {
    return { error: "Service role key not configured" };
  }

  // Fire-and-forget — don't await the full crawl.
  // 49 sources takes 2-4 min; edge function runs independently.
  // We wait 1.5s for the run record to be created, then return.
  void fetch(`${supabaseUrl}/functions/v1/funding-intelligence`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
  }).catch(() => {});

  await new Promise((r) => setTimeout(r, 1500));
  revalidatePath("/admin/intelligence");
  return { data: { started: true } };
}
