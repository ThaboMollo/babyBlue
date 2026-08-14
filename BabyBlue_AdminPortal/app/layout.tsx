import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import SplashScreen from "@/components/SplashScreen";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "BabyBlue Admin Portal",
  description: "Clinic queue management for staff",
  icons: {
    icon: "/BabyBlue_icon.ico",
    apple: "/BabyBlue_icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <SplashScreen />
        {children}
      </body>
    </html>
  );
}
