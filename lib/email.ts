// lib/email.ts
// Transactional email via Resend (https://resend.com).
//
// Setup:
//   1. Sign up at resend.com, create an API key.
//   2. Add RESEND_API_KEY to Cloudflare environment variables.
//   3. Verify your sending domain at resend.com/domains (once verified,
//      change FROM_ADDRESS to noreply@yourdomain.com).
//      Until then, Resend allows sending from onboarding@resend.dev
//      which still delivers but shows "via resend.dev" in Gmail.
//
// All functions fail silently (console.error only) — email is
// best-effort and must never break the main application flow.

import { Resend } from "resend";

const FROM_ADDRESS = "PITCH.FYLYM <hello@fylym.com>";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://fylympitch.com";

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

// ── Shared HTML wrapper ───────────────────────────────────────
function wrap(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>PITCH.FYLYM</title>
</head>
<body style="margin:0;padding:0;background:#F5F5F7;font-family:'Helvetica Neue',Arial,sans-serif;color:#1A1815;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F5F7;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

        <!-- Wordmark -->
        <tr><td style="padding-bottom:40px;">
          <p style="margin:0;font-size:14px;letter-spacing:0.32em;color:#1A1815;text-transform:uppercase;">
            <span style="color:#BF9953;">F</span>YLYM<span style="color:#BF9953;">P</span>ITCH
          </p>
        </td></tr>

        <!-- Card -->
        <tr><td style="background:#FFFFFF;border:1px solid #E5E0D5;border-radius:14px;padding:48px 40px;">
          ${content}
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding-top:32px;padding-bottom:8px;">
          <p style="margin:0;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#8A857C;text-align:center;">
            © PITCH.FYLYM · Intelligent film financing
          </p>
          <p style="margin:8px 0 0;font-size:11px;color:#8A857C;text-align:center;">
            <a href="${SITE_URL}" style="color:#8A857C;text-decoration:underline;">${SITE_URL}</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function goldButton(label: string, href: string): string {
  return `<a href="${href}" style="display:inline-block;background:#1A1815;color:#F5F5F7;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;font-weight:500;text-decoration:none;padding:14px 28px;border-radius:14px;margin-top:8px;">${label}</a>`;
}

function divider(): string {
  return `<div style="border-top:1px solid #E5E0D5;margin:32px 0;"></div>`;
}

// ── Email 1: Application received (sent to producer at signup) ─
export async function sendProducerApplicationEmail(
  to: string,
  name: string,
  company: string
): Promise<void> {
  const resend = getResend();
  if (!resend) {
    console.warn("[email] RESEND_API_KEY not set — skipping producer application email");
    return;
  }

  const firstName = name.split(" ")[0];

  const body = `
    <h1 style="margin:0 0 8px;font-size:28px;font-weight:400;font-family:Georgia,serif;color:#1A1815;">
      Application received
    </h1>
    <p style="margin:0 0 32px;font-size:13px;letter-spacing:0.2em;text-transform:uppercase;color:#8A857C;">
      PITCH.FYLYM Producer Studio
    </p>

    <p style="margin:0 0 20px;font-size:16px;line-height:1.65;color:#1A1815;">
      Hi ${firstName},
    </p>
    <p style="margin:0 0 20px;font-size:16px;line-height:1.65;color:#1A1815;">
      We've received your application for a producer account under
      <strong style="font-weight:500;">${company}</strong>.
      Our team verifies every producer account to maintain the quality and trust of the
      PITCH.FYLYM community.
    </p>
    <p style="margin:0 0 32px;font-size:16px;line-height:1.65;color:#1A1815;">
      You'll hear from us within <strong style="font-weight:500;">24 hours</strong>.
      Once approved, you'll have full access to the Producer Studio — where you can
      discover projects, manage your pipeline, and connect with filmmakers directly.
    </p>

    ${divider()}

    <p style="margin:0 0 8px;font-size:13px;letter-spacing:0.2em;text-transform:uppercase;color:#8A857C;">
      While you wait
    </p>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.65;color:#1A1815;">
      Browse the public project gallery — no account required.
    </p>
    ${goldButton("Browse projects", `${SITE_URL}/projects`)}

    ${divider()}

    <p style="margin:0;font-size:13px;line-height:1.6;color:#8A857C;">
      Questions? Reply to this email or contact us at
      <a href="mailto:nobinkurian@yahoo.com" style="color:#BF9953;text-decoration:none;">nobinkurian@yahoo.com</a>
    </p>
  `;

  try {
    const { error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to,
      subject: "Application received — PITCH.FYLYM Producer Studio",
      html: wrap(body),
    });
    if (error) console.error("[email] sendProducerApplicationEmail:", error);
  } catch (e) {
    console.error("[email] sendProducerApplicationEmail exception:", e);
  }
}

// ── Email 2: Account approved (sent when admin approves) ───────
export async function sendProducerApprovedEmail(
  to: string,
  name: string,
  company: string
): Promise<void> {
  const resend = getResend();
  if (!resend) {
    console.warn("[email] RESEND_API_KEY not set — skipping producer approved email");
    return;
  }

  const firstName = name.split(" ")[0];

  const body = `
    <h1 style="margin:0 0 8px;font-size:28px;font-weight:400;font-family:Georgia,serif;color:#1A1815;">
      You're approved
    </h1>
    <p style="margin:0 0 32px;font-size:13px;letter-spacing:0.2em;text-transform:uppercase;color:#BF9953;">
      PITCH.FYLYM Producer Studio
    </p>

    <p style="margin:0 0 20px;font-size:16px;line-height:1.65;color:#1A1815;">
      Hi ${firstName},
    </p>
    <p style="margin:0 0 20px;font-size:16px;line-height:1.65;color:#1A1815;">
      Your producer account for <strong style="font-weight:500;">${company}</strong> has
      been approved. You now have full access to the PITCH.FYLYM Producer Studio.
    </p>

    ${divider()}

    <p style="margin:0 0 8px;font-size:13px;letter-spacing:0.2em;text-transform:uppercase;color:#8A857C;">
      What's waiting for you
    </p>
    <table cellpadding="0" cellspacing="0" style="margin:16px 0 28px;">
      ${[
        ["Pipeline", "Your personal CRM — save, shortlist and track projects across a 5-stage Kanban board."],
        ["All projects", "Browse every project on PITCH.FYLYM — public and private submissions."],
        ["Meetings", "Request meetings with filmmakers directly from any project page."],
        ["Messages", "Secure messaging with filmmakers to discuss financing and co-production."],
      ].map(([title, desc]) => `
        <tr>
          <td style="padding:10px 0;vertical-align:top;">
            <p style="margin:0 0 2px;font-size:14px;font-weight:500;color:#1A1815;">${title}</p>
            <p style="margin:0;font-size:13px;line-height:1.55;color:#8A857C;">${desc}</p>
          </td>
        </tr>
      `).join("")}
    </table>

    ${goldButton("Enter Producer Studio", `${SITE_URL}/producer`)}

    ${divider()}

    <p style="margin:0;font-size:13px;line-height:1.6;color:#8A857C;">
      Questions? Reply to this email or contact
      <a href="mailto:nobinkurian@yahoo.com" style="color:#BF9953;text-decoration:none;">nobinkurian@yahoo.com</a>
    </p>
  `;

  try {
    const { error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to,
      subject: "Your PITCH.FYLYM producer account is approved",
      html: wrap(body),
    });
    if (error) console.error("[email] sendProducerApprovedEmail:", error);
  } catch (e) {
    console.error("[email] sendProducerApprovedEmail exception:", e);
  }
}

// ── Email 3: Account declined ──────────────────────────────────
export async function sendProducerDeclinedEmail(
  to: string,
  name: string
): Promise<void> {
  const resend = getResend();
  if (!resend) return;

  const firstName = name.split(" ")[0];

  const body = `
    <h1 style="margin:0 0 32px;font-size:28px;font-weight:400;font-family:Georgia,serif;color:#1A1815;">
      Application update
    </h1>

    <p style="margin:0 0 20px;font-size:16px;line-height:1.65;color:#1A1815;">Hi ${firstName},</p>
    <p style="margin:0 0 20px;font-size:16px;line-height:1.65;color:#1A1815;">
      After reviewing your application, we're unable to approve your producer account
      at this time.
    </p>
    <p style="margin:0 0 32px;font-size:16px;line-height:1.65;color:#1A1815;">
      If you believe this is a mistake or would like to discuss further, please reach
      out directly — we're happy to help.
    </p>

    ${divider()}

    <p style="margin:0;font-size:13px;line-height:1.6;color:#8A857C;">
      Contact us at
      <a href="mailto:nobinkurian@yahoo.com" style="color:#BF9953;text-decoration:none;">nobinkurian@yahoo.com</a>
    </p>
  `;

  try {
    const { error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to,
      subject: "Your PITCH.FYLYM producer application",
      html: wrap(body),
    });
    if (error) console.error("[email] sendProducerDeclinedEmail:", error);
  } catch (e) {
    console.error("[email] sendProducerDeclinedEmail exception:", e);
  }
}

// ── Introduction Request ──────────────────────────────────────
export async function sendIntroductionRequest({
  to,
  filmmakerName,
  filmmakerCompany,
  projectTitle,
  projectGenre,
  projectCountry,
}: {
  to: string;
  filmmakerName: string;
  filmmakerCompany: string | null;
  projectTitle: string;
  projectGenre: string;
  projectCountry: string;
}) {
  const resend = getResend();
  if (!resend) return;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://fylympitch.com";

  const body = `
    <p style="margin:0 0 20px;font-size:16px;line-height:1.65;color:#1A1815;">
      A filmmaker on PITCH.FYLYM has requested an introduction — their project matches your interests.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0"
      style="background:#F8F5F0;border:1px solid #E5E0D5;border-radius:10px;padding:24px;margin-bottom:28px;">
      <tr><td>
        <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#8A857C;">Project</p>
        <p style="margin:0 0 16px;font-size:20px;font-family:Georgia,serif;color:#1A1815;">${projectTitle}</p>

        <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#8A857C;">Genre · Country</p>
        <p style="margin:0 0 16px;font-size:15px;color:#1A1815;">${projectGenre} · ${projectCountry}</p>

        <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#8A857C;">From</p>
        <p style="margin:0;font-size:15px;color:#1A1815;">${filmmakerName}${filmmakerCompany ? ` · ${filmmakerCompany}` : ""}</p>
      </td></tr>
    </table>

    <p style="margin:0 0 28px;font-size:15px;line-height:1.65;color:#8A857C;">
      Log in to PITCH.FYLYM to view the full project, review the filmmaker's pitch, and respond.
    </p>

    <a href="${siteUrl}/producer/projects"
      style="display:inline-block;background:#BF9953;color:#ffffff;font-size:13px;
             letter-spacing:0.16em;text-transform:uppercase;text-decoration:none;
             padding:14px 28px;border-radius:8px;">
      View project on PITCH.FYLYM
    </a>
  `;

  try {
    const { error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to,
      subject: `Introduction request: ${projectTitle}`,
      html: wrap(body),
    });
    if (error) console.error("[email] sendIntroductionRequest:", error);
  } catch (e) {
    console.error("[email] sendIntroductionRequest exception:", e);
  }
}

// ── Engine Ready ─────────────────────────────────────────────
export async function sendEngineReady({
  to,
  filmmakerName,
  projectTitle,
  projectId,
}: {
  to: string;
  filmmakerName: string;
  projectTitle: string;
  projectId: string;
}) {
  const resend = getResend();
  if (!resend) return;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://pitch.fylym.com";
  const reportUrl = `${siteUrl}/dashboard/projects/${projectId}`;

  const body = `
    <p style="margin:0 0 20px;font-size:16px;line-height:1.65;color:#1A1815;">
      Hi ${filmmakerName} — your PITCH.FYLYM intelligence report is ready.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0"
      style="background:#F8F5F0;border:1px solid #E5E0D5;border-radius:10px;padding:24px;margin-bottom:28px;">
      <tr><td>
        <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#8A857C;">Project</p>
        <p style="margin:0;font-size:22px;font-family:Georgia,serif;color:#1A1815;">${projectTitle}</p>
      </td></tr>
    </table>

    <p style="margin:0 0 28px;font-size:15px;line-height:1.65;color:#8A857C;">
      Your report includes matched funding opportunities ranked by fit, a financing roadmap,
      funding readiness score, and FYLYM Intelligence recommendations.
    </p>

    <a href="${reportUrl}"
      style="display:inline-block;background:#BF9953;color:#ffffff;font-size:13px;
             letter-spacing:0.16em;text-transform:uppercase;text-decoration:none;
             padding:14px 28px;border-radius:8px;">
      View your report
    </a>
  `;

  try {
    const { error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to,
      subject: `Your PITCH.FYLYM report for "${projectTitle}" is ready`,
      html: wrap(body),
    });
    if (error) console.error("[email] sendEngineReady:", error);
  } catch (e) {
    console.error("[email] sendEngineReady exception:", e);
  }
}
