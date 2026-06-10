import "./globals.css";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Sona — speech practice for kids",
  description:
    "A friendly, game-style app that helps kids practice tricky speech sounds — built with a licensed speech-language pathologist.",
  manifest: "/manifest.webmanifest",
  icons: { apple: "/apple-touch-icon.png", icon: "/icon-192.png" },
  appleWebApp: { capable: true, title: "Sona", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#2a9df4",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        {children}
        <script defer src="/_vercel/insights/script.js" />
      </body>
    </html>
  );
}
