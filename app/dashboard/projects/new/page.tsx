import { createClient } from "@/lib/supabase/server";
import ProjectForm from "@/components/ProjectForm";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ producer?: string }>;
}) {
  const { producer: producerUsername } = await searchParams;

  let targetProducer: { id: string; full_name: string; company: string | null } | null = null;

  if (producerUsername) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, company")
      .eq("username", producerUsername)
      .eq("role", "producer")
      .single();
    targetProducer = data ?? null;
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

      <div className="mt-6">
        <ProjectForm targetProducerId={targetProducer?.id ?? null} />
      </div>
    </div>
  );
}
