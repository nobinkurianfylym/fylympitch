import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Terms of Service — PITCH.FYLYM",
  description: "The terms you agree to when you use PITCH.FYLYM, including who owns what you upload.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="8 September 2026">
      <p>
        These terms apply when you use PITCH.FYLYM. By creating an account or submitting a
        project, you agree to them.
      </p>

      <h2>What the platform is</h2>
      <p>
        PITCH.FYLYM helps filmmakers find film financing — grants, funds, labs, markets,
        co-productions and producer calls — and helps producers find projects. We are an
        information and introduction platform. We are not a funder, a producer, an agent,
        or a party to any agreement you reach with anyone you meet here, and we take no
        fee, commission or credit on anything that gets financed.
      </p>

      <h2>Your account</h2>
      <p>
        Give accurate details, keep your login to yourself, and tell us if it is
        compromised. You must be at least 16. Producer accounts are verified before they
        can post opportunities or see private projects; we may decline or withdraw
        verification at our discretion.
      </p>

      <h2>Your material stays yours</h2>
      <p>
        You keep all rights in everything you upload — your logline, synopsis, budget,
        deck, script and any other material. You grant us only the permission we need to
        run the service: to store your material, show it to the people you choose to show
        it to, and process it to generate matches and analysis for you. That permission
        ends when you delete the material.
      </p>
      <p>
        You confirm that you hold the rights to what you submit and that publishing it
        here infringes no one else&rsquo;s rights.
      </p>

      <h2>What you may not do</h2>
      <ul>
        <li>Upload material you do not have the rights to.</li>
        <li>Post a funding opportunity that is not real, or that charges filmmakers a fee to be considered.</li>
        <li>Misrepresent who you are, or approach filmmakers under a false identity or company.</li>
        <li>Scrape, bulk-export or resell the opportunities database.</li>
        <li>Use the platform to spam, harass, or send unsolicited commercial offers.</li>
      </ul>
      <p>We may suspend or remove any account or listing that breaks these rules.</p>

      <h2>About the funding information</h2>
      <p>
        Our opportunities database is assembled from public sources and from submissions,
        and is re-checked automatically. We work to keep it accurate, but deadlines,
        eligibility rules and award amounts change without notice, and listings can be
        wrong or out of date. <strong>Always confirm the details on the funder&rsquo;s own
        site before you rely on them or apply.</strong> Matches, scores and suggestions are
        guidance, not professional advice, and are not a prediction that you will be
        funded.
      </p>

      <h2>Dealings with other users</h2>
      <p>
        Any conversation, submission, agreement or deal between you and another user is
        between the two of you. Verification means we checked that a producer is who they
        say they are; it is not a recommendation, and it is not a guarantee of their
        conduct. Do your own diligence before sharing material or signing anything.
      </p>

      <h2>Proof of Existence</h2>
      <p>
        The proof feature records a cryptographic fingerprint of your material on the
        Bitcoin blockchain and shows the time it was recorded. It is evidence that a
        specific file existed at a specific time and has not changed since. It is not
        copyright registration, and we make no claim about how any court or authority
        would treat it.
      </p>

      <h2>Availability</h2>
      <p>
        We provide the platform as it is. We work to keep it running and accurate, but we
        do not promise it will be uninterrupted or error-free, and features may change.
      </p>

      <h2>Liability</h2>
      <p>
        To the extent the law allows, we are not liable for indirect or consequential loss,
        for lost funding, lost opportunities or lost profit, or for the acts of other
        users. Nothing here limits liability that cannot lawfully be limited.
      </p>

      <h2>Ending it</h2>
      <p>
        You can close your account whenever you like. We may suspend or close an account
        that breaks these terms. Your material is deleted as described in the{" "}
        <a href="/privacy">Privacy Policy</a>.
      </p>

      <h2>Governing law</h2>
      <p className="note">
        To be completed: the operating entity and the jurisdiction whose law governs these
        terms. Until this is set, nothing on this page should be read as choosing a forum.
      </p>

      <h2>Changes</h2>
      <p>
        We will post any change here and update the date above. Significant changes will be
        notified by email.
      </p>
    </LegalPage>
  );
}
