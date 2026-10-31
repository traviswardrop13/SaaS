import { notFound } from "next/navigation";
import GuideView, { guideMetadata } from "./GuideView";
import { guideBySlug, guideShown, type Guide } from "@/lib/guides";

// /guides: the parents' guide to practice at home, and the way to every other guide.
const hub = guideBySlug("") as Guide;

export const metadata = guideMetadata(hub);

export default function GuidesHub() {
  if (!guideShown(hub)) notFound();
  return <GuideView g={hub} />;
}
