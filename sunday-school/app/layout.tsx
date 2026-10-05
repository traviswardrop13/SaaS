import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gospel Questions",
  description:
    "A class asks its gospel questions, votes on them, and studies the ones that rise to the top — with real scriptures and prophetic teachings.",
};

export const viewport: Viewport = {
  themeColor: "#faf6ef",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen font-serif antialiased">{children}</body>
    </html>
  );
}
