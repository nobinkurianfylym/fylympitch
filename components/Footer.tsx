import Link from "next/link";

function FylymLogo() {
  // Circle: centre (102, 44) radius 42
  // SVG angle convention: 0°=right, 90°=down, 180°=left, 270°=up
  //
  // Left  junction (120°): cx+r·cos120, cy+r·sin120 = 102-21=81,  44+36.4=80.4 ≈ (81,80)
  // Right junction  (60°): cx+r·cos60,  cy+r·sin60  = 102+21=123, 44+36.4=80.4 ≈ (123,80)
  // Orbital dot    (310°): cx+r·cos310, cy+r·sin310  = 102+27=129, 44-32.2=11.8 ≈ (129,12)
  //
  // Dark arc  (large, clockwise sweep=1): M 81 80 A 42 42 0 1 1 123 80  → through top ✓
  // Spectrum  (small, clockwise sweep=1): M 81 80 A 42 42 0 0 1 123 80  → through bottom ✓
  return (
    <svg width="160" height="110" viewBox="0 0 160 110" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="FYLYM">
      <defs>
        {/* Dark arc: fade in from left junction, solid over the top, hold through dot, fade at right */}
        <linearGradient id="fl-dark" x1="81" y1="80" x2="123" y2="80" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="white" stopOpacity="0.15"/>
          <stop offset="12%"  stopColor="white" stopOpacity="0.80"/>
          <stop offset="50%"  stopColor="white" stopOpacity="0.85"/>
          <stop offset="88%"  stopColor="white" stopOpacity="0.80"/>
          <stop offset="100%" stopColor="white" stopOpacity="0.15"/>
        </linearGradient>

        {/* Spectrum: red→orange→yellow→green→cyan→blue, fade in/out at junctions */}
        <linearGradient id="fl-spec" x1="81" y1="0" x2="123" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#FF3300" stopOpacity="0"/>
          <stop offset="6%"   stopColor="#FF4400" stopOpacity="1"/>
          <stop offset="22%"  stopColor="#FF8800"/>
          <stop offset="38%"  stopColor="#FFD200"/>
          <stop offset="52%"  stopColor="#AADD00"/>
          <stop offset="66%"  stopColor="#00CC66"/>
          <stop offset="80%"  stopColor="#00AAFF"/>
          <stop offset="94%"  stopColor="#0055FF" stopOpacity="1"/>
          <stop offset="100%" stopColor="#0044FF" stopOpacity="0"/>
        </linearGradient>

        {/* Dot purple glow */}
        <filter id="fl-glow" x="-200%" y="-200%" width="500%" height="500%">
          <feGaussianBlur stdDeviation="4" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>

        {/* Star-burst outer glow */}
        <filter id="fl-star" x="-400%" y="-400%" width="900%" height="900%">
          <feGaussianBlur stdDeviation="6" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>

        {/* F bar rainbow */}
        <linearGradient id="fl-fbar" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor="#FF2200"/>
          <stop offset="25%"  stopColor="#FFAA00"/>
          <stop offset="50%"  stopColor="#FFEE00"/>
          <stop offset="70%"  stopColor="#00DD66"/>
          <stop offset="85%"  stopColor="#00AAFF"/>
          <stop offset="100%" stopColor="#5555FF"/>
        </linearGradient>
      </defs>

      {/* ── Dark arc: large clockwise from left junction to right junction through TOP ── */}
      <path
        d="M 81 80 A 42 42 0 1 1 123 80"
        stroke="url(#fl-dark)"
        strokeWidth="1.3"
        strokeLinecap="butt"
      />

      {/* ── Spectrum arc: small clockwise from left junction to right junction through BOTTOM ── */}
      <path
        d="M 81 80 A 42 42 0 0 1 123 80"
        stroke="url(#fl-spec)"
        strokeWidth="1.8"
        strokeLinecap="butt"
      />

      {/* ── Dot star-burst (behind dot) ── */}
      <g filter="url(#fl-star)" opacity="0.45">
        <line x1="129" y1="12" x2="129" y2="-1"  stroke="#CC99FF" strokeWidth="1"/>
        <line x1="129" y1="12" x2="129" y2="25"  stroke="#CC99FF" strokeWidth="1"/>
        <line x1="129" y1="12" x2="116" y2="12"  stroke="#CC99FF" strokeWidth="1"/>
        <line x1="129" y1="12" x2="142" y2="12"  stroke="#CC99FF" strokeWidth="1"/>
        <line x1="129" y1="12" x2="120" y2="3"   stroke="#CC99FF" strokeWidth="0.6"/>
        <line x1="129" y1="12" x2="138" y2="21"  stroke="#CC99FF" strokeWidth="0.6"/>
        <line x1="129" y1="12" x2="138" y2="3"   stroke="#CC99FF" strokeWidth="0.6"/>
        <line x1="129" y1="12" x2="120" y2="21"  stroke="#CC99FF" strokeWidth="0.6"/>
      </g>

      {/* ── Dot outer glow ring ── */}
      <circle cx="129" cy="12" r="6.5" stroke="#9966FF" strokeWidth="0.8" fill="none" filter="url(#fl-glow)" opacity="0.7"/>

      {/* ── Dot ring ── */}
      <circle cx="129" cy="12" r="4.5" stroke="#AA77FF" strokeWidth="1.2" fill="none"/>

      {/* ── Dot centre ── */}
      <circle cx="129" cy="12" r="2" fill="rgba(255,255,255,0.9)"/>

      {/* ── FYLYM text ── */}
      {/* F — drawn manually so we can replace top bar with rainbow */}
      {/* Vertical stroke */}
      <rect x="4"  y="62" width="3.5" height="26" rx="0.5" fill="white" opacity="0.85"/>
      {/* Middle crossbar */}
      <rect x="4"  y="73" width="13"  height="3"  rx="0.5" fill="white" opacity="0.85"/>
      {/* Rainbow top bar (replaces top crossbar) */}
      <rect x="4"  y="62" width="22"  height="3"  rx="1.5" fill="url(#fl-fbar)"/>

      {/* Y L Y M — text */}
      <text
        x="30" y="88"
        fontSize="26"
        fontWeight="700"
        fontFamily="system-ui,-apple-system,'Helvetica Neue',sans-serif"
        letterSpacing="0.5"
        fill="rgba(255,255,255,0.85)"
      >
        YLYM
      </text>
    </svg>
  );
}

function SocialIcon({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label}
      className="text-ivory/35 hover:text-ivory transition-colors">
      {children}
    </a>
  );
}

const HD = "text-[10px] tracking-[0.2em] uppercase font-[600] text-ivory/40 mb-5 block relative pb-2";
const LN = "absolute bottom-0 left-0 w-6 h-[1.5px]";
const LI = "text-[13px] text-ivory/55 hover:text-gold transition-colors leading-none";

export function Footer() {
  return (
    <footer className="bg-deep text-ivory overflow-hidden relative">
      <div className="max-w-6xl mx-auto px-6 pt-16 pb-0 relative z-10">

        {/* Top row */}
        <div className="md:flex justify-between gap-12">

          {/* Left */}
          <div className="max-w-[220px] shrink-0">
            <FylymLogo />
            <p className="mt-2 text-[12px] leading-relaxed text-ivory/40 font-normal">
              Funding intelligence for filmmakers. Connecting creators with grants, funds, producers and investors worldwide.
            </p>
            <div className="mt-6 flex items-center gap-5">
              <SocialIcon href="https://x.com/fylym" label="X">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.742l7.73-8.835L1.254 2.25H8.08l4.259 5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </SocialIcon>
              <SocialIcon href="https://linkedin.com/company/fylym" label="LinkedIn">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
              </SocialIcon>
              <SocialIcon href="https://instagram.com/fylym" label="Instagram">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/>
                </svg>
              </SocialIcon>
              <SocialIcon href="https://youtube.com/@fylym" label="YouTube">
                <svg width="19" height="17" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
              </SocialIcon>
            </div>
          </div>

          {/* 4 columns */}
          <div className="mt-10 md:mt-2 grid grid-cols-2 sm:grid-cols-4 gap-10 text-[13px] flex-1">
            <div>
              <span className={HD}>Opportunities<span className={LN} style={{background:"linear-gradient(90deg,#FF3B30,#FF9500)"}}/></span>
              <ul className="space-y-3.5">
                <li><Link href="/projects"                     className={LI}>Film Projects</Link></li>
                <li><Link href="/funds?type=development"       className={LI}>Grants</Link></li>
                <li><Link href="/funds?type=development"       className={LI}>Funds</Link></li>
                <li><Link href="/funds?type=development"       className={LI}>Labs</Link></li>
                <li><Link href="/funds?type=packaging_markets" className={LI}>Markets</Link></li>
                <li><Link href="/funds?type=packaging_markets" className={LI}>Co-Productions</Link></li>
                <li><Link href="/funds?type=tax_incentives"    className={LI}>Tax Incentives</Link></li>
                <li><Link href="/funds/submit"                 className={LI}>Submit an Opportunity</Link></li>
              </ul>
            </div>
            <div>
              <span className={HD}>Industry<span className={LN} style={{background:"linear-gradient(90deg,#FFCC00,#34C759)"}}/></span>
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
              <span className={HD}>Platform<span className={LN} style={{background:"linear-gradient(90deg,#007AFF,#5AC8FA)"}}/></span>
              <ul className="space-y-3.5">
                <li><a href="#features" className={LI}>How it Works</a></li>
                <li><a href="#features" className={LI}>FYLYMPITCH Engine™</a></li>
                <li><a href="#pricing"  className={LI}>Pricing</a></li>
                <li><Link href="/signup" className={LI}>Join Free</Link></li>
                <li><Link href="/login"  className={LI}>Sign In</Link></li>
              </ul>
            </div>
            <div>
              <span className={HD}>Legal<span className={LN} style={{background:"linear-gradient(90deg,#AF52DE,#FF2D55)"}}/></span>
              <ul className="space-y-3.5">
                <li><a href="/privacy" className={LI}>Privacy</a></li>
                <li><a href="/terms"   className={LI}>Terms</a></li>
                <li><a href="/cookies" className={LI}>Cookies</a></li>
                <li><a href="mailto:nobinkurian@yahoo.com" className={LI}>Contact</a></li>
                <li><a href="mailto:nobinkurian@yahoo.com?subject=Report Issue" className={LI}>Report Issue</a></li>
              </ul>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="hairline-gold mt-14 pt-5 pb-6 flex items-center justify-between flex-wrap gap-3">
          <p className="text-[10px] tracking-[0.2em] uppercase text-ivory/30 font-normal">
            © {new Date().getFullYear()} PITCH.FYLYM · A FYLYM Company · Ernakulam, Kerala
          </p>
          <p className="text-[10px] tracking-[0.14em] uppercase text-ivory/20 font-normal">
            Intelligent matchmaking for independent film
          </p>
        </div>
      </div>

      {/* Ghost watermark */}
      <div className="absolute bottom-0 right-0 pointer-events-none select-none overflow-hidden" aria-hidden="true" style={{lineHeight:0.85}}>
        <span style={{
          fontFamily:"var(--font-sans,sans-serif)",
          fontWeight:800,
          fontSize:"clamp(90px,16vw,200px)",
          letterSpacing:"-0.04em",
          color:"rgba(255,255,255,0.038)",
          display:"block",
        }}>FYLYM</span>
      </div>
    </footer>
  );
}
