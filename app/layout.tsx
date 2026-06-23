import "./globals.css";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Sona — speech practice for kids",
  description:
    "A friendly, game-style app that helps kids practice tricky speech sounds — built with a licensed speech-language pathologist.",
  manifest: "/manifest.webmanifest",
  icons: { apple: "/apple-touch-icon.png", icon: "/coach/leo-icon.png" },
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
        <script
          dangerouslySetInnerHTML={{
            __html:
              '(function(){try{var K="sona.utm.v1";if(localStorage.getItem(K))return;var p=new URLSearchParams(location.search),o={},a=false;["utm_source","utm_medium","utm_campaign","utm_content","utm_term"].forEach(function(k){var v=p.get(k);if(v){o[k]=v.slice(0,120);a=true;}});var r=document.referrer||"";if(!a&&!r)return;o.referrer=r.slice(0,200);o.landing=location.pathname.slice(0,120);o.ts=new Date().toISOString();localStorage.setItem(K,JSON.stringify(o));}catch(e){}})();',
          }}
        />
        <script defer src="/_vercel/insights/script.js" />
        <script src="/pixel.js" />
      </body>
    </html>
  );
}
