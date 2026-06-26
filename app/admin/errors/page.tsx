import { createClient } from "@/lib/supabase/server";
import { timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

const SEVERITY_STYLES: Record<string, string> = {
  warn:     "bg-amber-50 text-amber-800 border-amber-200",
  error:    "bg-red-50 text-red-800 border-red-200",
  critical: "bg-red-100 text-red-900 border-red-400 font-semibold",
};

export default async function AdminErrors() {
  const supabase = await createClient();

  const { data: errors } = await supabase
    .from("platform_errors")
    .select("id, created_at, source, severity, message, context, resolved")
    .order("created_at", { ascending: false })
    .limit(200);

  const unresolved = (errors ?? []).filter((e) => !e.resolved);
  const resolved   = (errors ?? []).filter((e) => e.resolved);

  return (
    <div>
      <p className="eyebrow">Infrastructure</p>
      <h1 className="font-display text-[30px] font-normal mt-1">Error log</h1>
      <p className="mt-2 text-[14px] text-ash font-normal">
        Errors logged by Edge Functions and cron jobs. Resolve an entry in the SQL editor:{" "}
        <code className="text-[12px] bg-line px-1.5 py-0.5 rounded">
          UPDATE platform_errors SET resolved = true WHERE id = '…';
        </code>
      </p>

      {unresolved.length === 0 ? (
        <div className="card mt-8 px-6 py-8 text-center">
          <p className="text-[14px] text-ash">No unresolved errors.</p>
        </div>
      ) : (
        <>
          <p className="mt-6 text-[12px] tracking-[0.14em] uppercase text-ash">
            Unresolved — {unresolved.length}
          </p>
          <div className="card mt-2 divide-y divide-line">
            {unresolved.map((e) => (
              <ErrorRow key={e.id} error={e} />
            ))}
          </div>
        </>
      )}

      {resolved.length > 0 && (
        <>
          <p className="mt-8 text-[12px] tracking-[0.14em] uppercase text-ash">
            Resolved — {resolved.length}
          </p>
          <div className="card mt-2 divide-y divide-line opacity-60">
            {resolved.map((e) => (
              <ErrorRow key={e.id} error={e} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ErrorRow({ error }: { error: any }) {
  const severityClass = SEVERITY_STYLES[error.severity] ?? SEVERITY_STYLES.error;
  return (
    <div className="px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`text-[11px] px-2 py-0.5 rounded border ${severityClass} uppercase tracking-wide`}>
            {error.severity}
          </span>
          <span className="text-[12px] tracking-[0.12em] uppercase text-ash">{error.source}</span>
        </div>
        <span className="text-[12px] text-ash">{timeAgo(error.created_at)}</span>
      </div>
      <p className="mt-1.5 text-[14px] text-ink">{error.message}</p>
      {error.context && (
        <pre className="mt-2 text-[11px] text-ash bg-line/40 rounded px-3 py-2 overflow-x-auto whitespace-pre-wrap break-all">
          {JSON.stringify(error.context, null, 2)}
        </pre>
      )}
    </div>
  );
}
