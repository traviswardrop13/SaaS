"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Legacy entry point — the real onboarding now lives at /welcome and
 * handles both first-time setup and "add another child" against an
 * existing parent. Keep this redirect so old links and the "Add child"
 * button still work.
 */
export default function SetupRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/welcome");
  }, [router]);
  return null;
}
