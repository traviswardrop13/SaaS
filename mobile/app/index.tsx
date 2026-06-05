import { useEffect } from "react";
import { useRouter } from "expo-router";
import { View, Text } from "react-native";
import { useStore } from "@/lib/store";
import { Button, Loading } from "@/components/ui";
import TalkingFace from "@/components/TalkingFace";

/**
 * Entry screen. Once the persisted store has loaded, route returning
 * families straight to the home map and new ones to onboarding.
 */
export default function Index() {
  const router = useRouter();
  const { ready, state } = useStore();

  useEffect(() => {
    if (!ready) return;
    if (state.children.length > 0) {
      router.replace("/home");
    }
  }, [ready, state.children.length, router]);

  if (!ready) return <Loading />;

  return (
    <View className="flex-1 items-center justify-center bg-white px-6">
      <TalkingFace speaking={false} size={150} />
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
