const DEFAULT_NEXT_PATH = "/";

/**
 * Accepts only an application-relative destination. This keeps post-login
 * navigation useful without turning the login page into an open redirect.
 */
export function getSafeNextPath(
  value: string | string[] | null | undefined,
  fallback = DEFAULT_NEXT_PATH
): string {
  const candidate = Array.isArray(value) ? value[0] : value;

  if (
    !candidate ||
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.includes("\\") ||
    /[\u0000-\u001F\u007F]/.test(candidate)
  ) {
    return fallback;
  }

  try {
    const parsed = new URL(candidate, "https://local.invalid");
    if (parsed.origin !== "https://local.invalid" || parsed.pathname === "/login") {
      return fallback;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
