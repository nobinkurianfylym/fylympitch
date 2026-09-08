import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy — PITCH.FYLYM",
  description: "What PITCH.FYLYM collects, why, who it is shared with, and how to get it deleted.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="8 September 2026">
      <p>
        This explains what PITCH.FYLYM collects, why, and what you can do about it.
        We have tried to keep it short and specific rather than long and defensive.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li><strong>Account details</strong> — your name, email address, and the role you signed up as (filmmaker or producer). If you sign in with Google, we receive your email address and name from Google; we never see your password.</li>
        <li><strong>Project material</strong> — everything you enter about a film: title, logline, synopsis, budget, team, and any pitch deck or script you upload.</li>
        <li><strong>Producer profiles</strong> — company details, credits and contact information you choose to publish.</li>
        <li><strong>Activity</strong> — the opportunities you save or apply to, and basic records of when a project page is viewed or shared, so we can show you interest in your own work.</li>
        <li><strong>Technical data</strong> — standard server logs kept by our hosting provider, including IP address and browser type.</li>
      </ul>
      <p>
        We do not run advertising trackers, and we do not sell personal data to anyone.
      </p>

      <h2>What is public and what is not</h2>
      <p>
        Your project is private by default. It becomes visible to others only when you
        publish it, and you control that setting at any time. Uploaded decks and scripts
        are stored in private buckets and served through short-lived links — they are not
        published on the open web, and they are not readable by other users unless you
        share the project with them.
      </p>

      <h2>Why we use it</h2>
      <ul>
        <li>To match your project against funds, labs, markets and producer calls.</li>
        <li>To let verified producers discover projects that fit what they are looking for.</li>
        <li>To send you deadline reminders, match alerts and service email. You can turn these off.</li>
        <li>To keep the platform working, secure and free of fraudulent listings.</li>
      </ul>

      <h2>Automated analysis</h2>
      <p>
        Matching, funding-readiness scores and written suggestions are produced with the
        help of large language models operated by third parties (currently OpenAI, Cerebras
        and Groq). Project text may be sent to those providers to generate a result. This
        material is not used to train their models. These outputs are guidance, not
        decisions about you — no funding outcome is determined by the platform.
      </p>

      <h2>Who we share it with</h2>
      <p>We use a small number of processors, each doing one job:</p>
      <ul>
        <li><strong>Supabase</strong> — database, authentication and file storage.</li>
        <li><strong>Cloudflare</strong> — hosting and delivery.</li>
        <li><strong>Resend</strong> — transactional email.</li>
        <li><strong>OpenAI, Cerebras, Groq</strong> — the analysis described above.</li>
      </ul>
      <p>
        Beyond these, we share your information only with people you choose to share it
        with on the platform, or where the law requires it.
      </p>

      <h2>Proof of Existence and the Bitcoin blockchain</h2>
      <p>
        When you generate a proof for a project, we calculate a SHA-256 fingerprint of the
        submitted material and anchor that fingerprint to the Bitcoin blockchain. Only the
        fingerprint is published. It is a one-way value: your synopsis, deck or script
        cannot be reconstructed from it, and nothing about you is written to the chain.
        A blockchain record cannot be deleted, so a fingerprint you publish stays published
        even if you later delete the project.
      </p>

      <h2>How long we keep it</h2>
      <p>
        For as long as your account exists. Delete a project and it goes; ask us to close
        your account and we remove your personal data and uploaded files, other than the
        minimum we must keep for legal or security reasons.
      </p>

      <h2>Your rights</h2>
      <p>
        You can access, correct, export or delete your data. Most of it you can change
        yourself in your account; for anything else, write to{" "}
        <a href="mailto:hello@fylym.com">hello@fylym.com</a> and we will act on it. If you
        are in the UK, EU or another region with equivalent law, you also have the right to
        object to processing and to complain to your data protection authority.
      </p>

      <h2>Children</h2>
      <p>PITCH.FYLYM is not intended for anyone under 16, and we do not knowingly collect their data.</p>

      <h2>Changes</h2>
      <p>
        If we change this policy in a way that matters, we will say so on this page and,
        for significant changes, by email.
      </p>
    </LegalPage>
  );
}
