import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3002";
  return {
    rules: [{ userAgent: "*", allow: "/" }],
    sitemap: `${SITE}/sitemap.xml`,
  };
}
