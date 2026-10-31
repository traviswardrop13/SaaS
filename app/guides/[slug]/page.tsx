import { notFound } from "next/navigation";
import GuideView, { guideMetadata } from "../GuideView";
import { GUIDES, guideBySlug, guideShown } from "@/lib/guides";

// /guides/<slug>: every guide in lib/guides.ts, built at deploy time. Any
// other address is a 404, and so, on speaksona.com, is a guide Rachel has not
// read yet.
export const dynamicParams = false;

export function generateStaticParams() {
  return GUIDES.filter((g) => g.slug).map((g) => ({ slug: g.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  const g = guideBySlug(params.slug);
  return g && g.slug ? guideMetadata(g) : {};
}

export default function GuidePage({ params }: { params: { slug: string } }) {
  const g = guideBySlug(params.slug);
  if (!g || !g.slug || !guideShown(g)) notFound();
  return <GuideView g={g} />;
}
