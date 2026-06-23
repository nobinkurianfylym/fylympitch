import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Project, Opportunity } from "@/types";
import { PrintButton } from "./PrintButton";

export const dynamic = "force-dynamic";

// ─── helpers ─────────────────────────────────────────────────────────────────

function usdDisplay(n: number | null | undefined): string | null {
  if (!n) return null;
  if (n >= 1_000_000) return `USD ${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `USD ${(n / 1_000).toFixed(0)}K`;
  return `USD ${n.toLocaleString()}`;
}

function fmtDate(d: string | null | undefined): string | null {
  if (!d) return null;
  return new Date(d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const STAGE_LABEL: Record<string, string> = {
  development: "Development",
  pre_production: "Pre-Production",
  production: "Production",
  post_production: "Post-Production",
  completed: "Completed",
};

const FORMAT_LABEL: Record<string, string> = {
  feature: "Feature Film",
  short: "Short Film",
  documentary: "Documentary",
  series: "Series",
  animation: "Animation",
};

// ─── field row ───────────────────────────────────────────────────────────────

function Field({
  label,
  value,
  large,
}: {
  label: string;
  value?: string | null;
  large?: boolean;
}) {
  if (!value) return null;
  return (
    <div className="mb-6 break-inside-avoid">
      <p
        className="text-[10px] tracking-[0.2em] uppercase mb-1"
        style={{ color: "#8A857C" }}
      >
        {label}
      </p>
      <p
        className={large ? "text-[14px] leading-relaxed" : "text-[15px] font-medium"}
        style={{ color: "#1A1815" }}
      >
        {value}
      </p>
    </div>
  );
}

// ─── page ────────────────────────────────────────────────────────────────────

export default async function ApplyPacketPage({
  params,
}: {
  params: Promise<{ projectId: string; opportunityId: string }>;
}) {
  const { projectId, opportunityId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard/opportunities");

  const [{ data: project }, { data: opp }] = await Promise.all([
    supabase
      .from("projects")
      .select(
        `
        id, title, logline, synopsis, director_statement,
        stage, genre, format, language, country_of_origin,
        budget_usd, budget_currency, budget_amount,
        finance_secured_usd, funding_needed_usd,
        director_name, writer_name, runtime_minutes,
        has_script_doc, has_budget_doc, has_lookbook, has_coproducer,
        producer_info, owner_id,
        filmmaker:profiles!projects_owner_id_fkey(full_name, email, company)
      `
      )
      .eq("id", projectId)
      .single<Project & { filmmaker: { full_name: string; email: string | null; company: string | null } | null }>(),
    supabase
      .from("opportunities")
      .select("id, title, opp_type, description, deadline, max_award_usd, url, app_link, apply_method, form_url")
      .eq("id", opportunityId)
      .single<Opportunity>(),
  ]);

  if (!project || !opp) notFound();
  // Only the project owner can export
  if (project.owner_id !== user.id) redirect("/dashboard/opportunities");

  const filmmaker = (project as any).filmmaker;
  const directorName = project.director_name ?? filmmaker?.full_name ?? null;

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: "#F5F5F0", fontFamily: "var(--font-montserrat, sans-serif)" }}
    >
      {/* ── toolbar (hidden on print) ───────────────────────────────────── */}
      <div
        className="print:hidden sticky top-0 z-10 px-8 py-4 flex items-center justify-between border-b"
        style={{ backgroundColor: "#F5F5F0", borderColor: "rgba(26,24,21,0.12)" }}
      >
        <div>
          <p
            className="text-[10px] tracking-[0.2em] uppercase mb-0.5"
            style={{ color: "#8A857C" }}
          >
            Application Packet
          </p>
          <p className="text-[14px] font-medium" style={{ color: "#1A1815" }}>
            {project.title} → {opp.title}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {(opp.app_link ?? opp.url) && (
            <a
              href={opp.app_link ?? opp.url ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] tracking-[0.14em] uppercase px-4 py-2 border rounded-sm transition-colors"
              style={{ borderColor: "rgba(26,24,21,0.2)", color: "#8A857C" }}
            >
              Official Site →
            </a>
          )}
          <PrintButton />
        </div>
      </div>

      {/* ── document ────────────────────────────────────────────────────── */}
      <div className="max-w-2xl mx-auto px-8 py-12">

        {/* Fund header */}
        <div
          className="pb-8 mb-10 border-b"
          style={{ borderColor: "rgba(26,24,21,0.12)" }}
        >
          <p
            className="text-[10px] tracking-[0.2em] uppercase mb-2"
            style={{ color: "#BF9953" }}
          >
            Applying To
          </p>
          <h1
            className="text-[28px] font-normal mb-1"
            style={{ fontFamily: "var(--font-playfair, serif)", color: "#1A1815" }}
          >
            {opp.title}
          </h1>
          <div
            className="flex flex-wrap gap-x-6 gap-y-1 text-[13px] mt-3"
            style={{ color: "#8A857C" }}
          >
            {fmtDate(opp.deadline) && (
              <span>Deadline — <span style={{ color: "#1A1815" }}>{fmtDate(opp.deadline)}</span></span>
            )}
            {opp.max_award_usd && (
              <span>Up to — <span style={{ color: "#BF9953" }}>{usdDisplay(opp.max_award_usd)}</span></span>
            )}
          </div>
        </div>

        {/* Project fields */}
        <div
          className="pb-8 mb-10 border-b"
          style={{ borderColor: "rgba(26,24,21,0.12)" }}
        >
          <p
            className="text-[10px] tracking-[0.2em] uppercase mb-6"
            style={{ color: "#BF9953" }}
          >
            Project
          </p>

          <Field label="Project Title" value={project.title} />
          <Field label="Format" value={FORMAT_LABEL[project.format] ?? project.format} />
          <Field label="Stage" value={STAGE_LABEL[project.stage] ?? project.stage} />
          <Field label="Genre" value={project.genre} />
          <Field label="Language" value={project.language} />
          <Field label="Country of Origin" value={(project as any).country_of_origin ?? (project as any).country} />
          {(project as any).runtime_minutes && (
            <Field label="Runtime" value={`${(project as any).runtime_minutes} minutes`} />
          )}
          <Field label="Director" value={directorName} />
          {project.writer_name && <Field label="Writer" value={project.writer_name} />}
          <Field label="Logline" value={project.logline} large />
          <Field label="Synopsis" value={project.synopsis ?? undefined} large />
          {project.director_statement && (
            <Field label="Director's Statement" value={project.director_statement} large />
          )}
          {project.producer_info && (
            <Field label="Producer / Team" value={project.producer_info} large />
          )}
        </div>

        {/* Budget */}
        <div
          className="pb-8 mb-10 border-b"
          style={{ borderColor: "rgba(26,24,21,0.12)" }}
        >
          <p
            className="text-[10px] tracking-[0.2em] uppercase mb-6"
            style={{ color: "#BF9953" }}
          >
            Budget & Finance
          </p>
          <Field label="Total Budget" value={usdDisplay(project.budget_usd)} />
          <Field label="Finance Secured" value={usdDisplay(project.finance_secured_usd)} />
          <Field label="Funding Needed" value={usdDisplay(project.funding_needed_usd)} />
          <Field
            label="Co-producer Attached"
            value={project.has_coproducer ? "Yes" : "No"}
          />
        </div>

        {/* Asset readiness */}
        <div
          className="pb-8 mb-10 border-b"
          style={{ borderColor: "rgba(26,24,21,0.12)" }}
        >
          <p
            className="text-[10px] tracking-[0.2em] uppercase mb-6"
            style={{ color: "#BF9953" }}
          >
            Assets Available
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-[13px]" style={{ color: "#1A1815" }}>
            {project.has_script_doc && <span>✓ Script</span>}
            {project.has_budget_doc && <span>✓ Budget Document</span>}
            {project.has_lookbook && <span>✓ Lookbook / Visual Bible</span>}
            {project.has_coproducer && <span>✓ Co-producer Attached</span>}
          </div>
          {!project.has_script_doc && !project.has_budget_doc && !project.has_lookbook && (
            <p className="text-[13px]" style={{ color: "#8A857C" }}>No assets uploaded yet.</p>
          )}
        </div>

        {/* Contact */}
        <div className="mb-10">
          <p
            className="text-[10px] tracking-[0.2em] uppercase mb-6"
            style={{ color: "#BF9953" }}
          >
            Contact
          </p>
          {filmmaker?.full_name && <Field label="Filmmaker" value={filmmaker.full_name} />}
          {filmmaker?.company && <Field label="Company" value={filmmaker.company} />}
          {filmmaker?.email && <Field label="Email" value={filmmaker.email} />}
        </div>

        {/* Footer */}
        <div
          className="pt-6 border-t text-[11px] print:block"
          style={{ borderColor: "rgba(26,24,21,0.12)", color: "#8A857C" }}
        >
          <p>Generated by PITCH.FYLYM · pitch.fylym.com</p>
          <p className="mt-1">
            Copy fields directly into the fund's application form at{" "}
            {opp.app_link ?? opp.url ?? opp.title}.
          </p>
        </div>
      </div>
    </div>
  );
}
