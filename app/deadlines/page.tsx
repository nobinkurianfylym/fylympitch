// app/deadlines/page.tsx
//
// The page most likely to be shared and re-visited: what is closing, in
// order, plus what is open right now. Rolling programmes get their own
// section because "open today" is the most actionable status there is and
// a date-sorted list hides them.

import Link from "next/link";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import { loadIndexableOpportunities } from "@/lib/hubs";
import { OPPORTUNITY_FAMILIES } from "@/lib/opportunity-taxonomy";
import HubList from "@/components/HubList";

export const revalidate = 3600;

const WINDOW_DAYS = 90;

export async function generateMetadata(): Promise<Metadata> {
  const rows = await loadIndexableOpportunities();
  const today = new Date().toISOString().slice(0, 10);
  const closing = rows.filter(r => r.deadline && r.deadline >= today).length;
  const open = rows.filter(r => r.deadline_type === "rolling").length;
  return pageMetadata({
    title: "Film Funding Deadlines",
    description: `${closing} film funding deadlines ahead and ${open} programmes accepting applications right now, updated daily.`,
    path: "/deadlines",
  });
}

export default async function DeadlinesPage() {
  const rows  = await loadIndexableOpportunities();
  const today = new Date().toISOString().slice(0, 10);
  const edge  = new Date(Date.now() + WINDOW_DAYS * 86_400_000).toISOString().slice(0, 10);

  const closing = rows.filter(r => r.deadline && r.deadline >= today && r.deadline <= edge);
  const later   = rows.filter(r => r.deadline && r.deadline > edge);
  const open    = rows.filter(r => !r.deadline && r.deadline_type === "rolling");

  const updated = new Date().toLocaleDateString("en-GB",
    { day: "numeric", month: "long", year: "numeric" });

  return (
    <main className="mx-auto max-w-4xl px-6 py-16 md:py-24">
      <h1 className="font-display text-[34px] md:text-[46px] font-normal leading-[1.08]">
        Film funding <span className="italic text-gold">deadlines</span>
      </h1>
      <p className="mt-5 max-w-2xl text-[17px] leading-[1.7] text-ash">
        {closing.length} programmes close within the next {WINDOW_DAYS} days and{" "}
        {open.length} accept applications year-round. Updated {updated}.
      </p>

      <section className="mt-14">
        <p className="eyebrow mb-1">Closing soon</p>
        <p className="mb-6 text-[14px] text-ash">Next {WINDOW_DAYS} days, soonest first.</p>
        <HubList rows={closing} />
      </section>

      {open.length > 0 && (
        <section className="mt-16">
          <p className="eyebrow mb-1">Open right now</p>
          <p className="mb-6 max-w-2xl text-[14px] text-ash">
            No deadline to miss. These accept applications continuously, which
            makes them the easiest place to start.
          </p>
          <HubList rows={open} />
        </section>
      )}

      {later.length > 0 && (
        <section className="mt-16">
          <p className="eyebrow mb-1">Further ahead</p>
          <p className="mb-6 text-[14px] text-ash">Beyond {WINDOW_DAYS} days.</p>
          <HubList rows={later.slice(0, 40)} />
        </section>
      )}

      <section className="mt-16 border-t border-line pt-10">
        <p className="eyebrow mb-4">Browse by kind</p>
        <div className="flex flex-wrap gap-2">
          {OPPORTUNITY_FAMILIES.map(f => (
            <Link key={f.slug} href={`/opportunities/type/${f.slug}`}
              className="rounded-full border border-line px-4 py-2 text-[12px] uppercase tracking-[0.12em] text-ash hover:border-gold hover:text-ink">
              {f.label}
            </Link>
          ))}
          <Link href="/opportunities/country"
            className="rounded-full border border-line px-4 py-2 text-[12px] uppercase tracking-[0.12em] text-ash hover:border-gold hover:text-ink">
            By country
          </Link>
        </div>
      </section>
    </main>
  );
}
