import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "BabyBlue — The waiting room, without the waiting",
    template: "%s · BabyBlue",
  },
  description:
    "BabyBlue puts your walk-in queue on every patient's phone — no app, no account. Built for dentists, GPs and clinics.",
  icons: {
    icon: "/icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-background min-h-screen">{children}</body>
    </html>
  );
}
