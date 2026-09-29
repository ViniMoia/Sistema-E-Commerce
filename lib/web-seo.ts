export const PRIVATE_WEB_PATHS = [
  "/admin/",
  "/api/",
  "/checkout/",
  "/forgot-password",
  "/login",
  "/profile/",
  "/register",
  "/reset-password",
];

export function productPath(productId: string): string {
  return `/produto/${encodeURIComponent(productId)}`;
}

export function toAbsoluteHttpUrl(value: string | null | undefined, origin: string): string | null {
  if (!value) return null;

  try {
    const url = new URL(value, `${origin}/`);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

