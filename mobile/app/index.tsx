import { useEffect } from "react";
import { useRouter } from "expo-router";
import { View, Text } from "react-native";
import { useStore } from "@/lib/store";
import { Button, Loading } from "@/components/ui";
import LeoImage from "@/components/LeoImage";

/**
 * Entry screen. Once the persisted store has loaded, route returning
 * families straight to the home map and new ones to onboarding.
 */
export default function Index() {
  const router = useRouter();
  const { ready, state, setActiveChild } = useStore();

  useEffect(() => {
    if (!ready) return;
    if (state.children.length > 0) {
      // Make sure a valid child is selected before landing on the map — a
      // returning user whose activeChildId is missing or stale (e.g. points
      // at a removed profile) would otherwise hit the empty "No profile" state.
      const validActive = state.children.some((c) => c.id === state.activeChildId);
      if (!validActive) setActiveChild(state.children[0].id);
      router.replace("/home");
    }
  }, [ready, state.children, state.activeChildId, setActiveChild, router]);

  if (!ready) return <Loading />;

  return (
    <View className="flex-1 items-center justify-center bg-white px-6">
      <LeoImage speaking={false} mood="idle" size={170} />
      <Text className="mt-4 text-5xl font-extrabold text-brand-600">Sona</Text>
      <Text className="mt-3 max-w-xs text-center text-base text-gray-600">
        A friendly, game-style way for kids to practice tricky speech sounds.
      </Text>
      <View className="mt-10 w-full max-w-sm">
        <Button label="Get started" onPress={() => router.push("/welcome")} />
      </View>
    </View>
  );
}
