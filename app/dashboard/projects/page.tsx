import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { usd, STAGE_LABEL } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: projects } = await supabase
    .from("projects").select("*").eq("owner_id", user!.id)
    .order("created_at", { ascending: false });

  return (
    <div>
      <div className="flex items-end justify-between">
        <div>
          <p className="eyebrow mb-3">Projects</p>
          <h1 className="font-display text-[34px]">My projects</h1>
        </div>
        <Link href="/dashboard/projects/new" className="btn-gold">New project</Link>
      </div>

      <div className="mt-10">
        {(projects ?? []).map((p) => (
          <Link key={p.id} href={`/dashboard/projects/${p.id}`}
            className="hairline py-6 flex items-center justify-between gap-6 hover:bg-parchment/60 px-2 -mx-2 transition-colors">
            <div>
              <div className="font-display text-[20px]">{p.title}</div>
              <div className="mt-1.5 text-[12px] tracking-[0.14em] uppercase text-ash">
                {p.genre} · {p.format} · {STAGE_LABEL[p.stage]} · {p.country}
                {p.funding_needed_usd ? ` · seeking ${usd(p.funding_needed_usd)}` : ""}
              </div>
            </div>
            <span className="text-[12px] tracking-[0.16em] uppercase text-ash">{p.is_public ? "Public · on Projects" : "Private"}</span>
          </Link>
        ))}
        {(!projects || projects.length === 0) && (
          <div className="hairline py-12 text-[14px] text-ash">
            Your slate is empty. Submit a project to start receiving matches and offers.
          </div>
        )}
      </div>
    </div>
  );
}
