import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Lexa",
    short_name: "Lexa",
    description: "Understand your legal situation in minutes. Legal information, not legal advice.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#faf9f5",
    theme_color: "#c15f3c",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
