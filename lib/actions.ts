"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { calculateMatchScore } from "@/services/matching";
import type { Opportunity, Project } from "@/types";

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

async function requireAdmin() {
  const { supabase, user } = await requireUser();
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/dashboard");
  return { supabase, user };
}

function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}
function num(fd: FormData, key: string): number | null {
  const v = str(fd, key);
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

// ---------- PROJECTS ----------
export async function createProject(formData: FormData) {
  const { supabase, user } = await requireUser();

  const title = str(formData, "title");
  const logline = str(formData, "logline");
  if (!title || !logline) return { error: "Title and logline are required." };
  if (logline.length > 500) return { error: "Logline must be 500 characters or fewer." };

  const { data, error } = await supabase
    .from("projects")
    .insert({
      owner_id: user.id,
      title,
      genre: str(formData, "genre") || "Drama",
      format: str(formData, "format") || "feature",
      language: str(formData, "language") || "English",
      country: str(formData, "country") || "India",
      budget_usd: num(formData, "budget_usd"),
      funding_needed_usd: num(formData, "funding_needed_usd"),
      stage: str(formData, "stage") || "development",
      logline,
      synopsis: str(formData, "synopsis") || null,
      director_statement: str(formData, "director_statement") || null,
      producer_info: str(formData, "producer_info") || null,
      pitch_deck_path: str(formData, "pitch_deck_path") || null,
      script_path: str(formData, "script_path") || null,
      is_public: formData.get("is_public") === "on",
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  await supabase.from("activity_logs").insert({
    user_id: user.id, action: "project_created", entity: "project", entity_id: data.id,
  });

  // Pre-compute and cache matches for this project
  const { data: opps } = await supabase.from("opportunities").select("*").eq("is_active", true);
  if (opps && opps.length) {
    const { data: project } = await supabase.from("projects").select("*").eq("id", data.id).single();
    if (project) {
      const rows = (opps as Opportunity[])
        .map((o) => ({ o, m: calculateMatchScore(project as Project, o) }))
        .filter((r) => r.m.tier !== "hidden")
        .map((r) => ({
          project_id: data.id,
          opportunity_id: r.o.id,
          score: r.m.score,
          confidence: r.m.confidence,
          reasons: r.m.reasons,
        }));
      if (rows.length) await supabase.from("matches").upsert(rows, { onConflict: "project_id,opportunity_id" });
    }
  }

  revalidatePath("/dashboard");
  redirect(`/dashboard/projects/${data.id}`);
}

export async function deleteProject(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = str(formData, "project_id");
  await supabase.from("projects").delete().eq("id", id).eq("owner_id", user.id);
  revalidatePath("/dashboard/projects");
  redirect("/dashboard/projects");
}

// ---------- APPLICATIONS ----------
export async function applyToOpportunity(formData: FormData) {
  const { supabase, user } = await requireUser();
  const project_id = str(formData, "project_id");
  const opportunity_id = str(formData, "opportunity_id");
  if (!project_id || !opportunity_id) return { error: "Select a project first." };

  const { data: project } = await supabase.from("projects").select("*").eq("id", project_id).eq("owner_id", user.id).single();
  const { data: opp } = await supabase.from("opportunities").select("*").eq("id", opportunity_id).single();
  if (!project || !opp) return { error: "Project or opportunity not found." };

  const match = calculateMatchScore(project as Project, opp as Opportunity);

  const { error } = await supabase.from("applications").insert({
    project_id, opportunity_id, applicant_id: user.id,
    cover_note: str(formData, "cover_note") || null,
    match_score: match.score,
  });
  if (error) {
    if (error.code === "23505") return { error: "You have already applied to this opportunity with this project." };
    return { error: error.message };
  }

  await supabase.from("activity_logs").insert({
    user_id: user.id, action: "application_sent", entity: "opportunity", entity_id: opportunity_id,
  });
  revalidatePath("/dashboard/applications");
  redirect("/dashboard/applications");
}

// ---------- SAVED ----------
export async function toggleSaved(formData: FormData) {
  const { supabase, user } = await requireUser();
  const opportunity_id = str(formData, "opportunity_id");
  const { data: existing } = await supabase
    .from("saved_opportunities").select("opportunity_id")
    .eq("user_id", user.id).eq("opportunity_id", opportunity_id).maybeSingle();
  if (existing) {
    await supabase.from("saved_opportunities").delete().eq("user_id", user.id).eq("opportunity_id", opportunity_id);
  } else {
    await supabase.from("saved_opportunities").insert({ user_id: user.id, opportunity_id });
  }
  revalidatePath("/dashboard/saved");
  revalidatePath("/dashboard/opportunities");
}

// ---------- OFFERS (producers / investors) ----------
export async function makeOffer(formData: FormData) {
  const { supabase, user } = await requireUser();
  const project_id = str(formData, "project_id");
  const message = str(formData, "message");
  if (!message) return { error: "Write a short message with your offer." };

  const { error } = await supabase.from("offers").insert({
    project_id,
    from_user_id: user.id,
    amount_usd: num(formData, "amount_usd"),
    offer_type: str(formData, "offer_type") || "investment",
    message,
  });
  if (error) return { error: "Could not send offer. Producer and investor accounts must be approved by FYLYMPITCH first." };

  await supabase.from("activity_logs").insert({
    user_id: user.id, action: "offer_made", entity: "project", entity_id: project_id,
  });
  revalidatePath(`/dashboard/discover`);
  return { success: true };
}

export async function respondToOffer(formData: FormData) {
  const { supabase, user } = await requireUser();
  const offer_id = str(formData, "offer_id");
  const decision = str(formData, "decision") === "accepted" ? "accepted" : "declined";

  const { data: offer } = await supabase
    .from("offers").select("id, project_id, from_user_id, projects!inner(owner_id, title)")
    .eq("id", offer_id).single();
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

// ---------- PROFILE ----------
export async function updateProfile(formData: FormData) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("profiles").update({
    full_name: str(formData, "full_name"),
    company: str(formData, "company") || null,
    country: str(formData, "country") || null,
    bio: str(formData, "bio") || null,
    website: str(formData, "website") || null,
    imdb_url: str(formData, "imdb_url") || null,
  }).eq("id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/profile");
  return { success: true };
}

// ---------- NOTIFICATIONS ----------
export async function markAllRead() {
  const { supabase, user } = await requireUser();
  await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
  revalidatePath("/dashboard/notifications");
}

// ---------- ADMIN ----------
export async function adminSetApproval(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const target = str(formData, "user_id");
  const status = str(formData, "status") === "approved" ? "approved" : "rejected";
  await supabase.from("profiles").update({ approval_status: status }).eq("id", target);
  await supabase.from("audit_logs").insert({
    actor_id: user.id, action: `user_${status}`, target: "profile", target_id: target,
  });
  await supabase.from("notifications").insert({
    user_id: target, kind: "system",
    title: status === "approved" ? "Your industry account is approved" : "Your account application was declined",
    body: status === "approved" ? "You can now browse projects and send offers." : "Contact support for details.",
    link: "/dashboard",
  });
  revalidatePath("/admin/users");
}

export async function adminToggleOpportunity(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const id = str(formData, "opportunity_id");
  const active = str(formData, "active") === "true";
  await supabase.from("opportunities").update({ is_active: active }).eq("id", id);
  await supabase.from("audit_logs").insert({
    actor_id: user.id, action: active ? "opportunity_activated" : "opportunity_deactivated",
    target: "opportunity", target_id: id,
  });
  revalidatePath("/admin/opportunities");
}

// ---------- ADMIN: PROJECT MANAGEMENT ----------
export async function adminToggleProjectVisibility(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const id = str(formData, "project_id");
  const is_public = str(formData, "is_public") === "true";
  await supabase.from("projects").update({ is_public }).eq("id", id);
  await supabase.from("audit_logs").insert({
    actor_id: user.id, action: is_public ? "project_unhidden" : "project_hidden",
    target: "project", target_id: id,
  });
  revalidatePath("/admin/projects");
}

export async function adminDeleteProject(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const id = str(formData, "project_id");
  await supabase.from("projects").delete().eq("id", id);
  await supabase.from("audit_logs").insert({
    actor_id: user.id, action: "project_removed", target: "project", target_id: id,
  });
  revalidatePath("/admin/projects");
}

// ---------- ADMIN: CERTIFICATE MANAGEMENT ----------
export async function adminSetCertificateStatus(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const id = str(formData, "certificate_id");
  const status = str(formData, "status") === "approved" ? "approved" : "rejected";
  const notes = str(formData, "notes") || null;
  await supabase.from("certificates")
    .update({ status, notes, reviewed_by: user.id, reviewed_at: new Date().toISOString() })
    .eq("id", id);
  await supabase.from("audit_logs").insert({
    actor_id: user.id, action: `certificate_${status}`, target: "certificate", target_id: id,
  });
  revalidatePath("/admin/certificates");
}

// ---------- ADMIN: MODERATION ----------
export async function adminResolveReport(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const id = str(formData, "report_id");
  const status = str(formData, "status") === "dismissed" ? "dismissed" : "resolved";
  await supabase.from("reports")
    .update({ status, resolved_by: user.id, resolved_at: new Date().toISOString() })
    .eq("id", id);
  await supabase.from("audit_logs").insert({
    actor_id: user.id, action: `report_${status}`, target: "report", target_id: id,
  });
  revalidatePath("/admin/moderation");
}

export async function adminCreateOpportunity(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const title = str(formData, "title");
  if (!title) return { error: "Title is required." };
  const list = (k: string) => str(formData, k) ? str(formData, k).split(",").map(s => s.trim()).filter(Boolean) : [];

  const { data, error } = await supabase.from("opportunities").insert({
    created_by: user.id,
    title,
    opp_type: str(formData, "opp_type") || "fund",
    description: str(formData, "description") || null,
    country: str(formData, "country") || null,
    region: str(formData, "region") || null,
    genres: list("genres"),
    formats: list("formats"),
    stages: list("stages"),
    languages: list("languages"),
    min_budget_usd: num(formData, "min_budget_usd"),
    max_budget_usd: num(formData, "max_budget_usd"),
    max_award_usd: num(formData, "max_award_usd"),
    deadline: str(formData, "deadline") || null,
    url: str(formData, "url") || null,
  }).select("id").single();

  if (error) return { error: error.message };
  await supabase.from("audit_logs").insert({
    actor_id: user.id, action: "opportunity_created", target: "opportunity", target_id: data.id,
  });
  revalidatePath("/admin/opportunities");
  redirect("/admin/opportunities");
}

// ---------- BOOTSTRAP: SELF-PROMOTE FIRST ADMIN ----------
export async function adminSelfPromote() {
  const { supabase, user } = await requireUser();

  const { count } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin");

  if ((count ?? 0) > 0) {
    redirect("/whoami?error=" + encodeURIComponent("An admin already exists — ask them to promote you, or update your role via SQL."));
  }

  const { error } = await supabase.from("profiles").update({ role: "admin" }).eq("id", user.id);
  if (error) {
    redirect("/whoami?error=" + encodeURIComponent(error.message));
  }

  redirect("/admin");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
