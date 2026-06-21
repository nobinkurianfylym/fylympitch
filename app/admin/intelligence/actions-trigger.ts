"use server";
// app/admin/intelligence/actions-trigger.ts
// Server action that calls the Supabase Edge Function to trigger a crawl.

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

  // Call the Supabase Edge Function directly
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!serviceKey) {
    return { error: "Service role key not configured" };
  }

  try {
    const res = await fetch(
      `${supabaseUrl}/functions/v1/funding-intelligence`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!res.ok) {
      const text = await res.text();
      return { error: `Edge function error ${res.status}: ${text.slice(0, 200)}` };
    }

    const data = await res.json();
    revalidatePath("/admin/intelligence");
    return { data };
  } catch (err) {
    return { error: String(err) };
  }
}
