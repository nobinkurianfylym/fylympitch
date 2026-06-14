/**
 * Sanitise the ?next= redirect parameter.
 *
 * Rules:
 *  - Must be a relative path (starts with /)
 *  - Must NOT be protocol-relative (// would redirect off-domain)
 *  - Must NOT loop back to auth pages
 *  - Must NOT exceed MAX_LEN characters (prevents header-size abuse and log bloat)
 *  - Falls back to /dashboard on any violation
 */

const MAX_LEN = 200;

export function sanitizeNext(raw: string | null | undefined): string {
  const value = (raw ?? "").trim();
  if (
    value.length <= MAX_LEN &&
    value.startsWith("/") &&
    !value.startsWith("//") &&        // block //evil.com
    !value.startsWith("/login") &&
    !value.startsWith("/signup") &&
    !value.startsWith("/auth")
  ) {
    return value;
  }
  return "/dashboard";
}
