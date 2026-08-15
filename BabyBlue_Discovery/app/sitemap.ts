import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3002";
  const supabase = await createClient();
  const [{ data: clinics }, { data: practitioners }] = await Promise.all([
    supabase.from("clinics").select("slug"),
    supabase.from("practitioners").select("slug").eq("is_active", true),
  ]);

  return [
    { url: SITE, changeFrequency: "daily", priority: 1 },
    ...((clinics ?? []) as { slug: string }[]).map((c) => ({
      url: `${SITE}/practice/${c.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...((practitioners ?? []) as { slug: string }[]).map((p) => ({
      url: `${SITE}/dr/${p.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
