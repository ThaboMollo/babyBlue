import type { Metadata } from "next";
import Link from "next/link";
import { Stethoscope } from "lucide-react";
import "./globals.css";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3002";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: "BabyBlue — Find & book a doctor near you",
    template: "%s · BabyBlue",
  },
  description:
    "Search doctors, practices and services across South Africa and book in seconds — no app, no account, just your WhatsApp number.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-background text-text-primary">
        <header className="border-b border-border bg-surface">
          <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 font-bold text-primary">
              <Stethoscope size={22} />
              BabyBlue
            </Link>
            <Link href="/" className="text-sm text-text-secondary hover:text-primary">
              Find care
            </Link>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-border bg-surface">
          <div className="max-w-5xl mx-auto px-4 py-6 text-xs text-text-secondary flex flex-wrap justify-between gap-2">
            <span>© 2026 BabyBlue. Built for South African healthcare.</span>
            <span>Book with just your name and WhatsApp number.</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
