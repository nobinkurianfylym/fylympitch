// ============================================================
// ⚠️  DEVELOPMENT ONLY — remove /app/dev-login/ before go-live
// Gated behind a passcode (DEV_LOGIN_SECRET env var) so it's
// safe to leave deployed without exposing test credentials.
// ============================================================

import { isDevLoginUnlocked } from "@/lib/dev-login-actions";
import DevLoginGate from "@/components/DevLoginGate";
import DevLoginCards from "@/components/DevLoginCards";

export const dynamic = "force-dynamic";

export default async function DevLoginPage() {
  const unlocked = await isDevLoginUnlocked();
  if (!unlocked) return <DevLoginGate />;
  return <DevLoginCards />;
}
