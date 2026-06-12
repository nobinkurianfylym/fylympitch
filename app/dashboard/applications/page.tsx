import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, string> = {
  accepted: "text-[#3e6b3e]",
  shortlisted: "text-[#8A6F3E]",
  rejected: "text-red-800",
};

export default async function ApplicationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: apps } = await supabase
    .from("applications")
    .select("*, projects(title), opportunities(title, id)")
    .eq("applicant_id", user!.id)
    .order("created_at", { ascending: false });

  return (
    <div>
      <p className="eyebrow mb-3">Tracking</p>
      <h1 className="font-display text-[34px]">Applications</h1>
      <div className="mt-10">
        {(apps ?? []).map((a: any) => (
          <div key={a.id} className="hairline py-5 flex items-center justify-between gap-6">
            <div className="min-w-0">
              <Link href={`/dashboard/opportunities/${a.opportunities?.id}`} className="font-normal text-[15px] hover:text-gold transition-colors">
                {a.opportunities?.title ?? "Opportunity"}
              </Link>
              <div className="mt-1 text-[12px] tracking-[0.14em] uppercase text-ash">
                {a.projects?.title} · sent {timeAgo(a.created_at)} {a.match_score != null ? `· match ${a.match_score}` : ""}
              </div>
            </div>
            <span className={`text-[12px] tracking-[0.16em] uppercase ${STATUS_TONE[a.status] ?? "text-ash"}`}>{a.status.replace("_", " ")}</span>
          </div>
        ))}
        {(!apps || apps.length === 0) && (
          <p className="hairline py-10 text-[14px] text-ash">
            No applications yet. Open an <Link href="/dashboard/opportunities" className="text-ink underline underline-offset-4 hover:text-gold">opportunity</Link> and apply with one of your projects.
          </p>
        )}
      </div>
    </div>
  );
}
