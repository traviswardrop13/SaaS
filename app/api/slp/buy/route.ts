/**
 * The first cut of BUYNOW1 (#317, 25 Nov 2026) opened Stripe from /plans
 * through this address. /api/slp/checkout does it now (the paid return is
 * /api/slp/checkout/done, and Stripe's webhook sends the sign-in email for a
 * buyer who never came back). This stays only so a /plans page loaded before
 * that build still opens its checkout: the same handler, the same answer
 * shape ({ ok, url }). Nothing links here; delete it after Black Friday.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export { POST } from "@/app/api/slp/checkout/route";
