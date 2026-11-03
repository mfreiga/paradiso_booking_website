// Public base URL for links in emails (manage / review links).
// SITE_URL is the explicit setting; Netlify provides URL automatically, so
// links stay valid even if SITE_URL is forgotten. Localhost only in dev.
export function siteUrl(): string {
  const url =
    process.env.SITE_URL ??
    process.env.AUTH_URL ??
    process.env.URL ??
    "http://localhost:3000";
  return url.replace(/\/+$/, "");
}
