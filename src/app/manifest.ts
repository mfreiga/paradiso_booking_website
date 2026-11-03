import type { MetadataRoute } from "next";

const pwaIcons: MetadataRoute.Manifest["icons"] = [
  { src: "/pwa-icon/192", sizes: "192x192", type: "image/png" },
  { src: "/pwa-icon/512", sizes: "512x512", type: "image/png" },
  { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
];

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hairstyling Paradiso",
    short_name: "Paradiso",
    description: "Friseur in der Augustenstraße 72, München. Termine online buchen.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    icons: pwaIcons,
  };
}
