import { redirect } from "next/navigation";

/**
 * Single source of truth for the privacy policy is /privacy.html (the
 * COPPA-oriented policy kept in public/). This route used to hold a second,
 * divergent template — a kids' product must have exactly ONE policy, so /privacy
 * now redirects to the canonical page.
 */
export default function PrivacyRedirect() {
  redirect("/privacy.html");
}
