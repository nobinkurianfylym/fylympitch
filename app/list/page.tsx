import Link from "next/link";
import Wordmark from "@/components/Wordmark";
import { Footer } from "@/components/Footer";
import ShareLinkButton from "@/components/ShareLinkButton";
import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";

// Shareable destination for outreach to funders and producers. The homepage
// block sends people straight to the two actions; this page exists so a cold
// link — emailed to a festival programmer or a production company — lands on
// the invitation itself rather than at the bottom of the homepage.
//
// No openGraph image is declared: none exists in public/, and generating one
// at runtime is not worth the risk on this deployment target. Title and
// description alone still produce a clean link preview.
export const metadata: Metadata = {
  title: "List with PITCH.FYLYM — for funders and producers",
  description:
    "If you fund or produce films, filmmakers should be able to find you. List a grant, fund, lab or producer call. Free, and we keep it current.",
  alternates: { canonical: "/list" },
  openGraph: {
    // Declared explicitly: a page-level openGraph replaces the root
    // layout's outright, so omitting this shares with no image at all.
    images: [{ url: "/og-default.png", width: 1200, height: 630 }],
    title: "List with PITCH.FYLYM — for funders and producers",
    description:
      "If you fund or produce films, filmmakers should be able to find you. List a grant, fund, lab or producer call. Free, and we keep it current.",
    url: "/list",
    siteName: "PITCH.FYLYM",
    type: "website",
  },
  twitter: {
    images: ["/og-default.png"],
    card: "summary",
    title: "List with PITCH.FYLYM — for funders and producers",
    description:
      "If you fund or produce films, filmmakers should be able to find you. List a grant, fund, lab or producer call.",
  },
};

export default async function ListWithUsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let dashboardHref = "/dashboard";
  if (user) {
    const { data: me } = await supabase
      .from("profiles").select("role").eq("id", user.id).single();
    if ((me as any)?.role === "producer") dashboardHref = "/producerstudio";
  }

  return (
    <div className="min-h-screen bg-ivory">

      <header className="border-b border-line">
        <div className="max-w-[1180px] mx-auto px-6 py-5 flex items-center justify-between">
          <Wordmark />
          <nav className="hidden md:flex items-center gap-8 text-[12px] tracking-[0.18em] uppercase font-[400] text-ash">
            <Link href="/#features" className="hover:text-ink transition-colors">Platform</Link>
            <Link href="/filmprojects" className="hover:text-ink transition-colors">Film Projects</Link>
            <Link href="/opportunities" className="hover:text-ink transition-colors">Opportunities</Link>
          </nav>
          {user
            ? <Link href={dashboardHref} className="text-[12px] tracking-[0.18em] uppercase hover:text-gold transition-colors">Dashboard</Link>
            : <Link href="/login" className="btn-outline !px-5 !py-2.5 !text-[11px]">Get started</Link>}
        </div>
      </header>

      <main>

        {/* Hero */}
        <section className="max-w-3xl mx-auto px-6 pt-20 pb-14 md:pt-28 text-center">
          <p className="eyebrow mb-6">For funders and producers</p>
          <h1 className="font-display text-[34px] md:text-[52px] leading-[1.1] font-normal text-balance">
            If you fund or produce films, filmmakers should be able to{" "}
            <span className="italic text-gold">find you.</span>
          </h1>
          <p className="mt-7 text-[17px] leading-[1.7] text-ash max-w-xl mx-auto">
            PITCH.FYLYM is where filmmakers search for financing. Listing is free,
            and we keep your details current.
          </p>
          <p className="mt-8 text-[11px] tracking-[0.18em] uppercase text-ash">
            Grants <span className="text-gold">·</span> Funds <span className="text-gold">·</span> Labs{" "}
            <span className="text-gold">·</span> Markets <span className="text-gold">·</span> Co-productions{" "}
            <span className="text-gold">·</span> Producer calls
          </p>
        </section>

        {/* Two paths — the routes behave differently, so they are offered separately */}
        <section className="max-w-4xl mx-auto px-6 pb-20">
          <div
            className="grid md:grid-cols-2 gap-px rounded-card overflow-hidden"
            style={{ background: "#E5E0D5", border: "1px solid #E5E0D5" }}
          >
            <div className="bg-white px-8 py-10 flex flex-col">
              <p className="eyebrow mb-3">Festivals, funds &amp; institutions</p>
              <p className="text-[15px] leading-[1.65] text-ink mb-6 grow">
                Submit a grant, lab or fund. We check it and add it to the database,
                where filmmakers see it alongside every other opportunity they qualify for.
              </p>
              <Link href="/opportunities/submit" className="btn-gold self-start">
                List an opportunity
              </Link>
              <p className="mt-4 text-[12px] text-ash">
                No account needed. Reviewed before it goes live.
              </p>
            </div>

            <div className="bg-white px-8 py-10 flex flex-col">
              <p className="eyebrow mb-3">Producers &amp; production companies</p>
              <p className="text-[15px] leading-[1.65] text-ink mb-6 grow">
                Post from your producer profile. Once you&rsquo;re verified, your call goes
                live straight away, carries your name, and filmmakers are notified.
              </p>
              <Link href="/signup?role=producer" className="btn-ghost self-start">
                Create a producer account
              </Link>
              <p className="mt-4 text-[12px] text-ash">
                Verification is free, and includes Producer Studio.
              </p>
            </div>
          </div>
        </section>

        {/* What listing actually does — three claims the platform can back */}
        <section className="bg-parchment">
          <div className="max-w-4xl mx-auto px-6 py-20">
            <p className="eyebrow text-center mb-12">What happens after you list</p>
            <div className="grid md:grid-cols-3 gap-10">
              {[
                {
                  h: "Filmmakers are matched to it",
                  p: "Every project is scored against your criteria — format, stage, territory, budget — so the people who see your programme are the ones who qualify for it.",
                },
                {
                  h: "We keep it current",
                  p: "Listings are re-checked automatically. If your page moves or a deadline changes, it is picked up rather than left to rot.",
                },
                {
                  h: "You stay in control",
                  p: "It is your programme and your terms. We take no fee, no commission and no credit on anything that gets financed.",
                },
              ].map((c) => (
                <div key={c.h}>
                  <h2 className="font-display text-[20px] font-normal mb-3 leading-snug">{c.h}</h2>
                  <p className="text-[14px] leading-[1.7] text-ash">{c.p}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Closing */}
        <section className="max-w-3xl mx-auto px-6 py-20 text-center">
          <p className="font-display text-[22px] md:text-[26px] leading-snug text-balance">
            Filmmakers are searching for financing today.{" "}
            <span className="italic text-gold">Be findable.</span>
          </p>
          <div className="flex flex-wrap gap-3 justify-center mt-9">
            <Link href="/opportunities/submit" className="btn-gold">List an opportunity</Link>
            <Link href="/signup?role=producer" className="btn-ghost">Create a producer account</Link>
          </div>
          <p className="mt-6 text-[12px] text-ash">
            Questions? <a href="mailto:hello@fylym.com" className="underline underline-offset-4 decoration-ash/40 hover:text-ink">Write to us</a>.
          </p>

          <div className="mt-14 pt-10 border-t border-line max-w-md mx-auto">
            <p className="text-[13px] text-ash mb-5">
              Know a fund, festival or producer who should be listed?
            </p>
            <ShareLinkButton
              path="/list"
              title="List your fund or producer call on PITCH.FYLYM"
              text="If you fund or produce films, filmmakers should be able to find you. Listing on PITCH.FYLYM is free."
            />
          </div>
        </section>

      </main>

      <Footer />
    </div>
  );
}
