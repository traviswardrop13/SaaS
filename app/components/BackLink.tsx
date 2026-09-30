"use client";

// A way back from the plain legal pages (/terms, /support). Inside the iOS app
// there is no back-swipe and no browser bar, so a parent who tapped Terms or
// Support in Settings had no way out of the page (29 Sep 2026). Came from a
// Sona page: it goes back there. Anything else (a shared link, a new tab,
// another site): it goes to the home page. history.length can't tell those
// apart — it counts forward entries and other sites too.
export default function BackLink({ className = "" }: { className?: string }) {
  return (
    <a
      href="/"
      className={"flex w-fit min-h-[44px] items-center gap-1 text-sm font-extrabold " + className}
      onClick={(e) => {
        const from = typeof document !== "undefined" ? document.referrer : "";
        if (from && from.startsWith(window.location.origin + "/")) {
          e.preventDefault();
          window.history.back();
        }
      }}
    >
      <span aria-hidden="true">‹</span> Back
    </a>
  );
}
