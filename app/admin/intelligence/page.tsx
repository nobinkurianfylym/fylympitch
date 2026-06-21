// app/admin/intelligence/page.tsx
// ============================================================
// FYLYMPITCH — Admin: Funding Intelligence Engine
// Shows crawl run history, admin review queue, and stats.
// Includes ReviewQueueActions client component for approve/reject.
// ============================================================

import { createClient } from "@/lib/supabase/server";
import { ReviewQueueActions } from "./ReviewQueueActions";
import { TriggerCrawlButton } from "./TriggerCrawlButton";

export const dynamic = "force-dynamic";

export default async function AdminIntelligencePage() {
  const supabase = await createClient();

  // ── Latest 10 crawl runs ──────────────────────────────────
  const { data: runs } = await supabase
    .from("funding_crawl_runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(10);

  // ── Pending review queue ──────────────────────────────────
  const { data: queue } = await supabase
    .from("admin_review_queue")
    .select("*, funding_sources(organization_name, program_name)")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(50);

  // ── Source health ─────────────────────────────────────────
  const { count: totalSources } = await supabase
    .from("funding_sources")
    .select("id", { count: "exact", head: true })
    .eq("crawl_active", true);

  const { count: failingSources } = await supabase
    .from("funding_sources")
    .select("id", { count: "exact", head: true })
    .gte("fail_count", 3);

  // ── Overall stats ─────────────────────────────────────────
  const { count: autoCrawled } = await supabase
    .from("opportunities")
    .select("id", { count: "exact", head: true })
    .eq("auto_crawled", true);

  const latestRun = (runs ?? [])[0];

  return (
    <div>
      <p className="eyebrow">Funding engine</p>
      <h1 className="font-display text-[30px] font-normal mt-1">
        Intelligence Engine
      </h1>
      <p className="text-[13px] text-ash font-normal mt-1">
        Daily crawl · {totalSources ?? 0} active sources · {autoCrawled ?? 0} auto-discovered opportunities
      </p>

      {/* Manual trigger + source health */}
      <div className="mt-8 flex items-start gap-4 flex-wrap">
        <TriggerCrawlButton />
        {(failingSources ?? 0) > 0 && (
          <div className="text-[12px] text-amber-700 bg-amber-50 border border-amber-200 px-4 py-2 rounded font-normal">
            {failingSources} source{(failingSources ?? 0) > 1 ? "s" : ""} failing (≥3 consecutive errors)
          </div>
        )}
      </div>

      {/* Latest run summary */}
      {latestRun && (
        <div className="mt-8">
          <p className="eyebrow">Latest run</p>
          <div className="card mt-3 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className={`text-[11px] uppercase tracking-[0.14em] font-normal px-2 py-0.5 rounded ${
                  latestRun.status === "complete"
                    ? "bg-emerald-50 text-emerald-700"
                    : latestRun.status === "running"
                    ? "bg-blue-50 text-blue-700"
                    : "bg-red-50 text-red-700"
                }`}>
                  {latestRun.status}
                </span>
              </div>
              <span className="text-[12px] text-ash font-normal">
                {new Date(latestRun.started_at).toLocaleString()}
                {latestRun.finished_at && (
                  <> · {Math.round(
                    (new Date(latestRun.finished_at).getTime() - new Date(latestRun.started_at).getTime()) / 1000
                  )}s</>
                )}
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Sources crawled",    value: latestRun.sources_crawled },
                { label: "Pages visited",      value: latestRun.pages_visited },
                { label: "New opportunities",  value: latestRun.new_opportunities,  accent: (latestRun.new_opportunities ?? 0) > 0 },
                { label: "Updated",            value: latestRun.updated_opportunities },
                { label: "Expired",            value: latestRun.expired_opportunities },
                { label: "Pending review",     value: latestRun.pending_review,     accent: (latestRun.pending_review ?? 0) > 0 },
                { label: "Failed crawls",      value: latestRun.failed_crawls,      warn: (latestRun.failed_crawls ?? 0) > 0 },
                { label: "Avg confidence",     value: latestRun.avg_confidence ? `${Number(latestRun.avg_confidence).toFixed(0)}%` : "—" },
              ].map((s) => (
                <div key={s.label}>
                  <p className={`text-[24px] font-normal ${
                    s.accent ? "text-gold" : s.warn ? "text-red-600" : "text-ink"
                  }`}>{s.value ?? 0}</p>
                  <p className="text-[11px] uppercase tracking-[0.12em] text-ash font-normal mt-0.5">
                    {s.label}
                  </p>
                </div>
              ))}
            </div>
            {latestRun.error_summary && (
              <p className="mt-4 text-[12px] text-red-600 font-normal bg-red-50 px-3 py-2 rounded">
                {latestRun.error_summary}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Admin review queue */}
      <div className="mt-10">
        <div className="flex items-baseline gap-3 mb-3">
          <p className="eyebrow">Review queue</p>
          {(queue ?? []).length > 0 && (
            <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-full font-normal">
              {queue?.length}
            </span>
          )}
        </div>
        <p className="text-[12px] text-ash font-normal mb-4">
          Items where AI confidence was below 90%. Review and approve or reject each one.
        </p>

        {(!queue || queue.length === 0) ? (
          <div className="card px-6 py-10 text-center">
            <p className="text-[13px] text-ash font-normal">Queue is clear — no items pending review.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {queue.map((item) => {
              const d = item.extracted_data as Record<string, unknown>;
              const src = Array.isArray(item.funding_sources)
                ? item.funding_sources[0]
                : item.funding_sources;
              return (
                <div key={item.id} className="card p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-[11px] uppercase tracking-[0.14em] text-ash font-normal">
                          {src?.organization_name ?? "Unknown org"}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-normal ${
                          (item.confidence ?? 0) >= 75
                            ? "bg-yellow-50 text-yellow-700"
                            : "bg-red-50 text-red-600"
                        }`}>
                          {item.confidence}% confidence
                        </span>
                        {!!d.opp_type && (
                          <span className="text-[10px] bg-ivory border border-line px-1.5 py-0.5 rounded font-normal text-ash">
                            {String(d.opp_type)}
                          </span>
                        )}
                      </div>
                      <h3 className="font-display text-[18px] font-normal text-ink leading-tight">
                        {String(d.title ?? "Untitled")}
                      </h3>
                      <p className="text-[12px] text-ash font-normal mt-1 line-clamp-2">
                        {String(d.description ?? "")}
                      </p>
                      <div className="flex gap-4 mt-2 text-[11px] text-ash font-normal flex-wrap">
                        {!!d.deadline && <span>Deadline: <strong className="text-ink">{String(d.deadline)}</strong></span>}
                        {!!d.max_award_usd && (
                          <span>Award: <strong className="text-ink">
                            ${Number(d.max_award_usd).toLocaleString()}
                          </strong></span>
                        )}
                        {!!d.country && <span>Country: <strong className="text-ink">{String(d.country)}</strong></span>}
                      </div>
                      <a
                        href={item.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-gold hover:underline font-normal mt-1 inline-block"
                      >
                        View source ↗
                      </a>
                    </div>
                    <ReviewQueueActions
                      itemId={item.id}
                      extractedData={item.extracted_data as Record<string, unknown>}
                      sourceUrl={item.source_url}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Crawl run history */}
      <div className="mt-10">
        <p className="eyebrow mb-3">Crawl history</p>
        <div className="card divide-y divide-line">
          {(!runs || runs.length === 0) ? (
            <p className="px-5 py-6 text-[13px] text-ash font-normal">No runs yet.</p>
          ) : (
            runs.map((r) => (
              <div key={r.id} className="px-5 py-3 flex items-center justify-between gap-4 text-[13px] font-normal">
                <div className="flex items-center gap-3">
                  <span className={`text-[10px] uppercase tracking-[0.12em] px-1.5 py-0.5 rounded ${
                    r.status === "complete"
                      ? "bg-emerald-50 text-emerald-700"
                      : r.status === "running"
                      ? "bg-blue-50 text-blue-700"
                      : "bg-red-50 text-red-700"
                  }`}>{r.status}</span>
                  <span className="text-ink">
                    {r.new_opportunities ?? 0} new · {r.updated_opportunities ?? 0} updated · {r.failed_crawls ?? 0} failed
                  </span>
                </div>
                <div className="flex items-center gap-4 text-ash text-[12px]">
                  {r.avg_confidence && (
                    <span>{Number(r.avg_confidence).toFixed(0)}% avg confidence</span>
                  )}
                  <span>{new Date(r.started_at).toLocaleString()}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
