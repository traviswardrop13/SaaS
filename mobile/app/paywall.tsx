import { useState } from "react";
import { View, Text, Pressable, ScrollView, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useStore } from "@/lib/store";
import { Button, Loading } from "@/components/ui";
import LeoImage from "@/components/LeoImage";
import { hapticLight, hapticCelebrate } from "@/lib/haptics";

/**
 * Subscription paywall — shown after the free session. The UI + flow are real;
 * the actual purchase is a stub (sets a local `subscribed` flag) until App
 * Store in-app purchase is wired via RevenueCat (needs an Apple Developer
 * account). That swap is isolated to the `subscribe()` handler below.
 */
type Plan = "annual" | "monthly";

const PRICES: Record<Plan, { label: string; price: string; sub: string; badge?: string }> = {
  annual: { label: "Yearly", price: "$199.99 / year", sub: "$16.67/mo · best value", badge: "Save 45%" },
  monthly: { label: "Monthly", price: "$29.99 / month", sub: "billed monthly" },
};

const FEATURES = [
  "Unlimited coaching sessions with your AI coach",
  "A personalized plan from the sound check",
  "Real-time feedback on every sound",
  "Progress tracking for parents",
  "Designed with a licensed speech-language pathologist",
];

export default function Paywall() {
  const router = useRouter();
  const { ready, setSubscribed } = useStore();
  const [plan, setPlan] = useState<Plan>("annual");
  const [busy, setBusy] = useState(false);

  if (!ready) return <Loading />;

  function subscribe() {
    // TODO(IAP): replace with RevenueCat purchase flow once the Apple
    // Developer account + products are set up. For now, unlock locally so the
    // flow is testable end-to-end.
    setBusy(true);
    hapticCelebrate();
    setSubscribed(true);
    setTimeout(() => {
      setBusy(false);
      router.replace("/session");
    }, 300);
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top", "bottom"]}>
      <View className="flex-row px-4 pt-1">
        <Pressable
          onPress={() => router.back()}
          className="h-9 w-9 items-center justify-center rounded-full bg-polar"
        >
          <Text className="text-lg font-bold font-heading text-hare">✕</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 16 }}>
        <View className="items-center">
          <LeoImage speaking={false} mood="celebrate" size={130} />
          <Text className="mt-3 text-center text-3xl font-extrabold font-display text-ink">
            Keep the momentum going
          </Text>
          <Text className="mt-2 text-center text-base font-bold font-heading text-wolf">
            A personal speech coach, ready whenever your child is.
          </Text>
        </View>

        {/* Features */}
        <View className="mt-6 gap-2.5">
          {FEATURES.map((f) => (
            <View key={f} className="flex-row items-center gap-3">
              <View className="h-7 w-7 items-center justify-center rounded-full bg-feather">
                <Text className="text-sm font-extrabold text-white">✓</Text>
              </View>
              <Text className="flex-1 text-sm font-bold font-heading text-ink">{f}</Text>
            </View>
          ))}
        </View>

        {/* Plans */}
        <View className="mt-6 gap-3">
          {(["annual", "monthly"] as Plan[]).map((p) => {
            const on = plan === p;
            const info = PRICES[p];
            return (
              <Pressable
                key={p}
                onPress={() => {
                  hapticLight();
                  setPlan(p);
                }}
                className={`flex-row items-center gap-3 rounded-4xl border-2 px-4 py-3.5 ${
                  on ? "border-feather bg-feather-50" : "border-swan bg-white"
                }`}
              >
                <View
                  className={`h-6 w-6 items-center justify-center rounded-full border-2 ${
                    on ? "border-feather bg-feather" : "border-swan bg-white"
                  }`}
                >
                  {on ? <Text className="text-xs font-extrabold text-white">✓</Text> : null}
                </View>
                <View className="flex-1">
                  <View className="flex-row items-center gap-2">
                    <Text className="text-base font-extrabold font-display text-ink">
                      {info.label}
                    </Text>
                    {info.badge ? (
                      <Text className="rounded-full bg-bee px-2 py-0.5 text-[10px] font-extrabold font-display uppercase tracking-wide text-white">
                        {info.badge}
                      </Text>
                    ) : null}
                  </View>
                  <Text className="text-xs font-bold font-heading text-wolf">{info.sub}</Text>
                </View>
                <Text className="text-sm font-extrabold font-display text-ink">{info.price}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View className="border-t-2 border-swan px-6 py-4">
        <Button
          label={busy ? "…" : "Start"}
          disabled={busy}
          onPress={subscribe}
        />
        <View className="mt-3 flex-row items-center justify-center gap-4">
          <Pressable onPress={() => Alert.alert("Restore", "Purchases will restore here once billing is live.")}>
            <Text className="text-xs font-bold font-heading text-hare">Restore</Text>
          </Pressable>
          <Text className="text-hare">·</Text>
          <Pressable onPress={() => router.back()}>
            <Text className="text-xs font-bold font-heading text-hare">Not now</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
