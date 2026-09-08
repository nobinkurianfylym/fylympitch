import Link from "next/link";


function SocialIcon({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label}
      className="text-ivory/35 hover:text-ivory transition-colors">
      {children}
    </a>
  );
}

const HD = "text-[10px] tracking-[0.2em] uppercase font-[600] text-ivory/40 mb-5 block relative pb-2";
const LN = "absolute bottom-0 left-0 w-6 h-[1.5px] bg-gold opacity-70";
const LI = "text-[13px] text-ivory/55 hover:text-gold transition-colors leading-none";

export function Footer() {
  return (
    <footer className="bg-deep text-ivory overflow-hidden relative">
      <div className="max-w-6xl mx-auto px-6 pt-16 pb-0 relative z-10">

        {/* Top row */}
        <div className="md:flex justify-between gap-12">

          {/* Left */}
          <div className="max-w-[300px] shrink-0">
            {/* Knockout mark: the supplied logo with the black tile removed, so the
                ivory P and gold dot sit directly on the dark footer. The wordmark
                is live text rather than the image's own, so it stays crisp. */}
            <div className="flex items-center gap-3">
              <img
                src="/pitch-mark.png"
                alt=""
                className="shrink-0"
                style={{ height: 40, width: "auto" }}
              />
              <span className="font-sans text-[15px] text-ivory/90 select-none leading-none">
                <span style={{ fontWeight: 600 }}>pitch</span>
                <span className="text-gold" style={{ fontWeight: 600 }}>.</span>
                <span style={{ fontWeight: 300 }}>fylym.com</span>
              </span>
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-ivory/40 font-normal">
              PITCH.FYLYM is the intelligent global funding network for film &mdash;
              connecting projects, capital and industry partners to get great films made.
            </p>
            <p className="mt-3 text-[10px] tracking-[0.2em] uppercase text-ivory/30 font-normal leading-relaxed">
              PITCH.FYLYM — Where films find funding.
            </p>
            <div className="mt-6 flex items-center gap-5">
              <SocialIcon href="https://x.com/fylymhq" label="X">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.742l7.73-8.835L1.254 2.25H8.08l4.259 5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </SocialIcon>
              <SocialIcon href="https://www.instagram.com/fylymHQ" label="Instagram">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/>
                </svg>
              </SocialIcon>
              <SocialIcon href="https://www.facebook.com/fylymHQ" label="Facebook">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M15.12 5.32H17V2.14A26.11 26.11 0 0 0 14.26 2C11.54 2 9.68 3.66 9.68 6.7v2.62H6.61v3.56h3.07V22h3.68v-9.12h3.06l.46-3.56h-3.52V7.05c0-1.03.28-1.73 1.76-1.73Z"/>
                </svg>
              </SocialIcon>
            </div>
          </div>

          {/* 4 columns */}
          <div className="mt-10 md:mt-2 grid grid-cols-2 sm:grid-cols-4 gap-10 text-[13px] flex-1">
            <div>
              <span className={HD}>Opportunities<span className={LN} /></span>
              <ul className="space-y-3.5">
                <li><Link href="/filmprojects"                     className={LI}>Film Projects</Link></li>
                <li><Link href="/opportunities?type=development"       className={LI}>Grants</Link></li>
                <li><Link href="/opportunities?type=development"       className={LI}>Funds</Link></li>
                <li><Link href="/opportunities?type=development"       className={LI}>Labs</Link></li>
                <li><Link href="/opportunities?type=packaging_markets" className={LI}>Markets</Link></li>
                <li><Link href="/opportunities?type=packaging_markets" className={LI}>Co-Productions</Link></li>
                <li><Link href="/opportunities?type=tax_incentives"    className={LI}>Tax Incentives</Link></li>
                <li><Link href="/opportunities/submit"                 className={LI}>Submit an Opportunity</Link></li>
                <li><Link href="/list"                                className={LI}>List With Us</Link></li>
              </ul>
            </div>
            <div>
              <span className={HD}>Industry<span className={LN} /></span>
              <ul className="space-y-3.5">
                <li><Link href="/signup?role=producer" className={LI}>Producers</Link></li>
                <li><Link href="/signup?role=producer" className={LI}>Production Companies</Link></li>
                <li><Link href="/signup?role=producer" className={LI}>Studios</Link></li>
                <li><Link href="/signup?role=producer" className={LI}>Investors</Link></li>
                <li><Link href="/signup?role=producer" className={LI}>Sponsors</Link></li>
                <li><Link href="/signup?role=producer" className={LI}>Brand Integration</Link></li>
              </ul>
            </div>
            <div>
              <span className={HD}>Platform<span className={LN} /></span>
              <ul className="space-y-3.5">
                <li><Link href="/#features" className={LI}>How it Works</Link></li>
                <li><Link href="/#features" className={LI}>FYLYMPITCH Engine™</Link></li>
                <li><Link href="/#beta" className={LI}>Beta</Link></li>
                <li><Link href="/signup" className={LI}>Join Free</Link></li>
                <li><Link href="/login"  className={LI}>Sign In</Link></li>
              </ul>
            </div>
            <div>
              <span className={HD}>Legal<span className={LN} /></span>
              <ul className="space-y-3.5">
                <li><Link href="/privacy" className={LI}>Privacy</Link></li>
                <li><Link href="/terms" className={LI}>Terms</Link></li>
                <li><Link href="/cookies" className={LI}>Cookies</Link></li>
                <li><a href="mailto:hello@fylym.com" className={LI}>Contact</a></li>
                <li><a href="mailto:hello@fylym.com?subject=Bug Report" className={LI}>Bug Report</a></li>
                <li><a href="mailto:hello@fylym.com?subject=Broken Link Report" className={LI}>Broken Link Report</a></li>
              </ul>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="hairline-gold mt-14 pt-5 pb-6 flex items-center justify-between flex-wrap gap-3">
          <p className="text-[10px] tracking-[0.2em] uppercase text-ivory/30 font-normal">
            © {new Date().getFullYear()} PITCH.FYLYM · A{" "}
            <a
              href="https://www.fylym.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 decoration-ivory/20 hover:text-ivory/60 transition-colors"
            >
              www.fylym.com
            </a>{" "}
            Company
          </p>
        </div>
      </div>

      {/* Ghost watermark */}
      <div className="absolute bottom-0 right-0 pointer-events-none select-none overflow-hidden" aria-hidden="true" style={{lineHeight:0.85}}>
        <span style={{
          fontFamily:"var(--font-sans,sans-serif)",
          fontWeight:800,
          fontSize:"clamp(58px,11vw,150px)",
          letterSpacing:"-0.04em",
          color:"rgba(255,255,255,0.038)",
          display:"block",
        }}>PITCH.FYLYM</span>
      </div>
    </footer>
  );
}
