import { createClient } from "@/lib/supabase/server";
import { adminSetApproval, adminVerifyProducer } from "@/lib/actions";
import { notFound } from "next/navigation";
import Link from "next/link";
import { formatBudget } from "@/lib/format";
import { formatFormat, formatStage } from "@/lib/film-identity";
import { lookupUserEmail } from "@/lib/admin-email";

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = {
  filmmaker: "Filmmaker",
  producer: "Producer",
  investor: "Investor",
  organization: "Organization",
  admin: "Admin",
};

const CAREER_LABEL: Record<string, string> = {
  debut: "Debut film",
  second_film: "Second film",
  established: "Established",
  veteran: "Veteran",
};

const ROLE_TYPE_LABEL: Record<string, string> = {
  independent_producer: "Independent producer",
  production_company: "Production company",
  executive_producer: "Executive producer",
  line_producer: "Line producer",
  studio: "Studio",
  sales_agent: "Sales agent",
  distributor: "Distributor",
};

const BUDGET_RANGE_LABEL: Record<string, string> = {
  micro: "Micro (under $250k)",
  low: "Low ($250k – $2M)",
  mid: "Mid ($2M – $10M)",
  high: "High ($10M+)",
};

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
};

function date(iso: string | null | undefined) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** Renders a value, or an explicit "not supplied" marker. Never invents a placeholder. */
function Field({ label, children, href }: { label: string; children?: React.ReactNode; href?: string | null }) {
  const empty = children === null || children === undefined || children === "" || children === false;
  return (
    <div className="py-3 border-b border-line last:border-0">
      <p className="text-[10px] tracking-[0.18em] uppercase text-ash">{label}</p>
      <div className="text-[14px] text-ink mt-1 break-words">
        {empty ? (
          <span className="text-ash/60 italic">Not supplied</span>
        ) : href ? (
          <a href={href} target="_blank" rel="noreferrer" className="underline decoration-line hover:text-gold">
            {children} ↗
          </a>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-line rounded-card px-6 py-5">
      <p className="text-[10px] tracking-[0.24em] uppercase text-gold font-medium">{title}</p>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Chips({ items }: { items?: string[] | null }) {
  if (!items?.length) return <span className="text-ash/60 italic">Not supplied</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((v) => (
        <span key={v} className="text-[11px] px-2.5 py-0.5 rounded-full border border-gold/25 text-[#8A6F3E]">
          {v}
        </span>
      ))}
    </div>
  );
}

export default async function AdminUserDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  // `email` is resolved separately from auth.users via lib/admin-email, which is
  // authoritative; the copy on profiles is a cache that drifts.
  const { data: p, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  // A failed read is not a missing user. Swallowing the error here turned every
  // PostgREST failure into a bare 404, which says "this person does not exist"
  // when the truth is "the query broke".
  if (profileError) {
    throw new Error(`Could not load profile ${id}: ${profileError.message}`);
  }
  if (!p) notFound();

  const isProducerish = p.role === "producer" || p.role === "investor" || p.role === "organization";

  const [emailRes, producerRes, creditsRes, projectsRes] = await Promise.all([
    lookupUserEmail(id),
    isProducerish
      ? supabase.from("producer_profiles").select("*").eq("user_id", id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("filmmaker_credits")
      .select("id, title, year, format, festivals, awards, is_featured")
      .eq("user_id", id)
      .order("year", { ascending: false, nullsFirst: false }),
    supabase
      .from("projects")
      .select("id, slug, title, genre, format, stage, is_public, admin_hidden, funding_needed_usd, created_at")
      .eq("owner_id", id)
      .order("created_at", { ascending: false }),
  ]);

  const email    = emailRes.email;
  const emailErr = emailRes.error;
  const pp       = producerRes.data as any;
  const credits  = creditsRes.data ?? [];
  const projects = projectsRes.data ?? [];

  const avatarSrc = p.avatar_url || null;
  const initials  = (p.full_name ?? "?")
    .split(" ").map((w: string) => w[0]).filter(Boolean).join("").slice(0, 2).toUpperCase();

  const canDecide = p.role !== "filmmaker" && p.role !== "admin";

  // Evidence checklist — pure presence/absence of supplied fields. No score,
  // no weighting, no judgement. Just what the applicant did and did not give us.
  const evidence: { label: string; ok: boolean }[] = [
    { label: "Full name",     ok: !!p.full_name },
    { label: "Email",         ok: !!email },
    { label: "Country",       ok: !!p.country },
    { label: "Bio",           ok: !!p.bio },
    { label: "Company",       ok: !!p.company },
    { label: "IMDb",          ok: !!p.imdb_url },
    { label: "Website",       ok: !!p.website },
    { label: "LinkedIn",      ok: !!(p as any).linkedin_url },
    { label: "Avatar",        ok: !!p.avatar_url },
    { label: "Onboarded",     ok: !!p.onboarded_at },
    ...(isProducerish
      ? [
          { label: "Producer profile", ok: !!pp },
          { label: "Stated credits",   ok: !!pp?.credits },
          { label: "Genre focus",      ok: !!pp?.genres?.length },
          { label: "Territories",      ok: !!pp?.territories?.length },
        ]
      : [
          { label: "Filmmaker credits", ok: credits.length > 0 },
          { label: "Career stage",      ok: !!p.career_stage },
          { label: "Projects",          ok: projects.length > 0 },
        ]),
  ];
  const supplied = evidence.filter((e) => e.ok).length;

  return (
    <div>
      <Link href="/admin/users" className="text-[11px] tracking-[0.16em] uppercase text-ash hover:text-gold">
        ← User management
      </Link>

      {/* ── Identity header ───────────────────────────────────────── */}
      <div className="flex flex-wrap items-start gap-5 mt-5">
        {avatarSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarSrc} alt="" className="w-16 h-16 rounded-full object-cover border border-line shrink-0" />
        ) : (
          <div className="w-16 h-16 rounded-full border border-line bg-parchment flex items-center justify-center text-[16px] text-ash shrink-0">
            {initials}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p className="eyebrow">{ROLE_LABEL[p.role] ?? p.role}</p>
          <h1 className="font-display text-[30px] font-normal mt-1 flex items-center gap-2 flex-wrap">
            {p.full_name ?? "Unnamed"}
            {p.is_producer_verified && (
              <span
                title="Verified producer"
                className="inline-flex items-center justify-center w-[18px] h-[18px] rounded-full bg-blue-500 text-white text-[10px] font-bold leading-none"
              >
                ✓
              </span>
            )}
          </h1>
          <div className="flex items-center gap-2 flex-wrap mt-2">
            <span className={`text-[10px] tracking-[0.14em] uppercase px-2.5 py-0.5 rounded-full border ${STATUS_STYLE[p.approval_status] ?? ""}`}>
              {p.approval_status}
            </span>
            {p.username && (
              <Link href={`/u/${p.username}`} className="text-[12px] text-ash hover:text-gold underline decoration-line">
                /u/{p.username} ↗
              </Link>
            )}
            <span className="text-[12px] text-ash">Joined {date(p.created_at)}</span>
          </div>
        </div>

        {/* ── Decisions ───────────────────────────────────────────── */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {canDecide && p.approval_status !== "approved" && (
            <form action={adminSetApproval}>
              <input type="hidden" name="user_id" value={p.id} />
              <input type="hidden" name="decision" value="approved" />
              <button className="btn-gold !py-2 !px-4 text-[13px]">Approve</button>
            </form>
          )}
          {canDecide && p.approval_status !== "rejected" && (
            <form action={adminSetApproval}>
              <input type="hidden" name="user_id" value={p.id} />
              <input type="hidden" name="decision" value="rejected" />
              <button className="btn-ghost !py-2 !px-4 text-[13px]">Reject</button>
            </form>
          )}
          {p.role === "producer" && p.approval_status === "approved" && (
            <form action={adminVerifyProducer}>
              <input type="hidden" name="user_id" value={p.id} />
              <input type="hidden" name="verify" value={p.is_producer_verified ? "false" : "true"} />
              <button
                className={
                  p.is_producer_verified
                    ? "btn-ghost !py-2 !px-4 text-[13px] border-blue-200 text-blue-600"
                    : "btn-ghost !py-2 !px-4 text-[13px]"
                }
              >
                {p.is_producer_verified ? "✓ Unverify" : "Verify"}
              </button>
            </form>
          )}
        </div>
      </div>

      {p.role === "filmmaker" && (
        <p className="text-[12px] text-ash mt-4">
          Filmmaker accounts are approved automatically at signup — only producers enter the pending queue.
        </p>
      )}

      <div className="grid md:grid-cols-2 gap-5 mt-8" style={{ gridAutoRows: "min-content" }}>
        {/* ── Contact & identity ────────────────────────────────── */}
        <Panel title="Identity">
          <Field label="Email">
            {emailErr ? (
              <span className="text-red-700">Lookup failed — {emailErr}</span>
            ) : email ? (
              <>
                <a href={`mailto:${email}`} className="underline decoration-line hover:text-gold">{email}</a>
                {emailRes.source === "profiles" && (
                  <span className="block text-[11px] text-amber-700 mt-1">
                    From the profiles copy — auth.users has no address for this account.
                  </span>
                )}
                {emailRes.staleProfileEmail && (
                  <span className="block text-[11px] text-amber-700 mt-1">
                    profiles.email is out of date ({emailRes.staleProfileEmail}). Shown value is from auth.users.
                  </span>
                )}
              </>
            ) : null}
          </Field>
          <Field label="Country">{p.country}</Field>
          <Field label="Company">{p.company}</Field>
          <Field label="Website" href={p.website}>{p.website}</Field>
          <Field label="IMDb" href={p.imdb_url}>{p.imdb_url}</Field>
          <Field label="LinkedIn" href={(p as any).linkedin_url}>{(p as any).linkedin_url}</Field>
          <Field label="Onboarded">{date(p.onboarded_at)}</Field>
          <Field label="User ID"><span className="font-mono text-[12px] text-ash">{p.id}</span></Field>
        </Panel>

        {/* ── Evidence supplied ─────────────────────────────────── */}
        <Panel title={`Evidence supplied · ${supplied}/${evidence.length}`}>
          <p className="text-[12px] text-ash mb-3">
            Presence of each field, as submitted. Not a score — absence is not disqualifying.
          </p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            {evidence.map((e) => (
              <div key={e.label} className="flex items-center gap-2 text-[13px]">
                <span className={e.ok ? "text-emerald-600" : "text-ash/40"}>{e.ok ? "●" : "○"}</span>
                <span className={e.ok ? "text-ink" : "text-ash/60"}>{e.label}</span>
              </div>
            ))}
          </div>
        </Panel>

        {/* ── Bio ───────────────────────────────────────────────── */}
        <div className="md:col-span-2">
          <Panel title="Bio">
            {p.bio ? (
              <p className="text-[14px] leading-[1.7] text-ink whitespace-pre-wrap">{p.bio}</p>
            ) : (
              <p className="text-[14px] text-ash/60 italic">Not supplied</p>
            )}
          </Panel>
        </div>

        {/* ── Producer profile ──────────────────────────────────── */}
        {isProducerish && (
          <div className="md:col-span-2">
            <Panel title="Producer profile">
              {!pp ? (
                <p className="text-[14px] text-ash/60 italic">
                  No producer profile row — this account has not completed producer onboarding.
                </p>
              ) : (
                <>
                  <div className="grid md:grid-cols-2 gap-x-8">
                    <div>
                      <Field label="Role type">{ROLE_TYPE_LABEL[pp.role_type] ?? pp.role_type}</Field>
                      <Field label="Contact email">{pp.contact_email}</Field>
                      <Field label="Country">{pp.country}</Field>
                      <Field label="IMDb" href={pp.imdb_url}>{pp.imdb_url}</Field>
                      <Field label="Budget range">{BUDGET_RANGE_LABEL[pp.budget_range] ?? pp.budget_range}</Field>
                    </div>
                    <div>
                      <Field label="Genres"><Chips items={pp.genres} /></Field>
                      <Field label="Formats"><Chips items={pp.formats?.map((f: string) => formatFormat(f))} /></Field>
                      <Field label="Territories"><Chips items={pp.territories} /></Field>
                      <Field label="Festivals"><Chips items={pp.festivals} /></Field>
                      <Field label="Openness">
                        <div className="flex flex-wrap gap-3 text-[13px]">
                          <span className={pp.open_to_coproduction ? "text-ink" : "text-ash/50"}>
                            {pp.open_to_coproduction ? "●" : "○"} Co-production
                          </span>
                          <span className={pp.open_to_ep ? "text-ink" : "text-ash/50"}>
                            {pp.open_to_ep ? "●" : "○"} EP
                          </span>
                          <span className={pp.bringing_territory_funding ? "text-ink" : "text-ash/50"}>
                            {pp.bringing_territory_funding ? "●" : "○"} Territory funding
                          </span>
                          <span className={pp.is_public ? "text-ink" : "text-ash/50"}>
                            {pp.is_public ? "●" : "○"} Public listing
                          </span>
                        </div>
                      </Field>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-line">
                    <p className="text-[10px] tracking-[0.18em] uppercase text-ash">Stated credits</p>
                    {pp.credits ? (
                      <p className="text-[14px] leading-[1.7] text-ink mt-1 whitespace-pre-wrap">{pp.credits}</p>
                    ) : (
                      <p className="text-[14px] text-ash/60 italic mt-1">Not supplied</p>
                    )}
                    <p className="text-[11px] text-ash mt-2">
                      Self-reported. Cross-check against the IMDb link above before verifying.
                    </p>
                  </div>
                </>
              )}

              {/* Matching fields live on profiles, not producer_profiles */}
              <div className="mt-4 pt-4 border-t border-line grid md:grid-cols-2 gap-x-8">
                <div>
                  <Field label="Industry genres"><Chips items={(p as any).industry_genres} /></Field>
                  <Field label="Industry formats">
                    <Chips items={(p as any).industry_formats?.map((f: string) => formatFormat(f))} />
                  </Field>
                  <Field label="Industry countries"><Chips items={(p as any).industry_countries} /></Field>
                </div>
                <div>
                  <Field label="Budget appetite">
                    {p.min_budget_usd != null || p.max_budget_usd != null
                      ? `${p.min_budget_usd != null ? formatBudget(p.min_budget_usd) : "—"} → ${
                          p.max_budget_usd != null ? formatBudget(p.max_budget_usd) : "—"
                        }`
                      : null}
                  </Field>
                  <Field label="Available funding">
                    {p.available_funding_usd != null ? formatBudget(p.available_funding_usd) : null}
                  </Field>
                  <Field label="Festival track record">
                    {p.festival_track_record ? "Declared" : null}
                  </Field>
                </div>
              </div>
            </Panel>
          </div>
        )}

        {/* ── Filmmaker credits ─────────────────────────────────── */}
        {!isProducerish && (
          <div className="md:col-span-2">
            <Panel title={`Filmmaker credits · ${credits.length}`}>
              <div className="mb-3">
                <Field label="Career stage">{CAREER_LABEL[p.career_stage] ?? p.career_stage}</Field>
                <Field label="Formats">
                  <Chips items={(p as any).filmmaker_formats?.map((f: string) => formatFormat(f))} />
                </Field>
              </div>
              {credits.length === 0 ? (
                <p className="text-[14px] text-ash/60 italic">No credits added.</p>
              ) : (
                <div className="divide-y divide-line">
                  {credits.map((c: any) => (
                    <div key={c.id} className="py-3">
                      <p className="text-[14px] text-ink">
                        {c.title}
                        {c.year && <span className="text-ash"> · {c.year}</span>}
                        {c.format && <span className="text-ash"> · {formatFormat(c.format)}</span>}
                        {c.is_featured && <span className="text-gold text-[11px] ml-2">Featured</span>}
                      </p>
                      {!!c.festivals?.length && (
                        <p className="text-[12px] text-ash mt-1">Festivals: {c.festivals.join(", ")}</p>
                      )}
                      {!!c.awards?.length && (
                        <p className="text-[12px] text-ash mt-0.5">Awards: {c.awards.join(", ")}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-ash mt-3">Self-reported. Not independently verified.</p>
            </Panel>
          </div>
        )}

        {/* ── Projects ──────────────────────────────────────────── */}
        <div className="md:col-span-2">
          <Panel title={`Projects · ${projects.length}`}>
            {projects.length === 0 ? (
              <p className="text-[14px] text-ash/60 italic">No projects.</p>
            ) : (
              <div className="divide-y divide-line">
                {projects.map((pr: any) => (
                  <div key={pr.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={pr.is_public && pr.slug ? `/filmprojects/${pr.slug}` : "/admin/projects"}
                        className="text-[14px] text-ink hover:text-gold uppercase"
                      >
                        {pr.title}
                      </Link>
                      <p className="text-[12px] text-ash mt-0.5">
                        {[pr.genre, formatFormat(pr.format), formatStage(pr.stage)].filter(Boolean).join(" · ")}
                        {pr.funding_needed_usd != null && ` · seeking ${formatBudget(pr.funding_needed_usd)}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[10px] tracking-[0.14em] uppercase ${pr.is_public ? "text-emerald-700" : "text-ash"}`}>
                        {pr.is_public ? "Public" : "Private"}
                      </span>
                      {pr.admin_hidden && (
                        <span className="text-[10px] tracking-[0.14em] uppercase text-red-700">Hidden</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
