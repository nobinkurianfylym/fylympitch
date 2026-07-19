import React from "react";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import Wordmark from "@/components/Wordmark";
import ProfileShareButton from "@/components/ProfileShareButton";
import type { Metadata } from "next";
import JsonLd from "@/components/JsonLd";
import { profileSchema, breadcrumbSchema } from "@/lib/schema";
import { profileRobots, absoluteUrl } from "@/lib/seo";
import ProfileNavAuth from "@/components/ProfileNavAuth";
import AuthLink from "@/components/AuthLink";


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
    .select("full_name, bio, country, avatar_url, username, role, company")
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
    alternates: { canonical: absoluteUrl(`/u/${username}`) },
    robots: profileRobots(p as any),
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

  const profileLd = [
    profileSchema(profile as any, { url: absoluteUrl(`/u/${profile.username}`), image: profile.avatar_url ?? null }),
    breadcrumbSchema([
      { name: "Home", path: "/" },
      { name: profile.full_name ?? profile.username, path: `/u/${profile.username}` },
    ]),
  ];


  // ── Producer profile branch ───────────────────────────────────────────────
  if (profile.role === "producer" || profile.role === "admin") {
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

    // avatar_url is stored as a full public URL by AvatarUpload
    const avatarSrc = profile.avatar_url || null;
    const initials = profile.full_name.split(" ").map((w: string) => w[0]).join("").slice(0,2).toUpperCase();

    return (
      <>
        <JsonLd data={profileLd} />
        <style>{`
          @keyframes arrive{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
          .arr{animation:arrive 0.55s cubic-bezier(0.16,1,0.3,1) forwards}
          .arr2{animation:arrive 0.55s 0.08s cubic-bezier(0.16,1,0.3,1) both}
          .arr3{animation:arrive 0.55s 0.16s cubic-bezier(0.16,1,0.3,1) both}
          .lnk{transition:opacity 140ms}.lnk:hover{opacity:0.65}
          .pcard{background:#fff;border-radius:14px;border:1px solid rgba(26,24,21,0.08);padding:24px 28px}
          .sl{font-size:9px;letter-spacing:.26em;text-transform:uppercase;font-weight:600;color:#BF9953;margin:0 0 12px;display:block}
          .chip-gd{display:inline-flex;align-items:center;padding:4px 13px;border-radius:100px;font-size:11px;font-weight:500;border:1px solid rgba(191,153,83,0.28);color:#8A6F3E}
          @media(max-width:768px){.two-col{grid-template-columns:1fr!important}.id-card{position:static!important}}
        `}</style>

        <div style={{background:"#F5F5F0",minHeight:"100vh",fontFamily:"'Montserrat',sans-serif"}}>

          {/* Nav */}
          <nav style={{position:"fixed",top:0,left:0,right:0,zIndex:50,height:48,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 40px",background:"rgba(245,245,240,0.95)",backdropFilter:"blur(12px)",WebkitBackdropFilter:"blur(12px)",borderBottom:"1px solid rgba(26,24,21,0.05)"}}>
            <Wordmark href="/" size="sm" />
            <ProfileNavAuth ownerId={profile.id}
              ownerNode={
                <Link href="/producerstudio/profile" className="lnk"
                  style={{fontSize:10,letterSpacing:".18em",textTransform:"uppercase",fontWeight:600,color:"rgba(26,24,21,0.5)",textDecoration:"none",display:"flex",alignItems:"center",gap:6}}>
                  ← Edit Profile
                </Link>
              }
              authedNode={
                <Link href="/dashboard" className="lnk"
                  style={{fontSize:10,letterSpacing:".18em",textTransform:"uppercase",fontWeight:600,color:"rgba(26,24,21,0.35)",textDecoration:"none"}}>
                  Dashboard
                </Link>
              }
            />
          </nav>

          {/* Two-column layout */}
          <div style={{maxWidth:1100,margin:"0 auto",padding:"72px 32px 80px"}}>
            <div className="two-col" style={{display:"grid",gridTemplateColumns:"360px 1fr",gap:24,alignItems:"start"}}>

              {/* ═══ LEFT — Identity card (sticky) ═══ */}
              <div className="id-card arr" style={{position:"sticky",top:64}}>
                <div style={{background:"#EDE8DF",borderRadius:20,padding:"36px 32px 32px",overflow:"hidden",position:"relative"}}>

                  {/* Eyebrow + Share */}
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
                    <p style={{fontSize:9,letterSpacing:".3em",textTransform:"uppercase",fontWeight:700,color:"#BF9953",margin:0}}>
                      {isVerified ? "✦  Verified Producer" : "Producer"}
                    </p>
                    <ProfileShareButton username={profile.username} name={profile.full_name} />
                  </div>

                  {/* Avatar + Name */}
                  <div style={{display:"flex",alignItems:"flex-start",gap:18,marginBottom:20}}>
                    <div style={{flexShrink:0,width:80,height:80,borderRadius:"50%",overflow:"hidden",border:"2px solid rgba(26,24,21,0.1)",background:"rgba(26,24,21,0.06)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                      {avatarSrc
                        ? <img src={avatarSrc} alt={profile.full_name} style={{width:"100%",height:"100%",objectFit:"cover"}} />
                        : <span style={{fontFamily:"'Playfair Display',serif",fontSize:26,fontWeight:700,color:"rgba(26,24,21,0.3)"}}>{initials}</span>
                      }
                    </div>
                    <div style={{paddingTop:4}}>
                      <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:"clamp(24px,3vw,34px)",fontWeight:700,lineHeight:1.08,color:"#1A1815",margin:0,letterSpacing:"-0.01em"}}>
                        {profile.full_name}
                      </h1>
                      {profile.company && (
                        <p style={{fontSize:13,fontWeight:600,color:"#BF9953",margin:"5px 0 0",letterSpacing:".02em"}}>{profile.company}</p>
                      )}
                    </div>
                  </div>

                  {/* Meta row */}
                  <div style={{display:"flex",flexWrap:"wrap",alignItems:"center",gap:"6px 16px",marginBottom:24}}>
                    {profile.country && (
                      <span style={{display:"flex",alignItems:"center",gap:5,fontSize:12,color:"rgba(26,24,21,0.5)"}}>
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1a4 4 0 100 8A4 4 0 006 1zM1 6a5 5 0 1110 0A5 5 0 011 6z" stroke="currentColor" strokeWidth="1"/><path d="M6 1c-1 1.5-1.5 3-1.5 5s.5 3.5 1.5 5M6 1c1 1.5 1.5 3 1.5 5S7 9.5 6 11M1.5 4h9M1.5 8h9" stroke="currentColor" strokeWidth=".9"/></svg>
                        {profile.country}
                      </span>
                    )}
                    {yearsExp && (
                      <span style={{fontSize:12,color:"rgba(26,24,21,0.5)"}}>
                        {yearsExp} years
                      </span>
                    )}
                    {profile.imdb_url && (
                      <a href={profile.imdb_url} target="_blank" rel="noopener noreferrer" className="lnk"
                        style={{display:"flex",alignItems:"center",gap:4,fontSize:10,letterSpacing:".1em",textTransform:"uppercase",fontWeight:700,color:"#BF9953",textDecoration:"none"}}>
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><path d="M0 1.5A1.5 1.5 0 011.5 0h7A1.5 1.5 0 0110 1.5v7A1.5 1.5 0 018.5 10h-7A1.5 1.5 0 010 8.5v-7zM2 2v6h1.25V2H2zm2 0v6h1V5.5L6.25 8h1V2H6v2.5L4.75 2H4zm3.5 0v6H9V2H7.5z"/></svg>
                        IMDb
                      </a>
                    )}
                    {profile.website && (
                      <a href={profile.website} target="_blank" rel="noopener noreferrer" className="lnk"
                        style={{fontSize:10,letterSpacing:".1em",textTransform:"uppercase",fontWeight:600,color:"rgba(26,24,21,0.4)",textDecoration:"none"}}>
                        Website ↗
                      </a>
                    )}
                    {linkedin && (
                      <a href={linkedin} target="_blank" rel="noopener noreferrer" className="lnk"
                        style={{fontSize:10,letterSpacing:".1em",textTransform:"uppercase",fontWeight:600,color:"rgba(26,24,21,0.4)",textDecoration:"none"}}>
                        LinkedIn ↗
                      </a>
                    )}
                  </div>

                  {/* Bio */}
                  {profile.bio && (
                    <p style={{fontSize:13,lineHeight:1.85,color:"rgba(26,24,21,0.6)",margin:0}}>
                      {profile.bio}
                    </p>
                  )}
                </div>
              </div>

              {/* ═══ RIGHT — Detail cards ═══ */}
              <div className="arr2" style={{display:"flex",flexDirection:"column",gap:12}}>

                {/* Accepting pitches + Send Pitch */}
                <div className="pcard" style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
                  <div style={{display:"flex",alignItems:"center",gap:12}}>
                    <div style={{width:36,height:36,borderRadius:"50%",background:acceptingPitches?"rgba(90,171,122,0.12)":"rgba(26,24,21,0.06)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      {acceptingPitches
                        ? <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8l3.5 3.5L13 4.5" stroke="#5aab7a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        : <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 3l8 8M11 3l-8 8" stroke="rgba(26,24,21,0.3)" strokeWidth="1.5" strokeLinecap="round"/></svg>
                      }
                    </div>
                    <div>
                      <p style={{fontSize:14,fontWeight:600,color:acceptingPitches?"#1A1815":"rgba(26,24,21,0.35)",margin:0,letterSpacing:".01em"}}>
                        {acceptingPitches ? "Accepting pitches" : "Not accepting pitches"}
                      </p>
                      {responseTime && acceptingPitches && (
                        <p style={{fontSize:11,color:"rgba(26,24,21,0.35)",margin:"2px 0 0"}}>{responseTime}</p>
                      )}
                    </div>
                  </div>
                  {acceptingPitches && (
                    <AuthLink
                      authedHref={`/dashboard/projects/new?producer=${profile.username}`}
                      anonHref={`/login?next=/dashboard/projects/new?producer=${profile.username}`}
                      style={{display:"inline-flex",alignItems:"center",gap:8,fontSize:10,letterSpacing:".16em",textTransform:"uppercase",fontWeight:700,color:"#F5F5F0",textDecoration:"none",background:"#1A1815",padding:"10px 20px",borderRadius:100}}>
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1 1l10 5-10 5V7l7-1-7-1V1z" fill="currentColor"/></svg>
                      Send Pitch
                    </AuthLink>
                  )}
                </div>

                {/* Genres */}
                {(genres.length > 0 || formats.length > 0) && (
                  <div className="pcard">
                    <span className="sl">Genres</span>
                    <p style={{fontSize:14,color:"rgba(26,24,21,0.65)",lineHeight:1.7,margin:0}}>
                      {[...genres,...formats].join(", ")}
                    </p>
                  </div>
                )}

                {/* Looking For */}
                {lookingFor.length > 0 && (
                  <div className="pcard">
                    <span className="sl">Currently Looking For</span>
                    <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
                      {lookingFor.map((l:string) => <span key={l} className="chip-gd">{l}</span>)}
                    </div>
                  </div>
                )}

                {/* Investment */}
                {(CAPACITY_MAP[capacity] || fundingRoles.length > 0) && (
                  <div className="pcard">
                    <span className="sl">Investment</span>
                    {CAPACITY_MAP[capacity] && (
                      <p style={{margin:"0 0 6px"}}>
                        <span style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:700,color:"#1A1815"}}>{CAPACITY_MAP[capacity]}</span>
                        {BUDGET_MAP[budget] && <span style={{fontSize:13,color:"rgba(26,24,21,0.35)",marginLeft:8}}>{BUDGET_MAP[budget]}</span>}
                      </p>
                    )}
                    {fundingRoles.length > 0 && (
                      <p style={{fontSize:13,color:"rgba(26,24,21,0.45)",margin:0}}>
                        {fundingRoles.map((r:string) => FUNDING_ROLES_MAP[r] ?? r).join(", ")}
                      </p>
                    )}
                    {stages.length > 0 && (
                      <p style={{fontSize:12,color:"rgba(26,24,21,0.35)",margin:"4px 0 0"}}>
                        {stages.map((s:string) => STAGES_MAP[s] ?? s).join(", ")}
                      </p>
                    )}
                  </div>
                )}

                {/* Markets */}
                {uniqueMarkets.length > 0 && (
                  <div className="pcard">
                    <span className="sl">Market Experience</span>
                    <p style={{fontSize:13,color:"rgba(26,24,21,0.55)",lineHeight:1.9,margin:0}}>{uniqueMarkets.join(" · ")}</p>
                  </div>
                )}

                {/* Festivals */}
                {festivals.length > 0 && (
                  <div className="pcard">
                    <span className="sl">Festival Pedigree</span>
                    <p style={{fontSize:13,color:"rgba(26,24,21,0.55)",lineHeight:1.9,margin:0}}>{festivals.join(", ")}</p>
                  </div>
                )}

                {/* Languages */}
                {languages.length > 0 && (
                  <div className="pcard">
                    <span className="sl">Languages</span>
                    <p style={{fontSize:13,color:"rgba(26,24,21,0.55)",lineHeight:1.9,margin:0}}>{languages.join(", ")}</p>
                  </div>
                )}

                {/* Footer */}
                <div style={{paddingTop:8}}>
                  <p style={{fontSize:9,letterSpacing:".26em",textTransform:"uppercase",color:"rgba(26,24,21,0.18)",fontWeight:600,margin:0}}>Pitch.Fylym</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ── Render (filmmaker) ─────────────────────────────────────────────────────
  const filmakerFmts: string[] = (profile as any).filmmaker_formats ?? [];
  const avatarSrc = profile.avatar_url || null;
  const initials  = profile.full_name.split(" ").map((w: string) => w[0]).join("").slice(0,2).toUpperCase();

  const CAREER_LABEL: Record<string,string> = {
    debut:"Debut Filmmaker", second_film:"2nd Film",
    established:"Established Filmmaker", veteran:"Veteran Filmmaker",
  };
  const FORMAT_LABEL: Record<string,string> = {
    documentary:"Documentary", narrative:"Narrative", feature:"Feature",
    short:"Short Film", series:"Series", animation:"Animation",
  };

  return (
    <>
      <JsonLd data={profileLd} />
      <style>{`
        @keyframes fkarr{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        .fka{animation:fkarr 0.55s cubic-bezier(0.16,1,0.3,1) forwards}
        .fka2{animation:fkarr 0.55s 0.08s cubic-bezier(0.16,1,0.3,1) both}
        .fklnk{transition:opacity 140ms}.fklnk:hover{opacity:0.65}
        .fkcard{background:#fff;border-radius:14px;border:1px solid rgba(26,24,21,0.08);padding:24px 28px}
        .fksl{font-size:9px;letter-spacing:.26em;text-transform:uppercase;font-weight:600;color:#BF9953;margin:0 0 12px;display:block}
        @media(max-width:768px){.fk-two{grid-template-columns:1fr!important}.fk-id{position:static!important}}
      `}</style>

      <div style={{background:"#F5F5F0",minHeight:"100vh",fontFamily:"'Montserrat',sans-serif"}}>

        {/* Nav */}
        <nav style={{position:"fixed",top:0,left:0,right:0,zIndex:50,height:48,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 40px",background:"rgba(245,245,240,0.95)",backdropFilter:"blur(12px)",WebkitBackdropFilter:"blur(12px)",borderBottom:"1px solid rgba(26,24,21,0.05)"}}>
          <Wordmark href="/" size="sm" />
          <ProfileNavAuth ownerId={profile.id}
            ownerNode={
              <Link href="/dashboard/profile" className="fklnk"
                style={{fontSize:10,letterSpacing:".18em",textTransform:"uppercase",fontWeight:600,color:"rgba(26,24,21,0.5)",textDecoration:"none",display:"flex",alignItems:"center",gap:6}}>
                ← Edit Profile
              </Link>
            }
            authedNode={
              <Link href="/dashboard" className="fklnk"
                style={{fontSize:10,letterSpacing:".18em",textTransform:"uppercase",fontWeight:600,color:"rgba(26,24,21,0.35)",textDecoration:"none"}}>
                Dashboard
              </Link>
            }
          />
        </nav>

        {/* Two-column layout */}
        <div style={{maxWidth:1100,margin:"0 auto",padding:"72px 32px 80px"}}>
          <div className="fk-two" style={{display:"grid",gridTemplateColumns:"360px 1fr",gap:24,alignItems:"start"}}>

            {/* ═══ LEFT — Identity card (sticky) ═══ */}
            <div className="fk-id fka" style={{position:"sticky",top:64}}>
              <div style={{background:"#EDE8DF",borderRadius:20,padding:"36px 32px 32px"}}>

                {/* Eyebrow + Share */}
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
                  <p style={{fontSize:9,letterSpacing:".3em",textTransform:"uppercase",fontWeight:700,color:"#BF9953",margin:0}}>
                    {CAREER_LABEL[(profile as any).career_stage] ?? "Filmmaker"}
                  </p>
                  <ProfileShareButton username={profile.username} name={profile.full_name} />
                </div>

                {/* Avatar + Name */}
                <div style={{display:"flex",alignItems:"flex-start",gap:18,marginBottom:20}}>
                  <div style={{flexShrink:0,width:80,height:80,borderRadius:"50%",overflow:"hidden",border:"2px solid rgba(26,24,21,0.1)",background:"rgba(26,24,21,0.06)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                    {avatarSrc
                      ? <img src={avatarSrc} alt={profile.full_name} style={{width:"100%",height:"100%",objectFit:"cover"}} />
                      : <span style={{fontFamily:"'Playfair Display',serif",fontSize:26,fontWeight:700,color:"rgba(26,24,21,0.3)"}}>{initials}</span>
                    }
                  </div>
                  <div style={{paddingTop:4}}>
                    <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:"clamp(22px,3vw,32px)",fontWeight:700,lineHeight:1.08,color:"#1A1815",margin:0,letterSpacing:"-0.01em"}}>
                      {profile.full_name}
                    </h1>
                    {profile.company && (
                      <p style={{fontSize:13,fontWeight:600,color:"#BF9953",margin:"5px 0 0"}}>{profile.company}</p>
                    )}
                  </div>
                </div>

                {/* Meta row */}
                <div style={{display:"flex",flexWrap:"wrap",alignItems:"center",gap:"6px 16px",marginBottom:profile.bio ? 20 : 0}}>
                  {profile.country && (
                    <span style={{fontSize:12,color:"rgba(26,24,21,0.5)"}}>{profile.country}</span>
                  )}
                  {filmakerFmts.length > 0 && (
                    <span style={{fontSize:12,color:"rgba(26,24,21,0.5)"}}>
                      {filmakerFmts.map((f:string) => FORMAT_LABEL[f] ?? f).join(", ")}
                    </span>
                  )}
                  {profile.imdb_url && (
                    <a href={profile.imdb_url} target="_blank" rel="noopener noreferrer" className="fklnk"
                      style={{fontSize:10,letterSpacing:".1em",textTransform:"uppercase",fontWeight:700,color:"#BF9953",textDecoration:"none"}}>
                      IMDb ↗
                    </a>
                  )}
                  {profile.website && (
                    <a href={profile.website} target="_blank" rel="noopener noreferrer" className="fklnk"
                      style={{fontSize:10,letterSpacing:".1em",textTransform:"uppercase",fontWeight:600,color:"rgba(26,24,21,0.4)",textDecoration:"none"}}>
                      Website ↗
                    </a>
                  )}
                  {(profile as any).linkedin_url && (
                    <a href={(profile as any).linkedin_url} target="_blank" rel="noopener noreferrer" className="fklnk"
                      style={{fontSize:10,letterSpacing:".1em",textTransform:"uppercase",fontWeight:600,color:"rgba(26,24,21,0.4)",textDecoration:"none"}}>
                      LinkedIn ↗
                    </a>
                  )}
                </div>

                {/* Bio */}
                {profile.bio && (
                  <p style={{fontSize:13,lineHeight:1.85,color:"rgba(26,24,21,0.6)",margin:0}}>{profile.bio}</p>
                )}
              </div>
            </div>

            {/* ═══ RIGHT — Detail cards ═══ */}
            <div className="fka2" style={{display:"flex",flexDirection:"column",gap:12}}>

              {/* Stats card */}
              {(projectList.length > 0 || awardsCount > 0 || festsCount > 0) && (
                <div className="fkcard" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:0}}>
                  {[
                    {val:projectList.length, label:"Projects"},
                    {val:festsCount,         label:"Selections"},
                    {val:awardsCount,        label:"Awards"},
                  ].map((s,i) => (
                    <div key={s.label} style={{textAlign:"center",padding:"8px 0",borderRight:i<2?"1px solid rgba(26,24,21,0.07)":"none"}}>
                      <p style={{fontFamily:"'Playfair Display',serif",fontSize:28,fontWeight:700,color:"#1A1815",lineHeight:1,margin:"0 0 4px"}}>{s.val}</p>
                      <p style={{fontSize:9,letterSpacing:".2em",textTransform:"uppercase",fontWeight:600,color:"rgba(26,24,21,0.32)",margin:0}}>{s.label}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Featured Projects */}
              {projectList.length > 0 && (
                <div className="fkcard">
                  <span className="fksl">Projects</span>
                  <div style={{display:"flex",flexDirection:"column",gap:10}}>
                    {projectList.map((p:any) => (
                      <Link key={p.id} href={`/filmprojects/${p.slug ?? p.id}`}
                        style={{display:"flex",alignItems:"center",gap:12,textDecoration:"none",padding:"8px 0",borderBottom:"1px solid rgba(26,24,21,0.06)"}}>
                        {p.poster_path && (
                          <div style={{width:40,height:54,borderRadius:6,overflow:"hidden",flexShrink:0,background:"rgba(26,24,21,0.06)"}}>
                            <img src={`${supabaseUrl}/storage/v1/object/public/thumbnails/${p.poster_path}`}
                              alt={p.title} style={{width:"100%",height:"100%",objectFit:"cover"}} />
                          </div>
                        )}
                        <div style={{flex:1,minWidth:0}}>
                          <p style={{fontFamily:"'Playfair Display',serif",fontSize:15,fontWeight:700,color:"#1A1815",margin:"0 0 3px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.title}</p>
                          <p style={{fontSize:11,color:"rgba(26,24,21,0.45)",margin:0}}>{[p.genre,p.format].filter(Boolean).join(" · ")}</p>
                        </div>
                        <span style={{fontSize:12,color:"rgba(26,24,21,0.2)",flexShrink:0}}>→</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Credits */}
              {creditList.length > 0 && (
                <div className="fkcard">
                  <span className="fksl">Credits</span>
                  <div style={{display:"flex",flexDirection:"column",gap:10}}>
                    {creditList.slice(0,5).map((c:any) => (
                      <div key={c.id} style={{display:"flex",alignItems:"baseline",justifyContent:"space-between",gap:12,padding:"6px 0",borderBottom:"1px solid rgba(26,24,21,0.06)"}}>
                        <div style={{minWidth:0}}>
                          <p style={{fontFamily:"'Playfair Display',serif",fontSize:14,fontWeight:700,color:"#1A1815",margin:"0 0 2px"}}>{c.title}</p>
                          {(c.festivals?.length > 0 || c.awards?.length > 0) && (
                            <p style={{fontSize:11,color:"rgba(26,24,21,0.4)",margin:0}}>
                              {c.awards?.length > 0 && <span style={{color:"#BF9953"}}>🏆 {c.awards.slice(0,1).join("")} · </span>}
                              {c.festivals?.slice(0,2).join(" · ")}
                            </p>
                          )}
                        </div>
                        {c.year && <span style={{fontSize:12,color:"rgba(26,24,21,0.3)",flexShrink:0}}>{c.year}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Message / connect CTA — only for logged-in non-owners */}
              <ProfileNavAuth ownerId={profile.id} authedNode={
                <div className="fkcard" style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
                  <div>
                    <p style={{fontSize:13,fontWeight:600,color:"#1A1815",margin:"0 0 2px"}}>Connect with {profile.full_name.split(" ")[0]}</p>
                    <p style={{fontSize:11,color:"rgba(26,24,21,0.4)",margin:0}}>Send a message or pitch a collaboration</p>
                  </div>
                  <Link href="/dashboard/messages"
                    style={{display:"inline-flex",alignItems:"center",gap:6,fontSize:10,letterSpacing:".14em",textTransform:"uppercase",fontWeight:700,color:"#F5F5F0",textDecoration:"none",background:"#1A1815",padding:"9px 18px",borderRadius:100}}>
                    Message
                  </Link>
                </div>
              } />

              {/* Footer */}
              <div style={{paddingTop:4}}>
                <p style={{fontSize:9,letterSpacing:".26em",textTransform:"uppercase",color:"rgba(26,24,21,0.18)",fontWeight:600,margin:0}}>Pitch.Fylym</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
