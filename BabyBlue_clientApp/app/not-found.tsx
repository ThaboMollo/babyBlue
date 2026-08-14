import Link from "next/link";
import PageShell from "@/components/ui/PageShell";

export default function NotFound() {
  return (
    <PageShell>
      <div className="flex flex-col items-center justify-center flex-1 p-md text-center">
        <h2 className="text-xl font-semibold text-text-primary">Page not found</h2>
        <p className="text-text-secondary mt-sm text-sm">
          This link doesn&apos;t seem to be valid. Please scan the QR code again.
        </p>
        <Link
          href="/"
          className="mt-lg text-primary text-sm underline underline-offset-4"
        >
          Browse clinics
        </Link>
      </div>
    </PageShell>
  );
}
