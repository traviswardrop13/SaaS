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
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useStore, weeklySessionCount, weeklyGoal } from "@/lib/store";
import { Loading, Button } from "@/components/ui";
import { hapticLight } from "@/lib/haptics";
import { GAMES, todaysGames, todayLabel, type Game } from "@/lib/gameMap";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

// ── Scene image lookup (require() must be static in RN) ──
const SCENE_IMAGES: Record<string, ImageSourcePropType> = {
  "todays-practice": require("@/assets/scenes/todays-practice.png"),
  "speech-clinic": require("@/assets/scenes/speech-clinic.png"),
  racing: require("@/assets/scenes/racing.png"),
  storybook: require("@/assets/scenes/storybook.png"),
  "fruit-ninja": require("@/assets/scenes/fruit-ninja.png"),
  stacks: require("@/assets/scenes/stacks.png"),
};

// ── Sky colors per scene (status bar / top gradient) ──
const SKY_COLORS: Record<string, string> = {
  "todays-practice": "#4A9FDF",
  "speech-clinic": "#7EC8E3",
  racing: "#F4845F",
  storybook: "#9B72CF",
  "fruit-ninja": "#B8E550",
  stacks: "#5CE1E6",
};

/**
 * Home — Duolingo ABC–style horizontal scrolling game map.
 *
 * Page 0 = Today's Practice (daily rotating challenge)
 * Pages 1–5 = Individual game screens
 *
 * Each page is a full-width illustrated scene background with a floating
 * title card and play button. Swipe to browse games.
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
      <SafeAreaView className="flex-1 items-center justify-center bg-white px-6">
        <Text className="text-center text-lg text-wolf">No profile yet.</Text>
        <View className="mt-4 w-full max-w-xs">
          <Button label="Set up" onPress={() => router.replace("/welcome")} />
        </View>
      </SafeAreaView>
    );
  }

  const child = activeChild;
  const done = weeklySessionCount(child);
  const goal = weeklyGoal(child);
  const dailyGames = todaysGames();

  // Build the full page list: Today's Practice + individual games
  type PageData =
    | { kind: "today"; games: Game[] }
    | { kind: "game"; game: Game };

  const pages: PageData[] = [
    { kind: "today", games: dailyGames },
    ...GAMES.map((g) => ({ kind: "game" as const, game: g })),
  ];

  // Current sky color for the status bar area
  const currentSkyColor =
    activePage === 0
      ? SKY_COLORS["todays-practice"]
      : SKY_COLORS[GAMES[activePage - 1]?.id] ?? "#7EC8E3";

  return (
    <View className="flex-1" style={{ backgroundColor: currentSkyColor }}>
      <SafeAreaView className="flex-1" edges={["top"]}>
        {/* ── Top bar ── */}
        <View
          className="flex-row items-center justify-between px-4 pb-2 pt-1"
          style={{ backgroundColor: currentSkyColor }}
        >
          <Pressable
            onPress={() => {
              hapticLight();
              router.push("/parent");
            }}
            className="h-11 w-11 items-center justify-center rounded-2xl"
            style={{ backgroundColor: "rgba(255,255,255,0.3)" }}
          >
            <Text className="text-2xl">{child.avatar || "🌟"}</Text>
          </Pressable>
          <View
            className="flex-row items-center gap-1 rounded-xl px-3 py-1.5"
            style={{ backgroundColor: "rgba(255,255,255,0.3)" }}
          >
            <Text className="text-base">📅</Text>
            <Text className="text-base font-extrabold font-display text-white">
              {done}/{goal} this week
            </Text>
          </View>
        </View>

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
            <View key={i} style={{ width: SCREEN_W, flex: 1 }}>
              {page.kind === "today" ? (
                <TodayPage
                  games={page.games}
                  childName={child.name}
                  onPlay={() => {
                    hapticLight();
                    router.push("/session");
                  }}
                />
              ) : (
                <GamePage
                  game={page.game}
                  onPlay={() => {
                    hapticLight();
                    router.push(page.game.route as any);
                  }}
                />
              )}
            </View>
          ))}
        </ScrollView>

        {/* ── Page dots ── */}
        <View
          className="flex-row items-center justify-center gap-2 pb-4 pt-2"
          style={{ backgroundColor: "#2a2a2a" }}
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
                    i === activePage
                      ? "#ffffff"
                      : "rgba(255,255,255,0.4)",
                }}
              />
            </Pressable>
          ))}
        </View>
      </SafeAreaView>
    </View>
  );
}

// ── Today's Practice page ──
function TodayPage({
  games,
  childName,
  onPlay,
}: {
  games: Game[];
  childName: string;
  onPlay: () => void;
}) {
  return (
    <View className="flex-1">
      {/* Scene background */}
      <Image
        source={SCENE_IMAGES["todays-practice"]}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: SCREEN_W,
          height: "100%",
        }}
        resizeMode="cover"
      />

      {/* Content overlay */}
      <View className="flex-1 justify-end">
        {/* Info card at the bottom */}
        <View
          className="mx-4 mb-4 overflow-hidden rounded-4xl"
          style={{ backgroundColor: "rgba(0,0,0,0.65)" }}
        >
          <View className="px-5 pb-5 pt-4">
            <Text className="text-xs font-extrabold font-display uppercase tracking-widest text-white/70">
              {todayLabel()}&apos;s Challenge
            </Text>
            <Text className="mt-1 text-2xl font-extrabold font-display text-white">
              Today&apos;s Practice
            </Text>
            <Text className="mt-1 text-sm font-soft text-white/80">
              {games.length} games picked for {childName} today
            </Text>

            {/* Game pills */}
            <View className="mt-3 flex-row flex-wrap gap-2">
              {games.map((g) => (
                <View
                  key={g.id}
                  className="flex-row items-center gap-1.5 rounded-full px-3 py-1.5"
                  style={{ backgroundColor: "rgba(255,255,255,0.15)" }}
                >
                  <Text className="text-sm">{g.emoji}</Text>
                  <Text className="text-xs font-bold font-heading text-white">
                    {g.title}
                  </Text>
                </View>
              ))}
            </View>

            {/* Play button */}
            <Pressable onPress={onPlay} className="mt-4">
              {({ pressed }) => (
                <View
                  style={{
                    backgroundColor: "#58a700",
                    borderRadius: 22,
                  }}
                >
                  <View
                    className="w-full items-center"
                    style={{
                      backgroundColor: "#58cc02",
                      borderRadius: 22,
                      paddingVertical: 16,
                      transform: [{ translateY: pressed ? 4 : 0 }],
                      marginBottom: pressed ? 0 : 4,
                    }}
                  >
                    <Text className="text-lg font-extrabold font-display text-white">
                      ▶ Start Challenge
                    </Text>
                  </View>
                </View>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

// ── Individual game page ──
function GamePage({
  game,
  onPlay,
}: {
  game: Game;
  onPlay: () => void;
}) {
  return (
    <View className="flex-1">
      {/* Scene background */}
      <Image
        source={SCENE_IMAGES[game.id]}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: SCREEN_W,
          height: "100%",
        }}
        resizeMode="cover"
      />

      {/* Content overlay */}
      <View className="flex-1 justify-end">
        <View
          className="mx-4 mb-4 overflow-hidden rounded-4xl"
          style={{ backgroundColor: "rgba(0,0,0,0.65)" }}
        >
          <View className="px-5 pb-5 pt-4">
            <View className="flex-row items-center gap-2">
              <Text className="text-3xl">{game.emoji}</Text>
              <View>
                <Text className="text-2xl font-extrabold font-display text-white">
                  {game.title}
                </Text>
                <Text className="text-sm font-soft text-white/80">
                  {game.subtitle}
                </Text>
              </View>
            </View>

            {/* Play button */}
            <Pressable onPress={onPlay} className="mt-4">
              {({ pressed }) => (
                <View
                  style={{
                    backgroundColor: "#1899d6",
                    borderRadius: 22,
                  }}
                >
                  <View
                    className="w-full items-center"
                    style={{
                      backgroundColor: "#1cb0f6",
                      borderRadius: 22,
                      paddingVertical: 16,
                      transform: [{ translateY: pressed ? 4 : 0 }],
                      marginBottom: pressed ? 0 : 4,
                    }}
                  >
                    <Text className="text-lg font-extrabold font-display text-white">
                      ▶ Play
                    </Text>
                  </View>
                </View>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}
