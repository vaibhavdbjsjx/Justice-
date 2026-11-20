import type { MetadataRoute } from "next";

const BASE = process.env.NEXT_PUBLIC_APP_URL || "https://lexa-main.netlify.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Private app surfaces, plus the unguessable intake links.
      disallow: [
        "/api/",
        "/account",
        "/billing",
        "/chat",
        "/clients",
        "/consent",
        "/dashboard",
        "/documents",
        "/drafting",
        "/intake/",
        "/marketplace",
        "/matters",
        "/onboarding",
        "/research",
      ],
    },
    sitemap: `${BASE}/sitemap.xml`,
  };
}
