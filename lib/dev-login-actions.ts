"use server";

import { cookies } from "next/headers";

const COOKIE_NAME = "fyp_dev_unlock";

export async function unlockDevLogin(formData: FormData) {
  const passcode = String(formData.get("passcode") ?? "").trim();
  const secret = process.env.DEV_LOGIN_SECRET;

  // If the secret isn't configured on this environment, refuse outright —
  // never fall open just because the check can't be performed.
  if (!secret) return { error: "Dev login is not configured on this environment." };
  if (!passcode || passcode !== secret) return { error: "Incorrect passcode." };

  const jar = await cookies();
  jar.set(COOKIE_NAME, secret, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/dev-login",
    maxAge: 60 * 60 * 8, // 8 hours
  });
  return { ok: true };
}

export async function isDevLoginUnlocked(): Promise<boolean> {
  const secret = process.env.DEV_LOGIN_SECRET;
  if (!secret) return false;
  const jar = await cookies();
  return jar.get(COOKIE_NAME)?.value === secret;
}
