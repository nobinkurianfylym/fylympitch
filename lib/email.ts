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

    ${goldButton("Enter Producer Studio", `${SITE_URL}/producerstudio`)}

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

    <a href="${siteUrl}/producerstudio/projects"
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

// ── New Message Notification ──────────────────────────────────
export async function sendNewMessageNotification({
  to,
  recipientName,
  senderName,
  projectTitle,
  messagePreview,
  conversationUrl,
}: {
  to: string;
  recipientName: string | null;
  senderName: string | null;
  projectTitle: string;
  messagePreview: string | null;
  conversationUrl: string;
}): Promise<void> {
  const resend = getResend();
  if (!resend) {
    console.warn("[email] RESEND_API_KEY not set — skipping message notification");
    return;
  }

  const firstName = recipientName?.split(" ")[0] ?? "there";
  const from      = senderName ?? "Someone";
  const preview   = messagePreview
    ? messagePreview.length > 140
      ? messagePreview.slice(0, 140) + "…"
      : messagePreview
    : "[Attachment]";

  const body = `
    <h1 style="margin:0 0 8px;font-size:28px;font-weight:400;font-family:Georgia,serif;color:#1A1815;">
      New message
    </h1>
    <p style="margin:0 0 32px;font-size:13px;letter-spacing:0.2em;text-transform:uppercase;color:#8A857C;">
      PITCH.FYLYM Messaging
    </p>

    <p style="margin:0 0 20px;font-size:16px;line-height:1.65;color:#1A1815;">
      Hi ${firstName},
    </p>
    <p style="margin:0 0 24px;font-size:16px;line-height:1.65;color:#1A1815;">
      <strong style="font-weight:500;">${from}</strong> sent you a message about
      <strong style="font-weight:500;">${projectTitle}</strong>.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0"
      style="background:#F8F5F0;border:1px solid #E5E0D5;border-left:3px solid #BF9953;
             border-radius:10px;padding:20px 24px;margin-bottom:28px;">
      <tr><td>
        <p style="margin:0;font-size:15px;line-height:1.7;color:#1A1815;font-style:italic;">${preview}</p>
      </td></tr>
    </table>

    ${goldButton("Reply on PITCH.FYLYM", conversationUrl)}

    ${divider()}

    <p style="margin:0;font-size:13px;line-height:1.6;color:#8A857C;">
      You're receiving this because you have an active conversation on
      <a href="${SITE_URL}" style="color:#BF9953;text-decoration:none;">PITCH.FYLYM</a>.
    </p>
  `;

  try {
    const { error } = await resend.emails.send({
      from:    FROM_ADDRESS,
      to,
      subject: `New message from ${from} — ${projectTitle}`,
      html:    wrap(body),
    });
    if (error) console.error("[email] sendNewMessageNotification:", error);
  } catch (e) {
    console.error("[email] sendNewMessageNotification exception:", e);
  }
}

// ── Exclusive pitch → the one producer it was sent to ─────────
export async function sendExclusivePitchEmail({
  to,
  producerName,
  filmmakerName,
  projectTitle,
  logline,
  projectId,
}: {
  to: string;
  producerName: string | null;
  filmmakerName: string;
  projectTitle: string;
  logline: string | null;
  projectId: string;
}): Promise<void> {
  const resend = getResend();
  if (!resend) {
    console.warn("[email] RESEND_API_KEY not set — skipping exclusive pitch email");
    return;
  }

  const first = (producerName ?? "").split(" ")[0];
  const href = `${SITE_URL}/producerstudio/projects/${projectId}`;

  const body = `
    <h1 style="margin:0 0 8px;font-size:28px;font-weight:400;font-family:Georgia,serif;color:#1A1815;">
      A pitch, sent only to you
    </h1>
    <p style="margin:0 0 32px;font-size:13px;letter-spacing:0.2em;text-transform:uppercase;color:#8A857C;">
      PITCH.FYLYM Producer Studio
    </p>

    <p style="margin:0 0 20px;font-size:16px;line-height:1.65;color:#1A1815;">
      ${first ? `Hi ${first},` : "Hello,"}
    </p>

    <p style="margin:0 0 24px;font-size:16px;line-height:1.65;color:#1A1815;">
      <strong>${filmmakerName}</strong> has pitched <strong>${projectTitle}</strong> directly to
      you. No other producer can see this project or open its files.
    </p>

    ${
      logline
        ? `<div style="margin:0 0 28px;padding:18px 22px;background:#F1EDE4;border-left:2px solid #BF9953;font-size:16px;line-height:1.65;color:#1A1815;">${logline}</div>`
        : ""
    }

    ${goldButton("Read the pitch", href)}
  `;

  try {
    const { error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to,
      subject: `${filmmakerName} pitched "${projectTitle}" to you`,
      html: wrap(body),
    });
    if (error) console.error("[email] sendExclusivePitchEmail:", error);
  } catch (e) {
    console.error("[email] sendExclusivePitchEmail exception:", e);
  }
}

// ── Broadcast / Newsletter ────────────────────────────────────
/**
 * Send a broadcast/newsletter email to a list of recipients via the Resend
 * batch REST API (fetch-based — reliable in Cloudflare Workers).
 * Splits into chunks of 100 (Resend's batch limit) automatically.
 * Returns total sent and failed counts.
 */
export type BroadcastAttachment = { name: string; url: string; size?: number };

const IMAGE_EXT = /\.(png|jpe?g|webp|gif|avif|bmp)(\?|#|$)/i;

function attachmentsBlock(files: BroadcastAttachment[]): string {
  if (!files.length) return "";

  const images = files.filter((f) => IMAGE_EXT.test(f.url));
  const others = files.filter((f) => !IMAGE_EXT.test(f.url));

  // A poster IS the message — show it, don't make someone click a storage URL.
  // The filename stays a link underneath, because most mail clients block
  // remote images until the reader allows them, and an invisible attachment
  // would otherwise look like no attachment at all.
  const imageHtml = images
    .map(
      (f) => `
      <div style="margin:0 0 18px;">
        <a href="${f.url}" style="text-decoration:none;">
          <img src="${f.url}" alt="${escapeHtml(f.name)}" width="520"
               style="display:block;width:100%;max-width:520px;height:auto;border:1px solid #E5E0D5;border-radius:10px;" />
        </a>
        <a href="${f.url}" style="display:inline-block;margin-top:8px;color:#8A857C;text-decoration:none;font-size:12px;">
          ${escapeHtml(f.name)}
        </a>
      </div>`,
    )
    .join("");

  const otherHtml = others.length
    ? `<table style="border-collapse:collapse;">${others
        .map(
          (f) => `
      <tr><td style="padding:6px 0;">
        <a href="${f.url}" style="color:#BF9953;text-decoration:none;font-size:15px;">
          ${escapeHtml(f.name)}
        </a>
        ${f.size ? `<span style="color:#8A857C;font-size:12px;"> &nbsp;${(f.size / 1024 / 1024).toFixed(1)} MB</span>` : ""}
      </td></tr>`,
        )
        .join("")}</table>`
    : "";

  return `
    <div style="margin:32px 0 0;padding:20px 24px;background:#F1EDE4;border:1px solid #E5E0D5;border-radius:14px;">
      <p style="margin:0 0 14px;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#8A857C;">
        ${files.length === 1 ? "Attachment" : "Attachments"}
      </p>
      ${imageHtml}
      ${otherHtml}
    </div>`;
}

/** File names come from whatever the admin uploaded — never trust them raw. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export async function sendBroadcastEmail({
  recipients,
  subject,
  body,
  attachments = [],
}: {
  recipients: { email: string; name: string | null }[];
  subject: string;
  body: string;
  /** Rendered as a styled list of links, not as real email attachments — a
   *  link keeps the message small and still works when the mail is reopened. */
  attachments?: BroadcastAttachment[];
}): Promise<{ sent: number; failed: number }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn("[email] RESEND_API_KEY not set — skipping broadcast email");
    return { sent: 0, failed: 0 };
  }
  if (!recipients.length) return { sent: 0, failed: 0 };

  const htmlBody = `
    <h1 style="margin:0 0 8px;font-size:28px;font-weight:400;font-family:Georgia,serif;color:#1A1815;">
      ${subject}
    </h1>
    <p style="margin:0 0 32px;font-size:13px;letter-spacing:0.2em;text-transform:uppercase;color:#8A857C;">
      PITCH.FYLYM Updates
    </p>

    <div style="font-size:16px;line-height:1.75;color:#1A1815;white-space:pre-wrap;">${body}</div>

    ${attachmentsBlock(attachments)}

    ${divider()}

    <p style="margin:0;font-size:13px;line-height:1.6;color:#8A857C;">
      You're receiving this because you have an account on
      <a href="${SITE_URL}" style="color:#BF9953;text-decoration:none;">PITCH.FYLYM</a>.
      Questions? Write to us at
      <a href="mailto:hello@fylym.com" style="color:#BF9953;text-decoration:none;">hello@fylym.com</a>
    </p>
  `;
  const html = wrap(htmlBody);

  let sent = 0;
  let failed = 0;

  // Resend batch limit is 100 per call
  const CHUNK = 100;
  for (let i = 0; i < recipients.length; i += CHUNK) {
    const chunk = recipients.slice(i, i + CHUNK);
    const messages = chunk.map((r) => ({
      from: FROM_ADDRESS,
      to: r.email,
      subject,
      html,
    }));

    try {
      // Use fetch directly — more reliable than the SDK in Cloudflare Workers
      const res = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(messages),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => res.statusText);
        console.error(`[email] sendBroadcastEmail batch HTTP ${res.status}:`, errText);
        failed += chunk.length;
      } else {
        const json: any = await res.json().catch(() => null);
        // Resend batch response: { data: [...] }
        const count = Array.isArray(json?.data) ? json.data.length : chunk.length;
        sent += count;
      }
    } catch (e) {
      console.error("[email] sendBroadcastEmail exception:", e);
      failed += chunk.length;
    }
  }

  return { sent, failed };
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

// ── Daily error digest ───────────────────────────────────────
// platform_errors collected errors and /admin/errors displayed them, but
// nothing told anyone. Called by /api/cron/error-digest once a day, and only
// when there is something to report.
export async function sendErrorDigestEmail({
  to,
  total,
  groups,
}: {
  to: string[];
  total: number;
  groups: { source: string; severity: string; message: string; count: number; last: string }[];
}) {
  const resend = getResend();
  if (!resend) return;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://pitch.fylym.com";

  // escapeHtml on every field. An error message can carry whatever a user
  // typed -- a project title, a filename, a pasted URL -- and this lands in an
  // admin's inbox. An unescaped message is a way to put markup in front of the
  // one person who can change anything.
  const rows = groups
    .slice(0, 25)
    .map(
      (g) => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #E5E0D5;vertical-align:top;">
          <span style="display:inline-block;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:${
            g.severity === "error" ? "#B23B3B" : "#8A6F3E"
          };">${escapeHtml(g.severity)}</span><br/>
          <span style="font-size:13px;color:#1A1815;">${escapeHtml(g.source)}</span>
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #E5E0D5;font-size:13px;color:#1A1815;">
          ${escapeHtml(g.message).slice(0, 300)}
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #E5E0D5;font-size:13px;color:#8A857C;text-align:right;white-space:nowrap;">
          ${g.count}&times;
        </td>
      </tr>`
    )
    .join("");

  const body = `
    <p style="margin:0 0 20px;font-size:16px;line-height:1.65;color:#1A1815;">
      ${total} unresolved error${total === 1 ? "" : "s"} in the last 24 hours,
      across ${groups.length} distinct fault${groups.length === 1 ? "" : "s"}.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0"
      style="border:1px solid #E5E0D5;border-radius:10px;overflow:hidden;margin-bottom:28px;">
      ${rows}
    </table>

    ${
      groups.length > 25
        ? `<p style="margin:0 0 20px;font-size:13px;color:#8A857C;">
             ${groups.length - 25} further distinct faults not shown.
           </p>`
        : ""
    }

    <a href="${siteUrl}/admin/errors"
      style="display:inline-block;background:#1A1815;color:#F5F5F0;text-decoration:none;
             padding:14px 28px;border-radius:999px;font-size:13px;letter-spacing:0.12em;
             text-transform:uppercase;">
      Open the error log
    </a>
  `;

  try {
    const { error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to,
      subject: `PITCH.FYLYM — ${total} error${total === 1 ? "" : "s"} in the last 24 hours`,
      html: wrap(body),
    });
    if (error) console.error("[email] sendErrorDigestEmail:", error);
  } catch (e) {
    console.error("[email] sendErrorDigestEmail exception:", e);
  }
}

// ── Deadline Radar ─────────────────────────────────────────────
// Admin-triggered. One email per filmmaker covering every project
// they have, listing only funds they already match that close
// inside the window. Urgency carries the email, so deadlines lead
// and the match score is secondary.

export type RadarItem = {
  opportunity_id: string;
  title: string;
  organization: string | null;
  /** null for rolling programmes, which have no date at all. */
  deadline: string | null;
  days_left: number | null;
  score: number;
  kind: "closing" | "open";
};

export type RadarProject = {
  project_id: string;
  title: string;
  items: RadarItem[];
};

function closesIn(days: number): string {
  if (days <= 0) return "closes today";
  if (days === 1) return "closes tomorrow";
  return `closes in ${days} days`;
}

function radarRow(item: RadarItem): string {
  const name = escapeHtml(item.organization || item.title);
  const sub  = item.organization ? escapeHtml(item.title) : "";
  const open = item.kind === "open";
  const urgent = !open && (item.days_left ?? 99) <= 7;

  const status = open
    ? "Open now · accepts applications year-round"
    : `${closesIn(item.days_left ?? 0)} · ${item.deadline ?? ""}`;

  return `
    <tr><td style="padding:14px 0;border-bottom:1px solid #E5E0D5;">
      <p style="margin:0;font-size:15px;color:#1A1815;font-weight:500;">${name}</p>
      ${sub ? `<p style="margin:2px 0 0;font-size:13px;color:#8A857C;">${sub}</p>` : ""}
      <p style="margin:6px 0 0;font-size:13px;color:${urgent ? "#C0392B" : open ? "#1E8449" : "#8A857C"};">
        ${escapeHtml(status)} · match ${item.score}
      </p>
    </td></tr>`;
}

export async function sendDeadlineRadarEmail({
  to,
  filmmakerName,
  projects,
}: {
  to: string;
  filmmakerName: string;
  projects: RadarProject[];
}) {
  const resend = getResend();
  if (!resend) return { ok: false, error: "Resend not configured" };

  const total = projects.reduce((n, p) => n + p.items.length, 0);
  if (total === 0) return { ok: false, error: "nothing to send" };

  const all      = projects.flatMap(p => p.items);
  const closing  = all.filter(i => i.kind === "closing");
  const openNow  = all.filter(i => i.kind === "open");
  const soonest  = closing.length
    ? Math.min(...closing.map(i => i.days_left ?? 99))
    : 99;

  const blocks = projects.map(p => `
    <p style="margin:28px 0 4px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#8A857C;">
      ${escapeHtml(p.title)}
    </p>
    <table width="100%" cellpadding="0" cellspacing="0">
      ${p.items.map(radarRow).join("")}
    </table>`).join("");

  const headline =
    closing.length && openNow.length
      ? `${closing.length} closing, ${openNow.length} open now`
      : closing.length
        ? (closing.length === 1 ? "1 deadline is closing" : `${closing.length} deadlines are closing`)
        : (openNow.length === 1 ? "1 fund is open right now" : `${openNow.length} funds are open right now`);

  const content = `
    <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#C0392B;">
      Deadline Radar
    </p>
    <h1 style="margin:0 0 16px;font-size:26px;font-weight:400;line-height:1.25;color:#1A1815;">
      ${headline}${closing.length && soonest <= 7 ? ", one within a week" : ""}.
    </h1>
    <p style="margin:0;font-size:15px;line-height:1.7;color:#5A554D;">
      ${escapeHtml(filmmakerName)}, these are funds your ${projects.length === 1 ? "project already matches" : "projects already match"}.
      Nothing here is a cold application.
    </p>
    ${blocks}
    ${divider()}
    <p style="margin:0 0 18px;font-size:13px;line-height:1.7;color:#8A857C;">
      Scores come from your own project details. Check each fund's own page for
      eligibility before applying.
    </p>
    ${goldButton("Open your dashboard", `${SITE_URL}/dashboard`)}
  `;

  try {
    const { error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to,
      subject: closing.length
        ? (closing.length === 1
            ? "1 funding deadline is closing"
            : `${closing.length} funding deadlines are closing`)
        : (openNow.length === 1
            ? "A fund you match is open right now"
            : `${openNow.length} funds you match are open right now`),
      html: wrap(content),
    });
    if (error) return { ok: false, error: String(error) };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
