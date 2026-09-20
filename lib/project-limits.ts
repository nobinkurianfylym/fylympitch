import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * How many projects a filmmaker may have. Admins are exempt.
 *
 * This lived as a bare `>= 3` inside createProject and nowhere else, so the
 * rule was invisible until it fired. A filmmaker filled in the whole form,
 * uploaded a deck, a script and a poster -- all of which the client uploads to
 * storage BEFORE the server action runs -- and only then saw "Project limit
 * reached". The work was lost and the uploaded files stayed in the bucket with
 * no row pointing at them.
 *
 * One definition, read by the server action that enforces it and by every
 * surface that offers to create a project, so the offer and the rule cannot
 * disagree.
 */
export const MAX_PROJECTS_PER_FILMMAKER = 3;

export type ProjectAllowance = {
  /** Projects this user already has. */
  used: number;
  /** The cap, for display. Meaningless when exempt. */
  max: number;
  /** Admins have no cap. */
  exempt: boolean;
  /** Whether another project may be created right now. */
  canCreate: boolean;
  /** How many are left. Infinity-ish cases return null rather than a number. */
  remaining: number | null;
};

export async function getProjectAllowance(
  supabase: SupabaseClient,
  userId: string,
): Promise<ProjectAllowance> {
  const [{ data: profile }, { count }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", userId).single(),
    supabase.from("projects").select("id", { count: "exact", head: true }).eq("owner_id", userId),
  ]);

  const exempt = (profile as { role?: string } | null)?.role === "admin";
  const used = count ?? 0;

  if (exempt) {
    return { used, max: MAX_PROJECTS_PER_FILMMAKER, exempt: true, canCreate: true, remaining: null };
  }

  return {
    used,
    max: MAX_PROJECTS_PER_FILMMAKER,
    exempt: false,
    canCreate: used < MAX_PROJECTS_PER_FILMMAKER,
    remaining: Math.max(0, MAX_PROJECTS_PER_FILMMAKER - used),
  };
}

/** The one sentence every surface uses, so the wording cannot drift either. */
export function projectLimitMessage(a: ProjectAllowance): string {
  return `You have ${a.used} of ${a.max} projects. Filmmakers may keep up to ${a.max} at a time — delete one you are no longer pitching to make room.`;
}
