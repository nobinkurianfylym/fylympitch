import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Cookie Policy — PITCH.FYLYM",
  description: "The few cookies PITCH.FYLYM sets, what each one does, and how long it lasts.",
  alternates: { canonical: "/cookies" },
};

export default function CookiesPage() {
  return (
    <LegalPage title="Cookies" updated="8 September 2026">
      <p>
        PITCH.FYLYM sets a small number of cookies, and all of them are needed for the site
        to work. There are no advertising cookies, no analytics cookies and no third-party
        trackers — which is why you are not asked to dismiss a consent banner.
      </p>

      <h2>What we set</h2>
      <ul>
        <li>
          <strong>Session cookies</strong> (names beginning <code>sb-</code>) — set by
          Supabase, our authentication provider. They keep you signed in as you move
          between pages. They expire when your session does, and clearing them signs you
          out.
        </li>
        <li>
          <strong><code>fyp_role</code></strong> — remembers whether you were last looking
          at the filmmaker or producer view, so the site opens where you left it. A display
          preference only. Lasts a year.
        </li>
        <li>
          <strong><code>signup_role</code></strong> — carries your chosen role through the
          few seconds between starting a signup and returning from your email or from
          Google. Lasts five minutes and is then discarded.
        </li>
      </ul>

      <h2>Turning them off</h2>
      <p>
        Your browser can block or delete cookies for this site. Blocking the session
        cookies will stop you signing in; blocking the other two costs you nothing but a
        remembered preference.
      </p>

      <h2>If this changes</h2>
      <p>
        If we ever add analytics or anything non-essential, we will ask for your consent
        first and list it here. For everything else we do with your data, see the{" "}
        <a href="/privacy">Privacy Policy</a>.
      </p>
    </LegalPage>
  );
}
