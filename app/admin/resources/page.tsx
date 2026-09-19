import { createClient } from "@/lib/supabase/server";
import ResourceForm, { type ResourceRow } from "./ResourceForm";
import ResourcesAdminList from "./ResourcesAdminList";

export const dynamic = "force-dynamic";

export default async function AdminResourcesPage() {
  const supabase = await createClient();

  // Column list is explicit rather than "*". PostgREST fails the whole query
  // on an unknown column and returns null with no error, so naming them means
  // a schema drift shows up here as an empty list rather than silently.
  const { data, error } = await supabase
    .from("filmmaking_resources")
    .select("id, title, description, url, image_url, category, sort_order, is_published")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = (data ?? []) as ResourceRow[];
  const published = rows.filter((r) => r.is_published).length;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Filmmaking resources</p>
          <h1 className="font-display text-[30px] font-normal mt-1">Resources</h1>
        </div>
        {!error && (
          <p className="text-[13px] text-ash">
            {published} published · {rows.length - published} draft
          </p>
        )}
      </div>

      <p className="text-[14px] text-ash mt-3 max-w-[62ch]">
        Services, software and tools for filmmakers. Published resources appear in the
        filmmaker dashboard sidebar and on their Resources page. Drafts are invisible to
        everyone but you.
      </p>

      {error && (
        <div className="mt-8 card border-gold/50 bg-gold/5 px-5 py-4 text-[14px]">
          <span className="font-normal">Resources table not found.</span>{" "}
          <span className="text-ash">
            Run <code>supabase/migrations/084_filmmaking_resources.sql</code> in the Supabase
            SQL editor to enable this module. It also creates the image bucket.
          </span>
        </div>
      )}

      {!error && (
        <>
          <div className="card mt-8 p-6 sm:p-8">
            <p className="eyebrow">Add resource</p>
            <h2 className="font-display text-[22px] font-normal mt-1 mb-6">New resource</h2>
            <ResourceForm />
          </div>

          <div className="card mt-10">
            <ResourcesAdminList rows={rows} />
          </div>
        </>
      )}
    </div>
  );
}
