import "./guides.css";
import { APP_STORE } from "@/lib/guides";

// The guides' own frame: speaksona.com's look (parents.html's colours and
// type), a way home, and the App Store. The root layout still adds analytics
// and pixel.js; pixel.js sends nothing on /guides, because which speech guide
// a parent reads is about their child and is not Meta's to know.
export default function GuidesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="g">
      <header className="g-top">
        <div className="g-wrap g-bar">
          <a className="g-brand" href="/">
            <img src="/apple-touch-icon.png?v=2" alt="" width="34" height="34" />
            <b>Sona</b>
          </a>
          <nav aria-label="Site">
            <a href="/guides">Guides</a>
            <a className="g-btn sm" href={APP_STORE} data-store="">Get the app</a>
          </nav>
        </div>
      </header>
      <div className="g-wrap">{children}</div>
      <footer className="g-foot g-wrap">
        <p>Sona is an at-home speech practice tool. It is not a diagnosis, evaluation, or substitute for professional care.</p>
        <p>
          <a href="mailto:hello@speaksona.com?subject=Sona">Email us</a> · <a href="/privacy.html">Privacy</a> · <a href="/terms">Terms</a>
        </p>
      </footer>
      {/* An Android phone has no Sona app to download: the buttons go to the web app, as on the home page. */}
      <script
        dangerouslySetInnerHTML={{
          __html:
            '(function(){try{if(!/Android/i.test(navigator.userAgent||""))return;document.querySelectorAll("a[data-store]").forEach(function(a){a.href="/onboarding.html";});document.querySelectorAll("[data-store-note]").forEach(function(n){n.textContent="Free to try in your browser";});}catch(e){}})();',
        }}
      />
    </div>
  );
}
