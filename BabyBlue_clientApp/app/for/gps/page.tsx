import type { Metadata } from "next";
import SegmentLanding from "@/components/marketing/SegmentLanding";
import { getSegment } from "@/lib/marketing/segments";

const segment = getSegment("gps");

export const metadata: Metadata = {
  title: segment.metaTitle,
  description: segment.metaDescription,
};

export default function GPsPage() {
  return <SegmentLanding segment={segment} />;
}
