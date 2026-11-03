// Separate manifest for the admin: installed to the Home Screen it opens
// straight into /admin (the public manifest opens the website).
export function GET() {
  return Response.json(
    {
      name: "Paradiso Admin",
      short_name: "Paradiso",
      start_url: "/admin",
      scope: "/",
      display: "standalone",
      background_color: "#fafafa",
      theme_color: "#0a0a0a",
      icons: [
        { src: "/pwa-icon/192", sizes: "192x192", type: "image/png" },
        { src: "/pwa-icon/512", sizes: "512x512", type: "image/png" },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json" } },
  );
}
