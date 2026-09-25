"use server";
// app/admin/radar/actions.ts
//
// Deadline Radar is admin-triggered on purpose. Nothing here runs
// on a schedule, so no filmmaker is ever emailed without someone
// deciding to send it.
//
// All the work happens in deadline_radar_run(), a SECURITY DEFINER
// function that gates on the caller's admin role itself. It has to
// be SECURITY DEFINER because public.notifications has no INSERT
// policy: an app-side insert for another user fails silently, and a
// silent failure in a notification system is the worst kind.

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { lookupUserEmails } from "@/lib/admin-email";
import type { RadarProject } from "@/lib/email";

export type RadarRecipient = {
  user_id: string;
  name: string;
  projects: RadarProject[];
};

export type RadarResult = {
  run_id: string;
  dry_run: boolean;
  filmmakers: number;
  projects: number;
  alerts: number;
  recipients: RadarRecipient[];
  emailed?: number;
  emailErrors?: string[];
  error?: string;
};

async function assertAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", supabase: null };
  const { data: me } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "admin") return { error: "Not admin", supabase: null };
  return { error: null, supabase };
}

function readForm(formData: FormData) {
  const windowDays = Number(formData.get("window_days") ?? 60);
  const minScore   = Number(formData.get("min_score") ?? 70);
  return {
    windowDays: Number.isFinite(windowDays) ? Math.min(365, Math.max(1, windowDays)) : 60,
    minScore:   Number.isFinite(minScore)   ? Math.min(100, Math.max(0, minScore))   : 70,
  };
}

/**
 * One entry point for both buttons. The submit button carries mode=preview or
 * mode=send, so the form has a single action and the page a single state.
 */
export async function runRadar(
  _prev: RadarResult | null,
  formData: FormData,
): Promise<RadarResult> {
  return formData.get("mode") === "send"
    ? sendRadar(formData)
    : previewRadar(formData);
}

/** Compute what would be sent. Writes nothing, marks nothing. */
export async function previewRadar(formData: FormData): Promise<RadarResult> {
  const { error, supabase } = await assertAdmin();
  if (error || !supabase) return emptyResult(error ?? "Not admin");

  const { windowDays, minScore } = readForm(formData);

  const { data, error: rpcErr } = await supabase.rpc("deadline_radar_run", {
    p_window_days: windowDays,
    p_min_score:   minScore,
    p_dry_run:     true,
  });

  if (rpcErr) return emptyResult(rpcErr.message);
  return data as RadarResult;
}

/**
 * Write the notifications. Emails only when the admin ticked the box,
 * and a failed email never rolls back a delivered notification: the
 * notification is the product, the email is the nudge.
 */
export async function sendRadar(formData: FormData): Promise<RadarResult> {
  const { error, supabase } = await assertAdmin();
  if (error || !supabase) return emptyResult(error ?? "Not admin");

  const { windowDays, minScore } = readForm(formData);
  const alsoEmail = formData.get("also_email") === "on";

  const { data, error: rpcErr } = await supabase.rpc("deadline_radar_run", {
    p_window_days: windowDays,
    p_min_score:   minScore,
    p_dry_run:     false,
  });

  if (rpcErr) return emptyResult(rpcErr.message);

  const result = data as RadarResult;
  result.emailed = 0;
  result.emailErrors = [];

  if (alsoEmail && result.recipients?.length) {
    const { sendDeadlineRadarEmail } = await import("@/lib/email");
    const emails = await lookupUserEmails(result.recipients.map(r => r.user_id));

    for (const recipient of result.recipients) {
      const to = emails.get(recipient.user_id);
      if (!to) {
        result.emailErrors.push(`${recipient.name}: no email on file`);
        continue;
      }
      try {
        const res = await sendDeadlineRadarEmail({
          to,
          filmmakerName: recipient.name,
          projects: recipient.projects ?? [],
        });
        if (res.ok) result.emailed!++;
        else result.emailErrors.push(`${recipient.name}: ${res.error}`);
      } catch (e) {
        result.emailErrors.push(`${recipient.name}: ${String(e)}`);
      }
    }

    await supabase.rpc("deadline_radar_mark_emailed", {
      p_run_id: result.run_id,
      p_count:  result.emailed,
    });
  }

  revalidatePath("/admin/radar");
  return result;
}

function emptyResult(message: string): RadarResult {
  return {
    run_id: "", dry_run: true, filmmakers: 0, projects: 0, alerts: 0,
    recipients: [], error: message,
  };
}
