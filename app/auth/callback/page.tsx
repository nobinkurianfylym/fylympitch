"use client";

/**
 * Auth callback — client-side implementation.
 *
 * WHY CLIENT-SIDE:
 * opennextjs-cloudflare does not dispatch to route handlers (route.ts) that
 * use cookies() from next/headers — it serves a prerendered HTML shell
 * (x-nextjs-prerender: 1) instead of running the handler, so the OAuth /
 * magic-link code was never exchanged and login was completely broken.
 * A "use client" page uses no server-dynamic APIs, so it is served as a
 * static shell and the exchange runs in the browser where it works reliably.
 *
 * IMPORTANT — detectSessionInUrl: false
 * createBrowserClient defaults to detectSessionInUrl: true, which makes the
 * client auto-exchange the ?code= on load. The auth code is SINGLE-USE, so
 * that would race with (and break) the explicit exchange below, bouncing
 * every user to /login?error=auth. We disable it and drive the exchange
 * ourselves so the flow is deterministic and errors are surfaced.
 *
 * Session cookies are written by createBrowserClient in the same format the
 * SSR middleware reads, so protected routes keep working unchanged.
 */

import { Suspense, useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { supabaseUrl, supabaseAnonKey } from "@/lib/supabase/env";
import { sanitizeNext } from "@/lib/sanitizeNext";

function readCookie(name: string): string | null {
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(name + "="));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

function CallbackHandler() {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    // Read straight from the URL — no useSearchParams, so this page has no
    // dependency on Next's client router being hydrated first.
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const next = sanitizeNext(params.get("next"));

    // Supabase reports OAuth failures (denied consent, expired link) as
    // ?error=/?error_description= rather than by omitting the code.
    const oauthError = params.get("error");

    // Hard navigation, not router.replace: guarantees the freshly written
    // session cookies are attached to the next request the middleware sees.
    const go = (path: string) => window.location.replace(path);

    if (oauthError) return go("/login?error=cancelled");
    if (!code) return go("/login?error=cancelled");

    (async () => {
      try {
        const supabase = createBrowserClient(supabaseUrl(), supabaseAnonKey(), {
          auth: { detectSessionInUrl: false, flowType: "pkce" },
        });

        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (error || !data?.user) {
          console.error("[auth/callback]", error?.message);
          setFailed(true);
          return go("/login?error=auth");
        }

        const user = data.user;

        // Claim the role chosen at signup (set as a cookie before OAuth).
        const signupRole = readCookie("signup_role");
        if (signupRole && ["filmmaker", "producer"].includes(signupRole)) {
          await supabase.rpc("claim_signup_role", { desired_role: signupRole });
        }

        // maybeSingle(): a brand-new OAuth user's profile row may not exist
        // yet (created by trigger). single() would log a spurious error.
        const { data: profile } = await supabase
          .from("profiles")
          .select("role, approval_status")
          .eq("id", user.id)
          .maybeSingle();

        const role = (profile as any)?.role ?? "filmmaker";
        const approval = (profile as any)?.approval_status ?? "approved";
        const isNewUser =
          Date.now() - new Date(user.created_at).getTime() < 120_000;

        // Honour an explicit deep link for returning users only.
        const defaultDests = ["/dashboard", "/producerstudio", "/admin", "/"];
        if (next && !defaultDests.includes(next) && !isNewUser) return go(next);

        if (role === "admin") return go("/admin");

        if (role === "producer") {
          return go(
            isNewUser || approval !== "approved"
              ? "/producerstudio/pending"
              : "/producerstudio",
          );
        }

        // filmmaker (default)
        return go(isNewUser ? "/onboarding" : "/dashboard");
      } catch (e) {
        console.error("[auth/callback] unexpected", e);
        setFailed(true);
        go("/login?error=auth");
      }
    })();
  }, []);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        fontFamily: "system-ui, sans-serif",
        color: "#8A857C",
        fontSize: "13px",
        letterSpacing: "0.12em",
        textTransform: "uppercase",
      }}
    >
      {failed ? "Redirecting…" : "Signing you in…"}
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense>
      <CallbackHandler />
    </Suspense>
  );
}
