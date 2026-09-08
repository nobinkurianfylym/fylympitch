import Link from "next/link";
import Wordmark from "@/components/Wordmark";
import { Footer } from "@/components/Footer";

/**
 * Shared shell for /privacy, /terms and /cookies.
 *
 * Server component: these pages are static text, so nothing here needs the
 * client bundle. The header deliberately omits the auth-aware Dashboard link
 * the other standalone pages carry — a legal page is as often read logged out,
 * or by someone who arrived from an email, as by a signed-in user.
 */
export default function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-ivory">
      <header className="border-b border-line">
        <div className="max-w-[1180px] mx-auto px-6 py-5 flex items-center justify-between">
          <Wordmark />
          <nav className="flex items-center gap-6 text-[12px] tracking-[0.18em] uppercase text-ash">
            <Link href="/privacy" className="hover:text-ink transition-colors">Privacy</Link>
            <Link href="/terms"   className="hover:text-ink transition-colors">Terms</Link>
            <Link href="/cookies" className="hover:text-ink transition-colors">Cookies</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-16 pb-24">
        <h1 className="font-display text-[34px] md:text-[40px] font-normal leading-tight">{title}</h1>
        <p className="mt-3 text-[12px] tracking-[0.16em] uppercase text-ash">Last updated {updated}</p>

        <div className="legal-body mt-12">{children}</div>

        <p className="mt-16 pt-8 border-t border-line text-[13px] text-ash">
          Questions about this page?{" "}
          <a href="mailto:hello@fylym.com" className="underline underline-offset-4 decoration-ash/40 hover:text-ink">
            hello@fylym.com
          </a>
        </p>
      </main>

      <Footer />
    </div>
  );
}
