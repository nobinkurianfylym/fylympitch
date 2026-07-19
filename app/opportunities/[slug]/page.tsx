import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import Wordmark from "@/components/Wordmark";
import TrackOpportunityView from "@/components/TrackOpportunityView";
import { usd, TYPE_LABEL, STAGE_LABEL } from "@/lib/format";
import type { Opportunity } from "@/types";
import JsonLd from "@/components/JsonLd";
import AuthAwareCta from "@/components/AuthAwareCta";
import { opportunitySchema, breadcrumbSchema, faqPageSchema } from "@/lib/schema";
import { opportunityRobots } from "@/lib/seo";

export const revalidate = 3600; // ISR — re-generate at most once per hour

type Props = { params: Promise<{ slug: string }> };

// ── SEO metadata ──────────────────────────────────────────────────────────────
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: opp } = await supabase
    .from("opportunities")
    .select("slug, title, opp_type, description, country, region, deadline, max_award_usd, min_award_usd, is_active, is_producer_post, posted_by_producer_id, eligible_countries, career_stages")
    .eq("slug", slug)
    .eq("is_active", true)
    .single<any>();

  if (!opp) return { title: "Fund Not Found — PITCH.FYLYM" };

  const typeLabel   = TYPE_LABEL[opp.opp_type] ?? opp.opp_type;
  const location    = opp.country || opp.region || "International";
  const award       = opp.max_award_usd ? ` · Up to ${usd(opp.max_award_usd)}` : "";
  const description = opp.description
    ? opp.description.slice(0, 155) + (opp.description.length > 155 ? "…" : "")
    : `${opp.title} is a ${typeLabel.toLowerCase()} opportunity for independent filmmakers based in ${location}. Discover eligibility, deadlines and apply through PITCH.FYLYM.`;

  const title = `${opp.title} — ${typeLabel} · ${location}${award} | PITCH.FYLYM`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `https://pitch.fylym.com/opportunities/${slug}`,
      siteName: "PITCH.FYLYM",
      type: "website",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
    alternates: {
      canonical: `https://pitch.fylym.com/opportunities/${slug}`,
    },
    robots: opportunityRobots(opp),
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default async function FundDetailPage({ params }: Props) {
  const { slug } = await params;
  const supabase  = await createClient();

  const { data: opp } = await supabase
    .from("opportunities")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .single<Opportunity & { slug: string; key_person?: string | null; contact_email?: string | null; gender_focus?: string | null; copro_required?: boolean; festival_affiliated?: boolean; ott_affiliated?: boolean; deadline_note?: string | null; app_link?: string | null; posted_by_producer_id?: string | null; poster_url?: string | null; is_producer_post?: boolean }>();

  if (!opp) notFound();

  const o = opp as any;

  // For producer-posted opportunities, fetch producer display info
  let producerInfo: { full_name: string | null; username: string | null; company: string | null } | null = null;
  if ((opp as any).posted_by_producer_id) {
    const { data: pData } = await supabase
      .from("profiles")
      .select("full_name, username, company")
      .eq("id", (opp as any).posted_by_producer_id)
      .single();
    producerInfo = pData ?? null;
  }

  const typeLabel  = TYPE_LABEL[opp.opp_type] ?? opp.opp_type;
  const location   = [opp.country, opp.region].filter(Boolean).join(" · ") || "Worldwide";
  const officialLink = opp.app_link ?? opp.url ?? null;

  function formatDeadline(d: string | null, note: string | null): string {
    if (d) {
      return new Date(d).toLocaleDateString("en-GB", {
        day: "numeric", month: "long", year: "numeric",
      });
    }
    return note || "Check official website";
  }

  const tags: { label: string; value: string }[] = [
    ...(opp.genres?.length       ? [{ label: "Genres",    value: opp.genres.join(", ") }]                               : []),
    ...(opp.formats?.length      ? [{ label: "Formats",   value: opp.formats.map((f: string) => f.charAt(0).toUpperCase() + f.slice(1)).join(", ") }] : []),
    ...(opp.stages?.length       ? [{ label: "Stages",    value: opp.stages.map((s: string) => STAGE_LABEL[s] ?? s).join(", ") }] : []),
    ...(opp.languages?.length    ? [{ label: "Languages", value: opp.languages.join(", ") }]                            : []),
    ...(opp.gender_focus         ? [{ label: "Focus",     value: opp.gender_focus }]                                    : []),
    ...(opp.copro_required       ? [{ label: "Co-production", value: "Required" }]                                      : []),
    ...(opp.festival_affiliated  ? [{ label: "Festival",  value: "Affiliated" }]                                        : []),
    ...(opp.ott_affiliated       ? [{ label: "Platform",  value: "OTT / Streaming" }]                                   : []),
  ];

  // ── AEO: answer-first lede + data-derived FAQ (honest data only) ────────────
  const awardText =
    o.max_award_usd != null
      ? `up to ${usd(o.max_award_usd)}`
      : o.min_award_usd != null
      ? `from ${usd(o.min_award_usd)}`
      : null;
  const deadlineText = formatDeadline(opp.deadline, opp.deadline_note ?? null);
  const ledeText = `${opp.title} is a ${typeLabel.toLowerCase()} ${
    location !== "Worldwide" ? `based in ${location}` : "open to filmmakers worldwide"
  }${awardText ? `, awarding ${awardText}` : ""}${
    opp.deadline || opp.deadline_note ? `, with applications due ${deadlineText}` : ""
  }.`;
  const faqs = (
    [
      awardText
        ? { question: `How much does ${opp.title} award?`, answer: `${opp.title} awards ${awardText}.` }
        : null,
      opp.deadline || opp.deadline_note
        ? { question: `What is the application deadline for ${opp.title}?`, answer: `The application deadline is ${deadlineText}.` }
        : null,
      location !== "Worldwide" || (o.career_stages?.length ?? 0) > 0 || (o.eligible_countries?.length ?? 0) > 0
        ? {
            question: `Who is eligible for ${opp.title}?`,
            answer: `${opp.title} is ${location !== "Worldwide" ? `focused on ${location}` : "open internationally"}${
              o.career_stages?.length ? `, aimed at ${o.career_stages.join(", ")} filmmakers` : ""
            }.`,
          }
        : null,
      officialLink
        ? {
            question: `How do I apply to ${opp.title}?`,
            answer: `Apply via the official website${opp.deadline ? ` before ${deadlineText}` : ""}, or submit your project through PITCH.FYLYM to check your match first.`,
          }
        : null,
    ].filter(Boolean) as { question: string; answer: string }[]
  );

  // ── JSON-LD structured data (centralized, honest-data builders) ─────────────
  const jsonLd = [
    breadcrumbSchema([
      { name: "Opportunities", path: "/opportunities" },
      { name: opp.title, path: `/opportunities/${o.slug}` },
    ]),
    opportunitySchema(o),
    faqPageSchema(faqs),
  ];

  return (
    <div className="min-h-screen bg-ivory">
      <TrackOpportunityView opportunityId={opp.id} />

      {/* JSON-LD */}
      <JsonLd data={jsonLd} />
      <header className="border-b border-line">
        <div className="max-w-[1180px] mx-auto px-6 py-5 flex items-center justify-between">
          <Wordmark />
          <nav className="hidden md:flex items-center gap-8 text-[12px] tracking-[0.18em] uppercase font-[400] text-ash">
            <Link href="/#features"  className="hover:text-ink transition-colors">Platform</Link>
            <Link href="/filmprojects"   className="hover:text-ink transition-colors">Film Projects</Link>
            <Link href="/opportunities"      className="text-ink">Opportunities</Link>
          </nav>
          <div className="flex items-center gap-3">
            <AuthAwareCta authedHref="/dashboard" authedLabel="Dashboard" authedClassName="text-[12px] tracking-[0.18em] uppercase hover:text-gold transition-colors">
              <Link href="/login" className="btn-outline !px-5 !py-2.5 !text-[11px]">Get started</Link>
            </AuthAwareCta>
          </div>
        </div>
      </header>

      <main className="max-w-[860px] mx-auto px-6 py-14">

        {/* Breadcrumb */}
        <Link
          href="/opportunities"
          className="text-[11px] tracking-[0.18em] uppercase text-ash hover:text-ink transition-colors"
        >
          ← All funds
        </Link>

        {/* Producer Brief Banner */}
        {(opp as any).is_producer_post && producerInfo && (
          <div className="mt-8 flex items-center gap-3 px-4 py-3 bg-gold/8 border border-gold/30 rounded-sm">
            <span className="text-[10px] tracking-[0.2em] uppercase text-gold font-medium shrink-0">Producer Brief</span>
            <span className="text-ash text-[12px]">—</span>
            <span className="text-[12px] text-ink">
              {producerInfo.company || producerInfo.full_name}
              {producerInfo.username && (
                <a href={`/u/${producerInfo.username}`} className="ml-2 text-gold hover:underline text-[11px] tracking-[0.12em] uppercase">
                  View profile →
                </a>
              )}
            </span>
          </div>
        )}

        {/* Hero */}
        <div className={(opp as any).is_producer_post ? "mt-6 pb-10 border-b border-line flex gap-8" : "mt-8 pb-10 border-b border-line"}>
          {/* Poster — only for producer-posted briefs */}
          {(opp as any).is_producer_post && (opp as any).poster_url && (
            <div className="shrink-0 w-[120px] h-[168px] rounded-sm overflow-hidden border border-line hidden sm:block">
              <img src={(opp as any).poster_url} alt={opp.title} className="w-full h-full object-cover" />
            </div>
          )}
          <div className="flex-1 min-w-0">
          <p className="eyebrow mb-4">{typeLabel} · {location}</p>
          <h1 className="font-display text-[46px] md:text-[58px] font-[400] leading-[1.1] text-ink">
            {opp.title}
          </h1>

          {/* Key facts strip */}
          <div className="mt-8 flex flex-wrap gap-x-10 gap-y-4">
            {opp.max_award_usd != null && (
              <div>
                <p className="text-[10px] tracking-[0.18em] uppercase text-ash mb-1">Award</p>
                <p className="font-display text-[20px] text-gold">Up to {usd(opp.max_award_usd)}</p>
              </div>
            )}
            <div>
              <p className="text-[10px] tracking-[0.18em] uppercase text-ash mb-1">Deadline</p>
              <p className="font-display text-[20px] text-ink">
                {formatDeadline(opp.deadline, opp.deadline_note ?? null)}
              </p>
            </div>
            <div>
              <p className="text-[10px] tracking-[0.18em] uppercase text-ash mb-1">Location</p>
              <p className="font-display text-[20px] text-ink">{location}</p>
            </div>
            {(opp.min_budget_usd != null || opp.max_budget_usd != null) && (
              <div>
                <p className="text-[10px] tracking-[0.18em] uppercase text-ash mb-1">Budget range</p>
                <p className="font-display text-[20px] text-ink">
                  {opp.min_budget_usd != null && opp.max_budget_usd != null
                    ? `${usd(opp.min_budget_usd)} – ${usd(opp.max_budget_usd)}`
                    : opp.min_budget_usd != null
                    ? `From ${usd(opp.min_budget_usd)}`
                    : `Up to ${usd(opp.max_budget_usd!)}`}
                </p>
              </div>
            )}
          </div>
          </div>{/* flex-1 min-w-0 */}
        </div>

        {/* Answer-first summary (AEO) */}
        {ledeText && (
          <p className="mt-8 text-[15px] leading-[1.7] text-ash max-w-[68ch]">{ledeText}</p>
        )}

        {/* Description */}
        {opp.description && (
          <div className="mt-10 pb-10 border-b border-line">
            <p className="font-display text-[22px] leading-[1.7] text-ink">
              {opp.description}
            </p>
          </div>
        )}

        {/* Eligibility & details grid */}
        {tags.length > 0 && (
          <div className="mt-10 pb-10 border-b border-line">
            <p className="eyebrow mb-6">Eligibility & details</p>
            <div className="grid sm:grid-cols-2 gap-x-12 gap-y-5">
              {tags.map((t) => (
                <div key={t.label}>
                  <p className="text-[10px] tracking-[0.18em] uppercase text-ash mb-1">{t.label}</p>
                  <p className="text-[15px] text-ink">{t.value}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* FAQ (AEO) */}
        {faqs.length > 0 && (
          <div className="mt-10 pb-10 border-b border-line">
            <p className="eyebrow mb-6">Frequently asked</p>
            <div className="space-y-6">
              {faqs.map((f) => (
                <div key={f.question}>
                  <p className="font-display text-[18px] text-ink mb-1">{f.question}</p>
                  <p className="text-[15px] text-ash leading-[1.6]">{f.answer}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Key person */}
        {opp.key_person && (
          <div className="mt-10 pb-10 border-b border-line">
            <p className="eyebrow mb-3">Key contact</p>
            <p className="text-[17px] text-ink">{opp.key_person}</p>
            {opp.contact_email && (
              <a
                href={`mailto:${opp.contact_email}`}
                className="mt-1 text-[14px] text-ash hover:text-gold transition-colors inline-block"
              >
                {opp.contact_email}
              </a>
            )}
          </div>
        )}

        {/* CTA — producer brief vs. standard fund */}
        {(opp as any).is_producer_post ? (
          <div className="mt-12 card p-8 border-gold/30">
            <p className="eyebrow mb-3 text-gold">Exclusive Submission</p>
            <h2 className="font-display text-[24px] font-[400] mb-2">
              Submit your project directly to {producerInfo?.company || producerInfo?.full_name || "this producer"}
            </h2>
            <p className="text-[14px] text-ash mb-6 max-w-md leading-relaxed">
              This is a producer-posted brief. When you submit, your project goes
              directly and exclusively to{" "}
              <span className="text-ink">{producerInfo?.company || producerInfo?.full_name}</span>{" "}
              — identical to pitching via their producer profile. They will see your
              full project, FRS score, and match analysis.
            </p>
            <AuthAwareCta authedHref="/dashboard" authedLabel="Submit your project →">
              <div className="flex flex-wrap gap-3">
                <Link href="/signup" className="btn-gold">Create account & submit</Link>
                <Link href="/login" className="btn-ghost">Sign in</Link>
              </div>
            </AuthAwareCta>
          </div>
        ) : (
          <div className="mt-12 card p-8">
            <p className="eyebrow mb-3">Apply through PITCH.FYLYM</p>
            <h2 className="font-display text-[24px] font-[400] mb-2">
              Is {opp.title} right for your film?
            </h2>
            <p className="text-[14px] text-ash mb-6 max-w-md">
              Submit your project and the PITCH.FYLYM engine scores your match against
              {` ${opp.title}`} and hundreds of other funds, labs and co-producers worldwide.
            </p>
            <AuthAwareCta authedHref="/dashboard" authedLabel="Go to your dashboard →">
              <div className="flex flex-wrap gap-3">
                <Link href="/signup" className="btn-gold">Submit your project</Link>
                <Link href="/login" className="btn-ghost">Sign in</Link>
              </div>
            </AuthAwareCta>
          </div>
        )}

        {/* Official website — bottom anchor */}
        {officialLink && (
          <div className="mt-10 pt-10 border-t border-line flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[11px] tracking-[0.18em] uppercase text-ash mb-1">Official website</p>
              <p className="text-[13px] text-ash">{officialLink.replace(/^https?:\/\//, "").split("/")[0]}</p>
            </div>
            <a
              href={officialLink}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost"
            >
              Visit {opp.title} ↗
            </a>
          </div>
        )}

      </main>

      {/* Footer signal */}
      <div className="border-t border-line mt-16">
        <div className="max-w-[1180px] mx-auto px-6 py-8 flex flex-wrap items-center justify-between gap-4">
          <Wordmark />
          <p className="text-[12px] text-ash">
            The intelligence layer for cinema.
          </p>
          <Link href="/opportunities" className="text-[12px] tracking-[0.14em] uppercase text-ash hover:text-ink transition-colors">
            Browse all funds →
          </Link>
        </div>
      </div>

    </div>
  );
}
