import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/dashboard/",
        "/producer/",
        "/admin/",
        "/api/",
      ],
    },
    sitemap: "https://pitch.fylym.com/sitemap.xml",
  };
}
