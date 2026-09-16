import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Wordmark from "@/components/Wordmark";
import ShareLinkButton from "@/components/ShareLinkButton";
import BroadcastBody, { firstBroadcastImage } from "@/components/BroadcastBody";
import { parseBroadcastBody } from "@/lib/broadcast-body";
import { SITE, absoluteUrl } from "@/lib/seo";

export const revalidate = 300;

type Props = { params: Promise<{ slug: string }> };

interface PublicAnnouncement {
  id: string;
  subject: string | null;
  body: string;
  like_count: number;
  created_at: string;
  edited_at: string | null;
}

/**
 * Only an announcement an admin sent to *everyone* has a public page. The RPC
 * enforces that — it filters on is_public and audience = 'all' — so a
 * producers-only or filmmakers-only message cannot be reached here even if
 * someone guesses a slug.
 */
async function loadAnnouncement(slug: string): Promise<PublicAnnouncement | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("public_announcement", { p_slug: slug });
  if (error || !data) return null;
  const row = Array.isArray(data) ? data[0] : data;
  return (row as PublicAnnouncement) ?? null;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric", month: "long", year: "numeric",
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const a = await loadAnnouncement(slug);
  if (!a) return { title: "Announcement not found — PITCH.FYLYM" };

  const heading = a.subject?.trim() || "An announcement from PITCH.FYLYM";
  const title = `${heading} | PITCH.FYLYM`;

  const plain = parseBroadcastBody(a.body).text.replace(/\s+/g, " ").trim();
  const description = plain
    ? plain.slice(0, 155) + (plain.length > 155 ? "…" : "")
    : "News from PITCH.FYLYM — where films find funding.";

  // An announcement's own attachment when it has one: an admin who attached a
  // poster meant that image to be the message. A page-level openGraph replaces
  // the root layout's outright, so the fallback has to be spelled out here or
  // the link shares with no image at all.
  const image = firstBroadcastImage(a.body);
  const url = absoluteUrl(`/announcements/${slug}`);

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      siteName: SITE.name,
      type: "article",
      images: image
        ? [{ url: image, alt: heading }]
        : [{ url: "/og-default.png", width: 1200, height: 630 }],
    },
    twitter: {
      card: image ? "summary" : "summary_large_image",
      title,
      description,
      images: [image || "/og-default.png"],
    },
    alternates: { canonical: url },
  };
}

export default async function AnnouncementPage({ params }: Props) {
  const { slug } = await params;
  const a = await loadAnnouncement(slug);
  if (!a) notFound();

  const heading = a.subject?.trim() || "An announcement from PITCH.FYLYM";

  return (
    <div className="min-h-screen bg-ivory">
      <header className="px-6 md:px-12 py-6 hairline">
        <Wordmark />
      </header>

      <main className="px-6 md:px-12 py-12">
        <article className="max-w-2xl mx-auto">
          <p className="eyebrow text-gold">Announcement</p>

          <h1 className="font-display text-[34px] leading-[1.15] mt-3">{heading}</h1>

          <p className="mt-4 text-[13px] text-ash">
            {fmtDate(a.created_at)}
            {a.edited_at && <span className="text-gold"> · Edited</span>}
            {a.like_count > 0 && (
              <>
                {" · "}
                <span className="text-rose-500">♥</span> {a.like_count}
              </>
            )}
          </p>

          <div className="mt-8">
            <BroadcastBody body={a.body} size="lg" />
          </div>

          <div className="mt-10 hairline pt-6 flex items-center gap-3">
            <ShareLinkButton
              compact
              label="Share this announcement"
              path={`/announcements/${slug}`}
              title={`${heading} — PITCH.FYLYM`}
              text={`${heading}. From PITCH.FYLYM — where films find funding.`}
            />
            <span className="text-[13px] text-ash">Share this announcement</span>
          </div>

          {/* The whole point of a public announcement page is that it reaches
              people who are not signed up yet. Give them the door. */}
          <div className="mt-12 card p-7">
            <p className="font-display text-[22px]">Where films find funding</p>
            <p className="mt-3 text-[14px] text-ash leading-relaxed max-w-prose">
              PITCH.FYLYM is the intelligent global funding network for film — connecting
              projects, capital and industry partners to get great films made.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/signup" className="btn-gold">Join PITCH.FYLYM →</Link>
              <Link href="/opportunities" className="btn-ghost">Browse opportunities</Link>
            </div>
          </div>
        </article>
      </main>
    </div>
  );
}
