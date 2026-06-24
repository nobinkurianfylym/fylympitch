import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import Wordmark from "@/components/Wordmark";
import ProfileShareButton from "@/components/ProfileShareButton";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

// ── SEO ──────────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const supabase = await createClient();
  const { data: p } = await supabase
    .from("profiles")
    .select("full_name, bio, country, avatar_url")
    .eq("username", username)
    .single();
  if (!p) return { title: "Filmmaker — PITCH.FYLYM" };
  return {
    title: `${p.full_name} — PITCH.FYLYM`,
    description: p.bio
      ? p.bio.slice(0, 160)
      : `${p.full_name} · Filmmaker on PITCH.FYLYM`,
    openGraph: {
      title: p.full_name,
      description: p.bio?.slice(0, 160) ?? `${p.full_name} on PITCH.FYLYM`,
      images: p.avatar_url ? [p.avatar_url] : [],
      type: "profile",
    },
  };
}

// ── Constants ────────────────────────────────────────────────────────────────

const STAGE_LABEL: Record<string, string> = {
  development:     "Development",
  pre_production:  "Pre-Production",
  production:      "In Production",
  post_production: "Post-Production",
  completed:       "Completed",
};

const STAGE_COLOR: Record<string, string> = {
  development:     "rgba(138,133,124,0.15)",
  pre_production:  "rgba(191,153,83,0.18)",
  production:      "rgba(46,107,78,0.14)",
  post_production: "rgba(59,108,183,0.13)",
  completed:       "rgba(26,24,21,0.08)",
};

const CAREER_LABEL: Record<string, string> = {
  debut:       "Debut Filmmaker",
  second_film: "2nd Film",
  established: "Established Filmmaker",
  veteran:     "Veteran Filmmaker",
  emerging:    "Emerging Filmmaker",
};

const S = {
  ink:      "#1A1815",
  ivory:    "#F5F5F0",
  gold:     "#BF9953",
  ash:      "#8A857C",
  line:     "rgba(26,24,21,0.09)",
  parchment:"#F1EDE4",
} as const;

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const supabase = await createClient();

  // Auth optional — just for personalising the CTA
  const { data: { user } } = await supabase.auth.getUser();

  // Profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, username, company, country, bio, website, imdb_url, linkedin_url, avatar_url, role, career_stage, filmmaker_formats")
    .eq("username", username)
    .single();

  if (!profile) notFound();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

  // Parallel data
  const [
    { data: projects },
    { data: credits },
    { data: me },
  ] = await Promise.all([
    supabase
      .from("projects")
      .select("id, title, genre, format, stage, logline, poster_path, slug")
      .eq("owner_id", profile.id)
      .eq("is_public", true)
      .order("created_at", { ascending: false })
      .limit(3),
    supabase
      .from("filmmaker_credits")
      .select("id, title, year, festivals, awards, is_featured")
      .eq("user_id", profile.id)
      .order("is_featured", { ascending: false })
      .order("year",        { ascending: false }),
    user
      ? supabase.from("profiles").select("role").eq("id", user.id).single()
      : Promise.resolve({ data: null }),
  ]);

  // ── Computed stats ───────────────────────────────────────────────────────
  const projectList   = projects  ?? [];
  const creditList    = credits   ?? [];
  const awardsCount   = creditList.reduce((n, c: any) => n + (c.awards?.length   ?? 0), 0);
  const festsCount    = creditList.reduce((n, c: any) => n + (c.festivals?.length ?? 0), 0);

  // Cover image — first project with a poster
  const coverProject  = projectList.find((p: any) => p.poster_path);
  const coverUrl      = coverProject
    ? `${supabaseUrl}/storage/v1/object/public/thumbnails/${coverProject.poster_path}`
    : null;

  // Tagline — first sentence of bio (≤ 80 chars), or nothing
  const firstSentence = profile.bio
    ? profile.bio.split(/(?<=[.!?])\s+/)[0]?.trim() ?? ""
    : "";
  const tagline = firstSentence.length > 0 && firstSentence.length <= 120
    ? firstSentence
    : (profile.bio ?? "").slice(0, 80).trim() || null;

  // About — bio, 120-word cap
  const bioWords  = (profile.bio ?? "").split(" ");
  const aboutText = bioWords.length > 120
    ? bioWords.slice(0, 120).join(" ") + "…"
    : (profile.bio ?? null);

  // Career highlights — only items with real data
  const highlights: { icon: string; text: string }[] = [];
  if (awardsCount   > 0) highlights.push({ icon: "🏆", text: `${awardsCount} Award${awardsCount !== 1 ? "s" : ""}` });
  if (festsCount    > 0) highlights.push({ icon: "🎬", text: `${festsCount} Official Selection${festsCount !== 1 ? "s" : ""}` });
  if (projectList.length > 0) highlights.push({ icon: "📽", text: `${projectList.length} Film${projectList.length !== 1 ? "s" : ""}` });
  if (profile.country)   highlights.push({ icon: "📍", text: profile.country });
  if (profile.company)   highlights.push({ icon: "◈",  text: profile.company });

  const viewerRole   = (me as any)?.role ?? null;
  const dashboardHref = viewerRole === "producer" ? "/producer" : "/dashboard";


  // ── Producer profile branch ───────────────────────────────────────────────
  if (profile.role === "producer") {
    const { data: pp } = await supabase
      .from("producer_profiles")
      .select("*")
      .eq("user_id", profile.id)
      .maybeSingle();

    const { data: vf } = await supabase
      .from("profiles")
      .select("is_producer_verified")
      .eq("id", profile.id)
      .single();

    const isVerified    = !!(vf as any)?.is_producer_verified;
    const genres: string[]       = pp?.genres ?? [];
    const formats: string[]      = pp?.formats ?? [];
    const festivals: string[]    = pp?.festivals ?? [];
    const territories: string[]  = pp?.territories ?? [];
    const languages: string[]    = pp?.language_preferences ?? [];
    const fundingRoles: string[] = pp?.funding_roles ?? [];
    const stages: string[]       = pp?.stage_preferences ?? [];
    const capacity: string       = pp?.contribution_capacity ?? "";
    const budget: string         = pp?.budget_range ?? "";
    const lookingFor: string[]   = (pp as any)?.looking_for ?? [];
    const acceptingPitches       = (pp as any)?.accepting_pitches !== false;
    const responseTime: string   = (pp as any)?.response_time ?? "";
    const yearsExp               = (pp as any)?.years_experience ?? null;
    const linkedin: string       = (profile as any).linkedin_url ?? "";

    const FUNDING_ROLES_MAP: Record<string,string> = {
      full_financing:"Full Financing", co_producer:"Co-Producer",
      equity_investor:"Equity Investor", territory_presales:"Territory Pre-Sales",
      gap_financing:"Gap Financing", grant_access:"Grant Access",
    };
    const STAGES_MAP: Record<string,string> = {
      development:"Development", pre_production:"Pre-Production",
      production:"Production", post_production:"Post-Production", completed:"Acquisition",
    };
    const CAPACITY_MAP: Record<string,string> = {
      under_50k:"Under $50K", "50k_250k":"$50K\u2013$250K", "250k_1m":"$250K\u2013$1M", "1m_plus":"$1M+",
    };
    const BUDGET_MAP: Record<string,string> = {
      micro:"< $100K", low:"$100K\u2013$500K", mid:"$500K\u2013$2M", high:"$2M+",
    };
    const TG: [string, string[]][] = [
      ["North America",["United States","Canada"]],
      ["UK & Ireland",["United Kingdom","Republic of Ireland"]],
      ["Western Europe",["Germany","France","Austria","Switzerland","Benelux"]],
      ["Nordic",["Sweden","Norway","Denmark","Finland","Iceland"]],
      ["Central & Eastern Europe",["Poland","Czech Republic","Hungary","Romania","Bulgaria","Slovakia","The Baltics","The Balkans","CIS / Russia","Ukraine"]],
      ["Southern Europe",["Italy","Spain","Portugal","Greece","Cyprus"]],
      ["Latin America",["Mexico","Brazil","Argentina","Colombia","Chile","Peru","Venezuela","Ecuador","Central America & Caribbean"]],
      ["Middle East",["Saudi Arabia","UAE","Kuwait","Qatar","Oman","Bahrain","Egypt","Jordan","Lebanon","Iraq","Israel"]],
      ["Africa",["South Africa","Nigeria","Kenya","Ghana","Pan-African French-Speaking","North Africa / Maghreb"]],
      ["South Asia",["India","Pakistan","Bangladesh","Sri Lanka","Nepal"]],
      ["East & SE Asia",["Japan","South Korea","China","Hong Kong","Taiwan","Southeast Asia (SEAS)"]],
      ["Oceania",["Australia","New Zealand","Pacific Islands"]],
    ];
    const tgMap: Record<string,string> = {};
    TG.forEach(([r, ts]) => ts.forEach(t => { tgMap[t] = r; }));
    const uniqueMarkets = [...new Set(territories.map(t => tgMap[t]).filter(Boolean))];

    const avatarSrc = profile.avatar_url
      ? `${supabaseUrl}/storage/v1/object/public/avatars/${profile.avatar_url}`
      : null;
    const initials = profile.full_name.split(" ").map((w: string) => w[0]).join("").slice(0,2).toUpperCase();

    return (
      <>
        <style>{`
          @keyframes pFade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
          .pf{animation:pFade 0.5s ease-out forwards}
          .pf2{animation:pFade 0.5s 0.08s ease-out both}
          .pf3{animation:pFade 0.5s 0.16s ease-out both}
          .chip-lt{display:inline-flex;align-items:center;padding:3px 11px;border-radius:100px;font-size:11px;letter-spacing:.04em;font-weight:500;border:1px solid rgba(26,24,21,.1);color:#8A857C;background:transparent}
          .chip-gd{display:inline-flex;align-items:center;padding:3px 11px;border-radius:100px;font-size:11px;letter-spacing:.04em;font-weight:500;border:1px solid rgba(191,153,83,.3);color:#8A6F3E;background:transparent}
          .sl{font-size:9px;letter-spacing:.26em;text-transform:uppercase;font-weight:600;color:rgba(26,24,21,.3);margin-bottom:14px;display:block}
          .psec{padding:32px 0;border-bottom:1px solid rgba(26,24,21,.07)}
          .psec:last-child{border-bottom:none}
          .pf-nav{transition:opacity 150ms}.pf-nav:hover{opacity:1!important}
          @media(max-width:768px){.pf-hero-inner{flex-direction:column!important;gap:20px!important}.pf-two-col{grid-template-columns:1fr!important}}
        `}</style>
        <div style={{background:"#F5F5F0",minHeight:"100vh",fontFamily:"'Montserrat',sans-serif"}}>

          {/* Nav — clean ivory */}
          <nav style={{position:"fixed",top:0,left:0,right:0,zIndex:50,height:52,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 40px",background:"rgba(245,245,240,.92)",backdropFilter:"blur(16px)",WebkitBackdropFilter:"blur(16px)",borderBottom:"1px solid rgba(26,24,21,.07)"}}>
            <Wordmark href="/" size="sm" />
            <div style={{display:"flex",alignItems:"center",gap:24}}>
              {user
                ? <Link href={dashboardHref} className="pf-nav" style={{fontSize:10,letterSpacing:".18em",textTransform:"uppercase",fontWeight:600,color:"rgba(26,24,21,.4)"}}>Studio</Link>
                : <Link href="/login" style={{fontSize:10,letterSpacing:".16em",textTransform:"uppercase",fontWeight:700,color:"#F5F5F0",background:"#1A1815",padding:"7px 18px",borderRadius:100,textDecoration:"none"}}>Sign in</Link>
              }
            </div>
          </nav>

          {/* Hero — ivory, no dark band */}
          <div style={{paddingTop:52,borderBottom:"1px solid rgba(26,24,21,.07)"}}>
            <div style={{maxWidth:960,margin:"0 auto",padding:"56px 40px 48px"}}>
              <div className="pf-hero-inner" style={{display:"flex",alignItems:"flex-start",gap:28}}>

                {/* Avatar */}
                <div className="pf" style={{flexShrink:0}}>
                  <div style={{width:72,height:72,borderRadius:"50%",overflow:"hidden",border:"1px solid rgba(26,24,21,.1)",background:"rgba(26,24,21,.04)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                    {avatarSrc
                      ? <img src={avatarSrc} alt={profile.full_name} style={{width:"100%",height:"100%",objectFit:"cover"}} />
                      : <span style={{fontFamily:"'Playfair Display',serif",fontSize:24,color:"rgba(26,24,21,.25)"}}>{initials}</span>}
                  </div>
                </div>

                {/* Name block */}
                <div className="pf2" style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"baseline",gap:12,flexWrap:"wrap",marginBottom:6}}>
                    <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:"clamp(24px,3.5vw,36px)",color:"#1A1815",fontWeight:700,lineHeight:1.1,margin:0}}>
                      {profile.full_name}
                    </h1>
                    {isVerified && (
                      <span style={{fontSize:9,letterSpacing:".2em",textTransform:"uppercase",fontWeight:700,color:"#BF9953",border:"1px solid rgba(191,153,83,.35)",padding:"2px 8px",borderRadius:100}}>✦ Verified</span>
                    )}
                  </div>
                  <div style={{display:"flex",flexWrap:"wrap",alignItems:"center",gap:"4px 16px",marginTop:4}}>
                    {profile.company && <span style={{fontSize:13,fontWeight:600,color:"#BF9953"}}>{profile.company}</span>}
                    {profile.country && <span style={{fontSize:12,color:"#8A857C"}}>{profile.country}</span>}
                    {yearsExp && <span style={{fontSize:12,color:"#8A857C"}}>{yearsExp} years</span>}
                  </div>
                  {profile.bio && (
                    <p style={{fontSize:13,lineHeight:1.8,color:"rgba(26,24,21,.55)",marginTop:16,maxWidth:600}}>{profile.bio}</p>
                  )}
                </div>

                {/* Links + share */}
                <div className="pf3" style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:10,flexShrink:0,paddingTop:4}}>
                  <ProfileShareButton username={profile.username} name={profile.full_name} />
                  <div style={{display:"flex",gap:16}}>
                    {profile.imdb_url && <a href={profile.imdb_url} target="_blank" rel="noopener noreferrer" style={{fontSize:10,letterSpacing:".14em",textTransform:"uppercase",fontWeight:700,color:"#BF9953",textDecoration:"none"}}>IMDb ↗</a>}
                    {profile.website  && <a href={profile.website}  target="_blank" rel="noopener noreferrer" style={{fontSize:10,letterSpacing:".14em",textTransform:"uppercase",fontWeight:600,color:"rgba(26,24,21,.4)",textDecoration:"none"}}>Web ↗</a>}
                    {linkedin         && <a href={linkedin}          target="_blank" rel="noopener noreferrer" style={{fontSize:10,letterSpacing:".14em",textTransform:"uppercase",fontWeight:600,color:"rgba(26,24,21,.4)",textDecoration:"none"}}>LinkedIn ↗</a>}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Snapshot — numbers inline, no box */}
          {(uniqueMarkets.length > 0 || yearsExp || festivals.length > 0) && (
            <div style={{borderBottom:"1px solid rgba(26,24,21,.07)",background:"#fff"}}>
              <div style={{maxWidth:960,margin:"0 auto",padding:"0 40px",display:"flex"}}>
                {[
                  {val:uniqueMarkets.length > 0 ? String(uniqueMarkets.length) : null, label:"Markets"},
                  {val:yearsExp ? `${yearsExp}y` : null, label:"Experience"},
                  {val:festivals.length > 0 ? String(festivals.length) : null, label:"Festivals"},
                ].filter(s => s.val).map((stat, i) => (
                  <div key={stat.label} style={{padding:"22px 32px 22px",borderRight:"1px solid rgba(26,24,21,.07)",paddingLeft:i===0?0:32}}>
                    <span style={{fontFamily:"'Playfair Display',serif",fontSize:26,color:"#1A1815",fontWeight:700,marginRight:6}}>{stat.val}</span>
                    <span style={{fontSize:9,letterSpacing:".22em",textTransform:"uppercase",fontWeight:600,color:"rgba(26,24,21,.3)"}}>{stat.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Main */}
          <div style={{maxWidth:960,margin:"0 auto",padding:"40px 40px 80px"}}>
            <div className="pf-two-col" style={{display:"grid",gridTemplateColumns:"1fr 260px",gap:56,alignItems:"start"}}>

              {/* Left — sections separated by thin rules, no cards */}
              <div>
                {(genres.length > 0 || formats.length > 0) && (
                  <div className="psec">
                    <span className="sl">Genres</span>
                    <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                      {genres.map(g => <span key={g} className="chip-lt">{g}</span>)}
                      {formats.map(f => <span key={f} className="chip-lt" style={{color:"rgba(26,24,21,.35)",borderColor:"rgba(26,24,21,.08)"}}>{f}</span>)}
                    </div>
                  </div>
                )}
                {lookingFor.length > 0 && (
                  <div className="psec">
                    <span className="sl">Currently Looking For</span>
                    <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                      {lookingFor.map(l => <span key={l} className="chip-gd">{l}</span>)}
                    </div>
                  </div>
                )}
                {(CAPACITY_MAP[capacity] || fundingRoles.length > 0 || stages.length > 0) && (
                  <div className="psec">
                    <span className="sl">Investment Profile</span>
                    {CAPACITY_MAP[capacity] && (
                      <p style={{fontSize:16,fontWeight:700,color:"#1A1815",margin:"0 0 10px",fontFamily:"'Playfair Display',serif"}}>
                        {CAPACITY_MAP[capacity]}
                        {BUDGET_MAP[budget] && <span style={{fontSize:13,fontWeight:400,color:"#8A857C",fontFamily:"Montserrat,sans-serif"}}> · {BUDGET_MAP[budget]}</span>}
                      </p>
                    )}
                    {(fundingRoles.length > 0 || stages.length > 0) && (
                      <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                        {fundingRoles.map(r => <span key={r} className="chip-lt">{FUNDING_ROLES_MAP[r] ?? r}</span>)}
                        {stages.map(s => <span key={s} className="chip-lt">{STAGES_MAP[s] ?? s}</span>)}
                      </div>
                    )}
                  </div>
                )}
                {uniqueMarkets.length > 0 && (
                  <div className="psec">
                    <span className="sl">Market Experience</span>
                    <p style={{fontSize:13,color:"#8A857C",lineHeight:2,margin:0}}>{uniqueMarkets.join(" · ")}</p>
                  </div>
                )}
                {festivals.length > 0 && (
                  <div className="psec">
                    <span className="sl">Festival Pedigree</span>
                    <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                      {festivals.map(f => <span key={f} className="chip-lt">{f}</span>)}
                    </div>
                  </div>
                )}
                {languages.length > 0 && (
                  <div className="psec">
                    <span className="sl">Languages</span>
                    <p style={{fontSize:13,color:"#8A857C",lineHeight:2,margin:0}}>{languages.join(" · ")}</p>
                  </div>
                )}
              </div>

              {/* Right sidebar — minimal, no dark fill */}
              <div style={{position:"sticky",top:72}}>

                {/* Submissions */}
                <div style={{padding:"24px 0",borderBottom:"1px solid rgba(26,24,21,.07)",marginBottom:24}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                    <span style={{fontSize:9,letterSpacing:".26em",textTransform:"uppercase",fontWeight:600,color:"rgba(26,24,21,.3)"}}>Submissions</span>
                    <div style={{display:"flex",alignItems:"center",gap:5}}>
                      <span style={{width:5,height:5,borderRadius:"50%",background:acceptingPitches?"#4ade80":"rgba(26,24,21,.2)"}} />
                      <span style={{fontSize:11,fontWeight:600,color:acceptingPitches?"#2e7d52":"rgba(26,24,21,.4)"}}>
                        {acceptingPitches ? "Open" : "Closed"}
                      </span>
                    </div>
                  </div>
                  {responseTime && (
                    <p style={{fontSize:11,color:"rgba(26,24,21,.35)",margin:"0 0 16px"}}>{responseTime}</p>
                  )}
                  {user && user.id !== profile.id && acceptingPitches && (
                    <Link href="/producer/messages" style={{display:"block",textAlign:"center",padding:"9px 16px",borderRadius:8,border:"1px solid rgba(191,153,83,.4)",color:"#8A6F3E",fontSize:11,letterSpacing:".12em",textTransform:"uppercase",fontWeight:700,textDecoration:"none",background:"rgba(191,153,83,.06)"}}>
                      Send message
                    </Link>
                  )}
                </div>

                {/* Links */}
                {(profile.imdb_url || profile.website || linkedin) && (
                  <div style={{paddingBottom:24}}>
                    <span className="sl">Links</span>
                    <div style={{display:"flex",flexDirection:"column",gap:12}}>
                      {profile.imdb_url && <a href={profile.imdb_url} target="_blank" rel="noopener noreferrer" style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"#8A857C",textDecoration:"none"}}><span style={{fontSize:9,letterSpacing:".14em",textTransform:"uppercase",fontWeight:700,color:"rgba(26,24,21,.3)"}}>IMDb</span><span style={{color:"#BF9953",fontSize:10}}>↗</span></a>}
                      {profile.website  && <a href={profile.website}  target="_blank" rel="noopener noreferrer" style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"#8A857C",textDecoration:"none"}}><span style={{fontSize:9,letterSpacing:".14em",textTransform:"uppercase",fontWeight:700,color:"rgba(26,24,21,.3)"}}>Website</span><span style={{color:"rgba(26,24,21,.3)",fontSize:10}}>↗</span></a>}
                      {linkedin         && <a href={linkedin}          target="_blank" rel="noopener noreferrer" style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"#8A857C",textDecoration:"none"}}><span style={{fontSize:9,letterSpacing:".14em",textTransform:"uppercase",fontWeight:700,color:"rgba(26,24,21,.3)"}}>LinkedIn</span><span style={{color:"rgba(26,24,21,.3)",fontSize:10}}>↗</span></a>}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @keyframes heroFade {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .hero-in { animation: heroFade 0.75s ease-out forwards; }
        .hero-in-2 { animation: heroFade 0.75s 0.12s ease-out both; }
        .hero-in-3 { animation: heroFade 0.75s 0.24s ease-out both; }

        .poster-card { transition: transform 150ms ease; }
        .poster-card:hover { transform: scale(1.02); }

        /* Mobile swipe for projects */
        @media (max-width: 768px) {
          .projects-row {
            display: flex !important;
            overflow-x: auto;
            scroll-snap-type: x mandatory;
            -webkit-overflow-scrolling: touch;
            gap: 16px;
            padding-bottom: 16px;
          }
          .projects-row::-webkit-scrollbar { display: none; }
          .project-card-wrap {
            flex: none;
            width: 280px;
            scroll-snap-align: start;
          }
        }

        /* Nav link hover */
        .nav-link { transition: opacity 150ms; }
        .nav-link:hover { opacity: 1 !important; }
      `}</style>

      <div style={{ background: S.ivory, minHeight: "100vh", fontFamily: "'Montserrat', sans-serif" }}>

        {/* ── FIXED NAV ─────────────────────────────────────────── */}
        <nav style={{
          position:       "fixed",
          top:            0,
          left:           0,
          right:          0,
          zIndex:         50,
          height:         52,
          display:        "flex",
          alignItems:     "center",
          justifyContent: "space-between",
          padding:        "0 40px",
          background:     "rgba(26,24,21,0.55)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        }}>
          <Wordmark light />
          <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
            <Link href="/projects" className="nav-link" style={{
              fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase",
              color: "rgba(245,245,240,0.55)", textDecoration: "none",
            }}>
              Films
            </Link>
            <Link href="/funds" className="nav-link" style={{
              fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase",
              color: "rgba(245,245,240,0.55)", textDecoration: "none",
            }}>
              Funds
            </Link>
            {user ? (
              <Link href={dashboardHref} className="nav-link" style={{
                fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase",
                color: "rgba(245,245,240,0.55)", textDecoration: "none",
              }}>
                {viewerRole === "producer" ? "Studio" : "Dashboard"}
              </Link>
            ) : (
              <Link href={`/login?next=/u/${username}`} style={{
                fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase",
                color: S.gold, textDecoration: "none", border: `1px solid rgba(191,153,83,0.5)`,
                padding: "5px 14px", borderRadius: 6,
              }}>
                Log in
              </Link>
            )}
          </div>
        </nav>

        {/* ══ HERO ══════════════════════════════════════════════ */}
        <section style={{
          position:   "relative",
          minHeight:  "100svh",
          background: S.ink,
          display:    "flex",
          alignItems: "center",
          overflow:   "hidden",
        }}>
          {/* Blurred cover — filmmaker's own work as the backdrop */}
          {coverUrl && (
            <div aria-hidden style={{
              position:           "absolute",
              inset:              "-10%",
              backgroundImage:    `url(${coverUrl})`,
              backgroundSize:     "cover",
              backgroundPosition: "center",
              filter:             "blur(32px) saturate(0.7)",
              opacity:            0.28,
              transform:          "scale(1.08)",
            }} />
          )}
          {/* Overlay — no gradient, just flat opacity */}
          <div aria-hidden style={{
            position: "absolute",
            inset:    0,
            background: S.ink,
            opacity:  coverUrl ? 0.60 : 0.95,
          }} />

          {/* Hero content */}
          <div style={{
            position: "relative",
            zIndex:   10,
            width:    "100%",
            maxWidth: 1100,
            margin:   "0 auto",
            padding:  "100px 40px 80px",
            display:  "grid",
            gridTemplateColumns: "140px 1fr auto",
            gap:      "0 56px",
            alignItems: "center",
          }} className="hero-grid">

            {/* ── Col 1: Avatar ──────────────────────────────── */}
            <div className="hero-in" style={{ justifySelf: "center" }}>
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.full_name}
                  style={{
                    width:        136,
                    height:       136,
                    borderRadius: "50%",
                    objectFit:    "cover",
                    border:       "2px solid rgba(245,245,240,0.18)",
                    display:      "block",
                  }}
                />
              ) : (
                <div style={{
                  width:          136,
                  height:         136,
                  borderRadius:   "50%",
                  background:     "rgba(245,245,240,0.08)",
                  border:         "2px solid rgba(245,245,240,0.14)",
                  display:        "flex",
                  alignItems:     "center",
                  justifyContent: "center",
                }}>
                  <span style={{
                    fontFamily: "'Playfair Display', Georgia, serif",
                    fontSize:   42,
                    color:      "rgba(245,245,240,0.5)",
                    lineHeight: 1,
                  }}>
                    {profile.full_name.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase()}
                  </span>
                </div>
              )}
            </div>

            {/* ── Col 2: Identity ─────────────────────────────── */}
            <div style={{ minWidth: 0 }}>
              {/* Career stage label */}
              {profile.career_stage && (
                <p className="hero-in" style={{
                  fontSize:      11,
                  letterSpacing: "0.26em",
                  textTransform: "uppercase",
                  color:         S.gold,
                  marginBottom:  16,
                  fontWeight:    500,
                }}>
                  {CAREER_LABEL[profile.career_stage] ?? "Filmmaker"}
                </p>
              )}

              {/* Name */}
              <h1 className="hero-in-2" style={{
                fontFamily:    "'Playfair Display', Georgia, serif",
                fontSize:      "clamp(38px, 5vw, 56px)",
                fontWeight:    400,
                color:         S.ivory,
                lineHeight:    1.04,
                letterSpacing: "-0.02em",
                margin:        "0 0 16px",
              }}>
                {profile.full_name}
              </h1>

              {/* Meta row */}
              <p className="hero-in-2" style={{
                fontSize:      16,
                color:         "rgba(245,245,240,0.50)",
                marginBottom:  tagline ? 20 : 32,
                letterSpacing: "0.01em",
              }}>
                {[
                  profile.career_stage
                    ? null
                    : "Filmmaker",
                  profile.country,
                ].filter(Boolean).join("  ·  ")}
                {!profile.career_stage && !profile.country && "Filmmaker"}
              </p>

              {/* Tagline */}
              {tagline && (
                <p className="hero-in-2" style={{
                  fontFamily:  "'Playfair Display', Georgia, serif",
                  fontStyle:   "italic",
                  fontSize:    "clamp(16px, 1.6vw, 20px)",
                  color:       "rgba(245,245,240,0.72)",
                  lineHeight:  1.55,
                  marginBottom: 36,
                  maxWidth:    540,
                }}>
                  &ldquo;{tagline}&rdquo;
                </p>
              )}

              {/* CTA buttons */}
              <div className="hero-in-3" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                {/* Primary */}
                {user ? (
                  projectList.length > 0 ? (
                    <Link href={`/projects/${(projectList[0] as any).slug ?? (projectList[0] as any).id}`} style={{
                      display:       "inline-flex",
                      alignItems:    "center",
                      gap:           6,
                      fontSize:      12,
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      fontWeight:    500,
                      color:         S.ink,
                      background:    S.ivory,
                      border:        "none",
                      borderRadius:  10,
                      padding:       "11px 22px",
                      textDecoration:"none",
                      transition:    "opacity 150ms",
                    }}>
                      View Projects
                    </Link>
                  ) : null
                ) : (
                  <Link href={`/login?next=/u/${username}`} style={{
                    display:       "inline-flex",
                    alignItems:    "center",
                    fontSize:      12,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    fontWeight:    500,
                    color:         S.ink,
                    background:    S.ivory,
                    borderRadius:  10,
                    padding:       "11px 22px",
                    textDecoration:"none",
                  }}>
                    Connect
                  </Link>
                )}

                {/* Share */}
                <div style={{ display: "inline-flex" }}>
                  <ProfileShareButton username={profile.username} fullName={profile.full_name} />
                </div>
              </div>
            </div>

            {/* ── Col 3: Stats ─────────────────────────────────── */}
            <div className="hero-in-3" style={{
              display:  "flex",
              flexDirection: "column",
              gap:      32,
              alignItems: "flex-end",
              flexShrink: 0,
            }}>
              {[
                { n: projectList.length, label: "Projects" },
                { n: awardsCount,        label: "Awards" },
                { n: festsCount,         label: "Selections" },
              ].map(({ n, label }) => (
                <div key={label} style={{ textAlign: "right" }}>
                  <p style={{
                    fontFamily:    "'Playfair Display', Georgia, serif",
                    fontSize:      "clamp(32px, 4vw, 48px)",
                    fontWeight:    400,
                    color:         n > 0 ? S.ivory : "rgba(245,245,240,0.2)",
                    lineHeight:    1,
                    letterSpacing: "-0.03em",
                    margin:        0,
                  }}>
                    {n}
                  </p>
                  <p style={{
                    fontSize:      10,
                    letterSpacing: "0.22em",
                    textTransform: "uppercase",
                    color:         "rgba(245,245,240,0.38)",
                    marginTop:     5,
                    fontWeight:    500,
                  }}>
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Scroll hint */}
          <div aria-hidden style={{
            position:  "absolute",
            bottom:    32,
            left:      "50%",
            transform: "translateX(-50%)",
            display:   "flex",
            flexDirection: "column",
            alignItems: "center",
            gap:       6,
            opacity:   0.3,
          }}>
            <div style={{
              width:  1,
              height: 40,
              background: `linear-gradient(to bottom, transparent, ${S.ivory})`,
            }} />
            <p style={{
              fontSize:      9,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color:         S.ivory,
            }}>Scroll</p>
          </div>
        </section>

        {/* ══ FEATURED PROJECTS ════════════════════════════════ */}
        {projectList.length > 0 && (
          <section style={{ background: S.ivory, padding: "80px 40px" }}>
            <div style={{ maxWidth: 1100, margin: "0 auto" }}>
              <p style={{
                fontSize:      11,
                letterSpacing: "0.26em",
                textTransform: "uppercase",
                color:         S.ash,
                fontWeight:    500,
                marginBottom:  40,
              }}>
                Featured Projects
              </p>

              <div
                className="projects-row"
                style={{
                  display: "grid",
                  gridTemplateColumns: `repeat(${Math.min(projectList.length, 3)}, 1fr)`,
                  gap: 32,
                }}
              >
                {projectList.slice(0, 3).map((p: any) => (
                  <div key={p.id} className="project-card-wrap">
                    <Link
                      href={`/projects/${p.slug ?? p.id}`}
                      style={{ textDecoration: "none", display: "block" }}
                    >
                      {/* Poster */}
                      <div style={{
                        borderRadius:  12,
                        overflow:      "hidden",
                        aspectRatio:   "2/3",
                        background:    S.parchment,
                        marginBottom:  24,
                      }} className="poster-card">
                        {p.poster_path ? (
                          <img
                            src={`${supabaseUrl}/storage/v1/object/public/thumbnails/${p.poster_path}`}
                            alt={p.title}
                            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                          />
                        ) : (
                          // Minimal pastel fallback — no text, just a clean tinted rect
                          <div style={{
                            width:    "100%",
                            height:   "100%",
                            background: `${S.parchment}`,
                            display:  "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}>
                            <p style={{
                              fontFamily:  "'Playfair Display', Georgia, serif",
                              fontSize:    22,
                              color:       S.ash,
                              opacity:     0.4,
                              textAlign:   "center",
                              padding:     24,
                              lineHeight:  1.3,
                            }}>
                              {p.title}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div style={{ padding: "0 4px" }}>
                        {/* Genre */}
                        {p.genre && (
                          <p style={{
                            fontSize:      11,
                            letterSpacing: "0.22em",
                            textTransform: "uppercase",
                            color:         S.ash,
                            marginBottom:  8,
                            fontWeight:    500,
                          }}>
                            {p.genre}
                          </p>
                        )}

                        {/* Title */}
                        <h3 style={{
                          fontFamily:    "'Playfair Display', Georgia, serif",
                          fontSize:      24,
                          fontWeight:    400,
                          color:         S.ink,
                          lineHeight:    1.15,
                          letterSpacing: "-0.01em",
                          margin:        "0 0 12px",
                        }}>
                          {p.title}
                        </h3>

                        {/* Stage badge */}
                        {p.stage && (
                          <span style={{
                            display:       "inline-block",
                            fontSize:      10,
                            letterSpacing: "0.14em",
                            textTransform: "uppercase",
                            fontWeight:    500,
                            padding:       "4px 10px",
                            borderRadius:  6,
                            background:    STAGE_COLOR[p.stage] ?? STAGE_COLOR.development,
                            color:         S.ink,
                            marginBottom:  14,
                          }}>
                            {STAGE_LABEL[p.stage] ?? p.stage}
                          </span>
                        )}

                        {/* Logline */}
                        {p.logline && (
                          <p style={{
                            fontFamily:  "'Playfair Display', Georgia, serif",
                            fontStyle:   "italic",
                            fontSize:    15,
                            color:       S.ash,
                            lineHeight:  1.65,
                            marginTop:   p.stage ? 0 : 0,
                            marginBottom:16,
                            display:     "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow:    "hidden",
                          } as React.CSSProperties}>
                            {p.logline}
                          </p>
                        )}

                        {/* Link */}
                        <p style={{
                          fontSize:      12,
                          letterSpacing: "0.1em",
                          textTransform: "uppercase",
                          color:         S.gold,
                          fontWeight:    500,
                        }}>
                          View Project →
                        </p>
                      </div>
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ══ CAREER HIGHLIGHTS ════════════════════════════════ */}
        {highlights.length >= 2 && (
          <section style={{
            borderTop:    `1px solid ${S.line}`,
            borderBottom: `1px solid ${S.line}`,
            background:   S.parchment,
            padding:      "40px 40px",
          }}>
            <div style={{
              maxWidth: 1100,
              margin:   "0 auto",
              display:  "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap:      "0",
            }}>
              {highlights.map((h, i) => (
                <div key={i} style={{
                  display:    "flex",
                  alignItems: "center",
                  gap:        10,
                  padding:    "0 32px",
                  borderRight: i < highlights.length - 1 ? `1px solid ${S.line}` : "none",
                  ...(i === 0 ? { paddingLeft: 0 } : {}),
                }}>
                  <span style={{ fontSize: 18, lineHeight: 1 }}>{h.icon}</span>
                  <p style={{
                    fontSize:      16,
                    color:         S.ink,
                    fontWeight:    400,
                    whiteSpace:    "nowrap",
                  }}>
                    {h.text}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ══ ABOUT ════════════════════════════════════════════ */}
        {aboutText && (
          <section style={{
            background: S.ivory,
            padding:    "80px 40px",
          }}>
            <div style={{ maxWidth: 680, margin: "0 auto" }}>
              <p style={{
                fontSize:      11,
                letterSpacing: "0.26em",
                textTransform: "uppercase",
                color:         S.ash,
                fontWeight:    500,
                marginBottom:  32,
              }}>
                About
              </p>
              <p style={{
                fontSize:   16,
                lineHeight: 1.85,
                color:      S.ink,
                fontWeight: 400,
              }}>
                {aboutText}
              </p>
            </div>
          </section>
        )}

        {/* ══ CONTACT ══════════════════════════════════════════ */}
        {(profile.website || profile.imdb_url) && (
          <section style={{
            borderTop:  `1px solid ${S.line}`,
            background: S.ivory,
            padding:    "56px 40px",
          }}>
            <div style={{
              maxWidth:   1100,
              margin:     "0 auto",
              display:    "flex",
              alignItems: "center",
              gap:        40,
              flexWrap:   "wrap",
            }}>
              <p style={{
                fontSize:      11,
                letterSpacing: "0.26em",
                textTransform: "uppercase",
                color:         S.ash,
                fontWeight:    500,
                flexShrink:    0,
              }}>
                Contact
              </p>

              <div style={{ display: "flex", alignItems: "center", gap: 32, flexWrap: "wrap" }}>
                {profile.website && (
                  <a
                    href={profile.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontSize:      13,
                      letterSpacing: "0.08em",
                      color:         S.ink,
                      textDecoration:"none",
                      display:       "flex",
                      alignItems:    "center",
                      gap:           7,
                      transition:    "color 150ms",
                    }}
                    className="nav-link"
                    onMouseEnter={undefined}
                  >
                    {/* Globe icon */}
                    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.2">
                      <circle cx="7.5" cy="7.5" r="6.5"/>
                      <ellipse cx="7.5" cy="7.5" rx="2.8" ry="6.5"/>
                      <line x1="1" y1="7.5" x2="14" y2="7.5"/>
                      <line x1="7.5" y1="1" x2="7.5" y2="14"/>
                    </svg>
                    Website ↗
                  </a>
                )}

                {profile.imdb_url && (
                  <a
                    href={profile.imdb_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontSize:      13,
                      letterSpacing: "0.08em",
                      color:         S.ink,
                      textDecoration:"none",
                      display:       "flex",
                      alignItems:    "center",
                      gap:           7,
                      transition:    "color 150ms",
                    }}
                  >
                    {/* Film icon */}
                    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.2">
                      <rect x="1" y="3" width="13" height="9" rx="1"/>
                      <line x1="4" y1="3" x2="4" y2="12"/>
                      <line x1="11" y1="3" x2="11" y2="12"/>
                      <line x1="1" y1="6" x2="4" y2="6"/>
                      <line x1="11" y1="6" x2="14" y2="6"/>
                      <line x1="1" y1="9" x2="4" y2="9"/>
                      <line x1="11" y1="9" x2="14" y2="9"/>
                    </svg>
                    IMDb ↗
                  </a>
                )}
              </div>

              {/* Pitch.Fylym link — subtle attribution */}
              <div style={{ marginLeft: "auto" }}>
                <Link href="/" style={{
                  fontSize:      10,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color:         S.ash,
                  opacity:       0.45,
                  textDecoration:"none",
                }}>
                  PITCH.FYLYM
                </Link>
              </div>
            </div>
          </section>
        )}

        {/* Mobile hero layout overrides */}
        <style>{`
          @media (max-width: 768px) {
            .hero-grid {
              grid-template-columns: 1fr !important;
              text-align: center;
              gap: 32px !important;
              padding: 88px 24px 64px !important;
            }
            .hero-grid > div:last-child {
              flex-direction: row !important;
              align-items: center;
              justify-content: center;
              gap: 40px !important;
            }
            .hero-grid > div:last-child > div {
              text-align: center !important;
            }
          }
          @media (max-width: 640px) {
            section { padding-left: 24px !important; padding-right: 24px !important; }
          }
        `}</style>
      </div>
    </>
  );
}
