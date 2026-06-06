import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useStore } from "@/lib/store";
import { WORLD_ITEMS, type WorldItem } from "@/lib/world";
import { Loading } from "@/components/ui";
import { hapticNope, hapticUnlock, hapticLight } from "@/lib/haptics";
import { leoWelcomeWorld, leoPurchaseCheer } from "@/lib/leo";
import LeoImage from "@/components/LeoImage";
import Confetti from "@/components/Confetti";

const SCENE_H = 460;

export default function World() {
  const router = useRouter();
  const { ready, activeChild, purchaseItem } = useStore();
  const [fireKey, setFireKey] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // First time this child arrives in Leo's World, Leo explains it out loud.
  useEffect(() => {
    if (ready && activeChild) leoWelcomeWorld(activeChild.id);
  }, [ready, activeChild?.id]);

  if (!ready) return <Loading />;
  if (!activeChild) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white">
        <Text className="text-wolf">No profile yet.</Text>
      </SafeAreaView>
    );
  }

  const coins = activeChild.coins ?? 0;
  const owned = new Set(activeChild.world ?? []);

  function flashToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1600);
  }

  function tryBuy(item: WorldItem) {
    if (owned.has(item.id)) {
      hapticLight();
      return;
    }
    if (coins < item.cost) {
      hapticNope();
      flashToast(`${item.cost - coins} more coins for the ${item.name}!`);
      return;
    }
    const ok = purchaseItem(activeChild!.id, item.id, item.cost);
    if (ok) {
      hapticUnlock();
      setFireKey((k) => k + 1);
      flashToast(`You got the ${item.name}! 🎉`);
      leoPurchaseCheer(item.name);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center justify-between border-b-2 border-swan px-4 pb-3 pt-1">
        <Pressable
          onPress={() => router.back()}
          className="h-9 w-9 items-center justify-center rounded-full bg-polar"
        >
          <Text className="text-lg font-bold text-hare">✕</Text>
        </Pressable>
        <Text className="text-lg font-extrabold text-ink">Leo's World</Text>
        <View className="flex-row items-center gap-1 rounded-xl border-2 border-swan bg-white px-2.5 py-1">
          <Text className="text-base">🪙</Text>
          <Text className="text-base font-extrabold text-bee-edge">{coins}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
        {/* The scene */}
        <View
          className="mx-3 mt-3 overflow-hidden rounded-3xl"
          style={{ height: SCENE_H, backgroundColor: "#bfe9ff" }}
        >
          {/* sun */}
          <Text style={{ position: "absolute", left: 16, top: 14, fontSize: 46 }}>
            ☀️
          </Text>
          {/* ground */}
          <View
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              height: SCENE_H * 0.3,
              backgroundColor: "#9be15d",
            }}
          />

          {/* placed + buyable items */}
          {WORLD_ITEMS.map((item) => {
            const has = owned.has(item.id);
            const affordable = coins >= item.cost;
            return (
              <Pressable
                key={item.id}
                onPress={() => tryBuy(item)}
                style={{
                  position: "absolute",
                  left: `${item.leftPct}%`,
                  top: `${item.topPct}%`,
                  width: item.size,
                  alignItems: "center",
                  transform: [
                    { translateX: -item.size / 2 },
                    { translateY: -item.size / 2 },
                  ],
                }}
              >
                <Text style={{ fontSize: item.size * 0.7, opacity: has ? 1 : 0.28 }}>
                  {item.emoji}
                </Text>
                {!has ? (
                  <View
                    className="mt-0.5 flex-row items-center gap-0.5 rounded-full px-2 py-0.5"
                    style={{ backgroundColor: affordable ? "#fff" : "#f1f1f1" }}
                  >
                    <Text style={{ fontSize: 11 }}>🪙</Text>
                    <Text
                      className="text-[11px] font-extrabold"
                      style={{ color: affordable ? "#e0a800" : "#afafaf" }}
                    >
                      {item.cost}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}

          {/* Leo greeting in his world */}
          <View
            style={{
              position: "absolute",
              left: "50%",
              bottom: 8,
              transform: [{ translateX: -60 }],
              alignItems: "center",
            }}
          >
            <LeoImage speaking={false} mood="idle" size={120} />
          </View>

          {/* celebration burst */}
          <Confetti fireKey={fireKey} />

          {/* toast */}
          {toast ? (
            <View
              className="absolute left-0 right-0 items-center"
              style={{ top: 16 }}
            >
              <View className="rounded-full bg-ink px-4 py-2">
                <Text className="text-sm font-extrabold text-white">{toast}</Text>
              </View>
            </View>
          ) : null}
        </View>

        <Text className="mt-4 px-5 text-center text-sm font-bold text-wolf">
          Tap a faded item to add it with coins. Earn coins by practicing! 🪙
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
