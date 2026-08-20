import { useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Dimensions,
  Image,
  NativeSyntheticEvent,
  NativeScrollEvent,
  ImageSourcePropType,
} from "react-native";
import { useRouter } from "expo-router";
import { useStore } from "@/lib/store";
import { Loading, Button } from "@/components/ui";
import { hapticLight } from "@/lib/haptics";
import { GAMES, todaysGames, type Game } from "@/lib/gameMap";

const { width: SCREEN_W } = Dimensions.get("window");

// ── Scene image lookup (require() must be static in RN) ──
const SCENE_IMAGES: Record<string, ImageSourcePropType> = {
  "todays-practice": require("@/assets/scenes/todays-practice.png"),
  "speech-clinic": require("@/assets/scenes/speech-clinic.png"),
  racing: require("@/assets/scenes/racing.png"),
  storybook: require("@/assets/scenes/storybook.png"),
  "fruit-ninja": require("@/assets/scenes/fruit-ninja.png"),
  stacks: require("@/assets/scenes/stacks.png"),
};

/**
 * Home — Duolingo ABC–style horizontal scrolling game map.
 *
 * Page 0 = Today's Practice (daily rotating challenge)
 * Pages 1–5 = Individual game screens
 *
 * Each page is a full-bleed illustrated scene. Tap the house to play.
 * No top bar, no info cards — just the scene + a small floating label.
 */
export default function Home() {
  const router = useRouter();
  const { ready, activeChild } = useStore();
  const scrollRef = useRef<ScrollView>(null);
  const [activePage, setActivePage] = useState(0);

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const page = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
      setActivePage(page);
    },
    [],
  );

  if (!ready) return <Loading />;
  if (!activeChild) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-6">
        <Text className="text-center text-lg text-wolf">No profile yet.</Text>
        <View className="mt-4 w-full max-w-xs">
          <Button label="Set up" onPress={() => router.replace("/welcome")} />
        </View>
      </View>
    );
  }

  const dailyGames = todaysGames();

  // Build the full page list: Today's Practice + individual games
  type PageData =
    | { kind: "today"; games: Game[] }
    | { kind: "game"; game: Game };

  const pages: PageData[] = [
    { kind: "today", games: dailyGames },
    ...GAMES.map((g) => ({ kind: "game" as const, game: g })),
  ];

  return (
    <View className="flex-1 bg-black">
      {/* ── Horizontal scrolling game map ── */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        className="flex-1"
      >
        {pages.map((page, i) => (
          <Pressable
            key={i}
            style={{ width: SCREEN_W, flex: 1 }}
            onPress={() => {
              hapticLight();
              if (page.kind === "today") {
                router.push("/session");
              } else {
                router.push(page.game.route as any);
              }
            }}
          >
            {/* Scene background — full bleed, tappable */}
            <Image
              source={
                page.kind === "today"
                  ? SCENE_IMAGES["todays-practice"]
                  : SCENE_IMAGES[page.game.id]
              }
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: SCREEN_W,
                height: "100%",
              }}
              resizeMode="cover"
            />

            {/* Floating game label near the bottom */}
            <View className="flex-1 justify-end pb-16">
              <View className="items-center px-6">
                <Text
                  className="text-center text-2xl font-extrabold font-display text-white"
                  style={{
                    textShadowColor: "rgba(0,0,0,0.5)",
                    textShadowOffset: { width: 0, height: 2 },
                    textShadowRadius: 8,
                  }}
                >
                  {page.kind === "today"
                    ? "Today's Practice"
                    : `${page.game.emoji} ${page.game.title}`}
                </Text>
                <Text
                  className="mt-1 text-center text-sm font-soft text-white/90"
                  style={{
                    textShadowColor: "rgba(0,0,0,0.4)",
                    textShadowOffset: { width: 0, height: 1 },
                    textShadowRadius: 6,
                  }}
                >
                  {page.kind === "today"
                    ? `${page.games.length} games · tap to play!`
                    : page.game.subtitle}
                </Text>
              </View>
            </View>
          </Pressable>
        ))}
      </ScrollView>

      {/* ── Page dots ── */}
      <View
        className="flex-row items-center justify-center gap-2 pb-6 pt-2"
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
        }}
      >
        {pages.map((_, i) => (
          <Pressable
            key={i}
            onPress={() => {
              scrollRef.current?.scrollTo({
                x: i * SCREEN_W,
                animated: true,
              });
            }}
          >
            <View
              style={{
                width: i === activePage ? 24 : 8,
                height: 8,
                borderRadius: 4,
                backgroundColor:
                  i === activePage ? "#ffffff" : "rgba(255,255,255,0.4)",
              }}
            />
          </Pressable>
        ))}
      </View>
    </View>
  );
}
