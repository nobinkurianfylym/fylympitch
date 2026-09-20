import { createClient } from "@/lib/supabase/server";
import ProjectForm from "@/components/ProjectForm";
import { getProjectAllowance, projectLimitMessage } from "@/lib/project-limits";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ producer?: string; opp?: string }>;
}) {
  const { producer: producerUsername, opp: oppId } = await searchParams;

  // Check the limit BEFORE rendering the form. ProjectForm uploads the deck,
  // script and poster to storage from the browser and only then calls
  // createProject, so a filmmaker who is already at the cap used to do all of
  // that work, lose it to an error, and leave orphaned files in the bucket
  // with no row pointing at them.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const allowance = user
    ? await getProjectAllowance(supabase, user.id)
    : null;

  const targetProducerNote = producerUsername
    ? "You can still pitch a producer with a project you already have — open the brief, or their profile, and choose which one to send."
    : "You can still apply to any opportunity with a project you already have.";

  // Opened from an opportunity. Read it back so the banner can name the brief
  // -- and so an id that is not a real opportunity quietly becomes no banner
  // and no return address, rather than a broken round trip.
  const isUuid = !!oppId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(oppId);
  const { data: returnOpp } = isUuid
    ? await supabase.from("opportunities").select("id, title").eq("id", oppId).maybeSingle()
    : { data: null };

  let targetProducer: { id: string; full_name: string; company: string | null } | null = null;

  if (producerUsername) {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, company")
      .eq("username", producerUsername)
      .eq("role", "producer")
      .single();
    targetProducer = data ?? null;
  }

  if (allowance && !allowance.canCreate) {
    return (
      <div className="max-w-xl">
        <p className="eyebrow mb-3">New project</p>
        <h1 className="font-display text-[34px]">Project limit reached</h1>
        <p className="mt-5 text-[15px] text-ash leading-relaxed">
          {projectLimitMessage(allowance)}
        </p>
        <p className="mt-4 text-[14px] text-ash leading-relaxed">
          {targetProducerNote}
        </p>
        <Link href="/dashboard/projects" className="btn-gold inline-flex mt-7">
          Manage your projects →
        </Link>
      </div>
    );
  }

  return (
    <div>
      <p className="eyebrow mb-3">New project</p>
      <h1 className="font-display text-[34px]">Submit your project</h1>

      {targetProducer ? (
        <div className="mt-4 mb-8 flex items-center gap-3 px-4 py-3 rounded-card border border-gold/40 bg-gold/5">
          <span className="text-[10px] tracking-[0.2em] uppercase font-semibold text-gold">Exclusive Pitch</span>
          <span className="w-px h-4 bg-line" />
          <p className="text-[13px] text-ink">
            Pitching directly to <span className="font-semibold">{targetProducer.full_name}</span>
            {targetProducer.company && <span className="text-ash"> · {targetProducer.company}</span>}
          </p>
          <Link href={`/u/${producerUsername}`} className="ml-auto text-[11px] text-ash hover:text-ink transition-colors">
            View profile ↗
          </Link>
        </div>
      ) : (
        <p className="mt-3 text-[14px] text-ash max-w-xl">
          The more complete the profile, the more accurate your matches.
        </p>
      )}

      {returnOpp && (
        <div className="mt-4 mb-8 px-4 py-3 rounded-card border border-line bg-parchment">
          <p className="text-[13px] text-ink">
            Creating a project to pitch to{" "}
            <span className="font-semibold">{(returnOpp as { title: string }).title}</span>
          </p>
          <p className="text-[12px] text-ash mt-1">
            Save it and you will come straight back to the brief with this project selected,
            ready to submit.
          </p>
        </div>
      )}

      <div className="mt-6">
        <ProjectForm
          targetProducerId={targetProducer?.id ?? null}
          returnOpportunityId={(returnOpp as { id: string } | null)?.id ?? null}
        />
      </div>
    </div>
  );
}
