import type { Metadata } from "next";
import SegmentLanding from "@/components/marketing/SegmentLanding";
import { getSegment } from "@/lib/marketing/segments";

const segment = getSegment("dentists");

export const metadata: Metadata = {
  title: segment.metaTitle,
  description: segment.metaDescription,
};

export default function DentistsPage() {
  return <SegmentLanding segment={segment} />;
}
