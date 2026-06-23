"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Status = "checking" | "sent" | "no-session";

export default function ExtensionConnectPage() {
  const [status, setStatus] = useState<Status>("checking");
  const [name, setName]     = useState("");

  useEffect(() => {
    async function run() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) { setStatus("no-session"); return; }

      // Fetch display name
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", session.user.id)
        .single();
      setName(profile?.full_name ?? session.user.email ?? "Filmmaker");

      // Post token — content.js on this page relays it to the extension background
      window.postMessage({
        type:   "FYLYM_EXTENSION_AUTH",
        token:  session.access_token,
        userId: session.user.id,
      }, window.location.origin);

      setStatus("sent");
    }
    run();
  }, []);

  // ── UI ────────────────────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center"
      style={{ backgroundColor: "#1A1815", color: "#F5F5F0", fontFamily: "var(--font-montserrat, sans-serif)" }}
    >
      <div className="text-center max-w-sm px-8">
        {/* Wordmark */}
        <p
          className="text-[11px] tracking-[0.3em] uppercase mb-12"
          style={{ color: "#BF9953" }}
        >
          PITCH.FYLYM
        </p>

        {status === "checking" && (
          <>
            <p className="text-[13px] tracking-widest uppercase" style={{ color: "#8A857C" }}>
              Connecting…
            </p>
          </>
        )}

        {status === "sent" && (
          <>
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-6"
              style={{ backgroundColor: "rgba(191,153,83,0.15)", border: "1px solid rgba(191,153,83,0.3)" }}
            >
              <span style={{ color: "#BF9953", fontSize: 22 }}>✓</span>
            </div>
            <h1
              className="text-[22px] font-normal mb-3"
              style={{ fontFamily: "var(--font-playfair, serif)" }}
            >
              Extension Connected
            </h1>
            <p className="text-[13px] mb-2" style={{ color: "#8A857C" }}>
              Signed in as
            </p>
            <p className="text-[15px] mb-8">{name}</p>
            <p className="text-[12px]" style={{ color: "#8A857C" }}>
              You can close this tab. The extension is ready to fill fund applications.
            </p>
          </>
        )}

        {status === "no-session" && (
          <>
            <h1
              className="text-[22px] font-normal mb-4"
              style={{ fontFamily: "var(--font-playfair, serif)" }}
            >
              Not signed in
            </h1>
            <p className="text-[13px] mb-8" style={{ color: "#8A857C" }}>
              Please log in to PITCH.FYLYM first, then try connecting again.
            </p>
            <a
              href="/login?next=/extension-connect"
              className="inline-block px-6 py-3 text-[11px] tracking-[0.2em] uppercase transition-opacity hover:opacity-80"
              style={{ backgroundColor: "#BF9953", color: "#1A1815" }}
            >
              Log In →
            </a>
          </>
        )}
      </div>
    </div>
  );
}
