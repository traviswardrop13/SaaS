import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useStore } from "@/lib/store";
import { speak } from "@/lib/speech";
import { configurePlaybackAudio } from "@/lib/recorder";
import { talkToLeo, type ChatTurn } from "@/lib/chat";
import { hapticSelect } from "@/lib/haptics";
import TalkingFace from "@/components/TalkingFace";
import type { TargetSound } from "@/lib/scoring";

/**
 * "Talk with Leo" — the AI conversation companion (v1).
 *
 * v1 is text-in / voice-out so it runs in Expo Go today: the child (or parent)
 * types, Leo replies via Claude and SPEAKS it aloud with his mouth moving.
 * v2 swaps the text box for the mic + speech-to-text on a dev build so the
 * child truly talks to him.
 */
export default function Talk() {
  const router = useRouter();
  const { activeChild } = useStore();
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const childCtx = {
    name: activeChild?.name,
    sound: activeChild?.focusAreas?.[0] as TargetSound | undefined,
  };

  function leoSays(text: string) {
    setTurns((t) => [...t, { role: "leo", text }]);
    speak(text, {
      onStart: () => setSpeaking(true),
      onEnd: () => setSpeaking(false),
    });
  }

  async function send(history: ChatTurn[]) {
    setThinking(true);
    const res = await talkToLeo({ history, child: childCtx });
    setThinking(false);
    if (res.ok && res.reply) leoSays(res.reply);
    else
      leoSays(
        "Hmm, I can't hear you right now. Ask a grown-up to check the connection!",
      );
  }

  // Leo greets and starts the conversation on open.
  useEffect(() => {
    configurePlaybackAudio();
    send([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [turns, thinking]);

  function onSend() {
    const text = input.trim();
    if (!text || thinking) return;
    hapticSelect();
    const next: ChatTurn[] = [...turns, { role: "user", text }];
    setTurns(next);
    setInput("");
    send(next);
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center gap-3 border-b-2 border-swan px-4 pb-3 pt-1">
        <Pressable
          onPress={() => router.back()}
          className="h-9 w-9 items-center justify-center rounded-full bg-polar"
        >
          <Text className="text-lg font-bold text-hare">✕</Text>
        </Pressable>
        <TalkingFace speaking={speaking} size={40} />
        <View className="flex-1">
          <Text className="text-lg font-extrabold text-ink">Talk with Leo</Text>
          <Text className="text-xs font-bold text-hare">
            {speaking ? "Leo is talking…" : thinking ? "Leo is thinking…" : "Your turn!"}
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={8}
      >
        <ScrollView
          ref={scrollRef}
          className="flex-1 px-4"
          contentContainerStyle={{ paddingVertical: 16, gap: 10 }}
        >
          {turns.map((t, i) => (
            <View
              key={i}
              className={`max-w-[82%] rounded-3xl px-4 py-3 ${
                t.role === "leo"
                  ? "self-start bg-brand-50"
                  : "self-end bg-macaw-50"
              }`}
            >
              <Text
                className={`text-base font-bold ${
                  t.role === "leo" ? "text-brand-700" : "text-ink"
                }`}
              >
                {t.text}
              </Text>
            </View>
          ))}
          {thinking ? (
            <View className="max-w-[60%] self-start rounded-3xl bg-brand-50 px-4 py-3">
              <Text className="text-base font-bold text-brand-700">…</Text>
            </View>
          ) : null}
        </ScrollView>

        {/* Input (v1: type; v2: mic on a dev build) */}
        <View className="flex-row items-center gap-2 border-t-2 border-swan px-3 py-2">
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Say something to Leo…"
            placeholderTextColor="#afafaf"
            onSubmitEditing={onSend}
            returnKeyType="send"
            className="flex-1 rounded-2xl border-2 border-swan bg-white px-4 py-3 text-base font-bold text-ink"
          />
          <Pressable
            onPress={onSend}
            disabled={!input.trim() || thinking}
            style={{ opacity: !input.trim() || thinking ? 0.5 : 1 }}
            className="h-12 w-12 items-center justify-center rounded-full"
          >
            <View
              className="h-12 w-12 items-center justify-center rounded-full"
              style={{ backgroundColor: "#58cc02" }}
            >
              <Text className="text-xl text-white">↑</Text>
            </View>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
