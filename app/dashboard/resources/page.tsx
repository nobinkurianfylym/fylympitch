import type { Metadata } from "next";
import { ROBOTS_NOINDEX } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";
import { getPublishedResources } from "@/lib/resources";
import { sized, srcSet2x } from "@/lib/image-url";

export const metadata: Metadata = {
  title: "Filmmaking Resources",
  robots: ROBOTS_NOINDEX,
};

export const dynamic = "force-dynamic";

export default async function ResourcesPage() {
  const supabase = await createClient();
  const resources = await getPublishedResources(supabase);

  // Group by category, keeping admin sort order within each group. Resources
  // with no category fall into one unlabelled group shown last.
  const groups = new Map<string, typeof resources>();
  for (const r of resources) {
    const key = r.category?.trim() || "";
    const bucket = groups.get(key);
    if (bucket) bucket.push(r);
    else groups.set(key, [r]);
  }
  const ordered = [...groups.entries()].sort(([a], [b]) => {
    if (a === "") return 1;
    if (b === "") return -1;
    return a.localeCompare(b);
  });

  return (
    <div>
      <p className="eyebrow">For filmmakers</p>
      <h1 className="font-display text-[30px] font-normal mt-1">Filmmaking Resources</h1>
      <p className="text-[14px] text-ash mt-3 max-w-[62ch]">
        Services, software and tools worth knowing about, collected by the PITCH.FYLYM team.
      </p>

      {resources.length === 0 && (
        <div className="card mt-10 px-6 py-10 text-center">
          <p className="text-[14px] text-ash">
            No resources have been published yet. Check back soon.
          </p>
        </div>
      )}

      {ordered.map(([category, items]) => (
        <section key={category || "_"} className="mt-10">
          {category && <p className="eyebrow mb-4">{category}</p>}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {items.map((r) => (
              <a
                key={r.id}
                href={r.url}
                target="_blank"
                // nofollow: these are curated links, not endorsements, and the
                // page is noindex anyway.
                rel="noopener noreferrer nofollow"
                className="card p-5 flex items-start gap-5 group"
              >
                <div className="w-[72px] h-[72px] shrink-0 rounded-card border border-line bg-parchment overflow-hidden flex items-center justify-center">
                  {r.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={sized(r.image_url, 72)}
                      srcSet={srcSet2x(r.image_url, 72)}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <span className="font-display text-[20px] text-ash">
                      {r.title.trim().charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>

                <div className="min-w-0">
                  <h2 className="text-[16px] group-hover:text-gold transition-colors">{r.title}</h2>
                  <p className="text-[13px] text-ash mt-1.5 leading-relaxed">{r.description}</p>
                  <span className="inline-block text-[11px] tracking-[0.16em] uppercase text-ash mt-3 group-hover:text-gold transition-colors">
                    Visit →
                  </span>
                </div>
              </a>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
