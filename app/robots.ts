import type { MetadataRoute } from "next";
import { SITE } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/dashboard/",
        "/producerstudio/",
        "/admin/",
        "/api/",
        "/support",
        "/apply-packet/",
        "/opportunities/submit",
        "/*?*sort=",
        "/*?*q=",
      ],
    },
    sitemap: `${SITE.host}/sitemap.xml`,
    host: SITE.host,
  };
}
