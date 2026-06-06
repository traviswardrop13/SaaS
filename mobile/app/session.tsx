import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useStore } from "@/lib/store";
import { buildSession, SESSION_WORDS, type SessionLength, type SessionTarget } from "@/lib/session";
import { coachLine } from "@/lib/coach";
import { speak } from "@/lib/speech";
import {
  startRecording,
  isRecordingSupported,
  configurePlaybackAudio,
  type RecorderHandle,
} from "@/lib/recorder";
import { scoreAudio } from "@/lib/cloudScoring";
import { Button, Loading, ProgressBar, Coin } from "@/components/ui";
import LeoImage from "@/components/LeoImage";
import CoachFace from "@/components/CoachFace";
import MouthModel from "@/components/MouthModel";
import Confetti from "@/components/Confetti";
import { MicIcon } from "@/components/icons";
import { hapticSuccess, hapticWarning, hapticLight, hapticCelebrate } from "@/lib/haptics";

type Phase = "intro" | "running" | "done";
// What's happening within a running session — drives the center of the screen.
type Step = "coach" | "say" | "listen" | "score";

const LISTEN_MS = 4200;
const MAX_TRIES = 2;

export default function Session() {
  const router = useRouter();
  const { ready, activeChild, recordLessonComplete, recordSession, subscribed } = useStore();

  const [phase, setPhase] = useState<Phase>("intro");
  const [step, setStep] = useState<Step>("coach");
  const [coachText, setCoachText] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const [target, setTarget] = useState<SessionTarget | null>(null);
  const [idx, setIdx] = useState(0);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({ practiced: 0, great: 0 });
  const [coins, setCoins] = useState(0);
  const [fireKey, setFireKey] = useState(0);

  const aliveRef = useRef(true);
  const startedRef = useRef(false);
  const recorderRef = useRef<RecorderHandle | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const earlyStopRef = useRef<null | (() => void)>(null);

  useEffect(() => {
    configurePlaybackAudio();
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
      recorderRef.current?.stop().catch(() => {});
    };
  }, []);

  if (!ready) return <Loading />;
  if (!activeChild) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white px-6">
        <Text className="text-base text-wolf">No profile yet.</Text>
        <View className="mt-4 w-full max-w-xs">
          <Button label="Back to home" onPress={() => router.replace("/home")} />
        </View>
      </SafeAreaView>
    );
  }
  const child = activeChild;

  // ── primitives the linear session loop awaits ──
  function say(text: string): Promise<void> {
    setCoachText(text);
    setSpeaking(true);
    return new Promise((resolve) => {
      speak(text, {
        onEnd: () => {
          setSpeaking(false);
          resolve();
        },
      });
    });
  }

  async function recordWindow(ms: number): Promise<string | null> {
    if (!isRecordingSupported()) {
      // No recorder (e.g. Expo Go without dev build) — wait a beat, no score.
      await new Promise((r) => setTimeout(r, 1200));
      return null;
    }
    const handle = await startRecording({ onError: () => {} });
    if (!handle) return null;
    recorderRef.current = handle;
    await new Promise<void>((resolve) => {
      earlyStopRef.current = resolve;
      stopTimerRef.current = setTimeout(resolve, ms);
    });
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    earlyStopRef.current = null;
    recorderRef.current = null;
    return await handle.stop();
  }

  function tapDone() {
    if (earlyStopRef.current) {
      hapticLight();
      earlyStopRef.current();
    }
  }

  // ── the session ──
  async function startSession(length: SessionLength) {
    if (startedRef.current) return;
    startedRef.current = true;
    hapticLight();
    const targets = buildSession(child, length);
    if (targets.length === 0) {
      // No plan/content — bounce home gracefully.
      router.replace("/home");
      return;
    }
    setTotal(targets.length);
    setPhase("running");
    const s = { practiced: 0, great: 0 };

    for (let i = 0; i < targets.length && aliveRef.current; i++) {
      const t = targets[i];
      setTarget(t);
      setIdx(i);

      // intro this word
      setStep("coach");
      await say(
        await coachLine({
          childName: child.name,
          targetWord: t.word,
          targetSound: t.targetSound,
          action: "intro",
        }),
      );
      if (!aliveRef.current) return;

      let advanced = false;
      let tries = 0;
      while (!advanced && aliveRef.current) {
        tries += 1;

        // Leo models the word + the mouth shows how
        setStep("say");
        await say(t.word);
        if (!aliveRef.current) return;

        // kid's turn
        setStep("listen");
        const uri = await recordWindow(LISTEN_MS);
        if (!aliveRef.current) return;

        // score
        setStep("score");
        const cloud = uri
          ? await scoreAudio({
              audioUri: uri,
              text: t.word,
              targetSound: t.targetSound,
              userId: child.id,
              mode: t.mode,
            })
          : null;
        if (!aliveRef.current) return;

        const rating = cloud?.ok ? cloud.rating : "tryAgain";
        const great = rating === "great";
        if (great) {
          hapticSuccess();
          s.great += 1;
        } else {
          hapticWarning();
        }

        let action: "praise" | "encourage" | "moveon";
        if (great) {
          action = "praise";
          advanced = true;
        } else if (rating === "tryAgain" && tries < MAX_TRIES) {
          action = "encourage";
        } else {
          action = "moveon";
          advanced = true;
        }

        setStep("coach");
        await say(
          await coachLine({
            childName: child.name,
            targetWord: t.word,
            targetSound: t.targetSound,
            action,
            transcript: cloud?.transcript,
            score: cloud?.score ?? null,
            attempt: tries,
          }),
        );
      }
      s.practiced += 1;
      setStats({ ...s });
    }

    if (!aliveRef.current) return;

    // finish
    setStep("coach");
    setTarget(null);
    await say(
      await coachLine({
        childName: child.name,
        action: "finish",
        sessionStats: s,
      }),
    );

    // reward — sessions count toward the streak + coins like any practice
    const earned = s.practiced * 5 + s.great * 5;
    const score = s.practiced ? Math.round((s.great / s.practiced) * 100) : 0;
    const stars = score >= 80 ? 3 : score >= 50 ? 2 : 1;
    recordLessonComplete(child.id, "live-session", {
      stars,
      score,
      xpEarned: 15,
      coinsEarned: earned,
    });
    recordSession(child.id); // weekly goal + marks the free session used
    setCoins(earned);
    hapticCelebrate();
    setFireKey((k) => k + 1);
    setPhase("done");
  }

  function quit() {
    aliveRef.current = false;
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    recorderRef.current?.stop().catch(() => {});
    router.replace("/home");
  }

  // ─────────────────────────── INTRO ───────────────────────────
  if (phase === "intro") {
    // Free first session, then the paywall.
    const gated = !!child.freeSessionUsed && !subscribed;
    return (
      <SafeAreaView className="flex-1 bg-white" edges={["top", "bottom"]}>
        <View className="flex-row px-4 pt-1">
          <Pressable
            onPress={() => router.replace("/home")}
            className="h-9 w-9 items-center justify-center rounded-full bg-polar"
          >
            <Text className="text-lg font-bold font-heading text-hare">✕</Text>
          </Pressable>
        </View>
        <View className="flex-1 items-center justify-center px-8">
          <LeoImage speaking={false} mood={gated ? "encourage" : "idle"} size={180} />
          <Text className="mt-5 text-center text-3xl font-extrabold font-display text-ink">
            {gated ? "Ready for more?" : "Practice with Leo"}
          </Text>
          <Text className="mt-2 text-center text-base font-bold font-heading text-wolf">
            {gated
              ? `${child.name}'s free session is done! Unlock unlimited sessions to keep going.`
              : "Leo will say a word, you say it back. He listens and helps you — just like a real coach!"}
          </Text>
          <View className="mt-8 w-full max-w-sm gap-3">
            {gated ? (
              <Button
                label="Unlock unlimited sessions"
                onPress={() => {
                  hapticLight();
                  router.push("/paywall");
                }}
              />
            ) : (
              <>
                <Button
                  label={`Quick session · ${SESSION_WORDS.quick} words`}
                  onPress={() => startSession("quick")}
                />
                <Button
                  label={`Full session · ${SESSION_WORDS.full} words`}
                  variant="secondary"
                  onPress={() => startSession("full")}
                />
              </>
            )}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ─────────────────────────── DONE ───────────────────────────
  if (phase === "done") {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white px-6">
        <LeoImage speaking={false} mood="celebrate" size={180} />
        <Text className="mt-5 text-3xl font-extrabold font-display text-feather-edge">
          Session done!
        </Text>
        <Text className="mt-1 text-center text-base text-wolf">
          You practiced {stats.practiced} words, {child.name}! 🎉
        </Text>
        <View className="mt-5 flex-row items-center gap-2 rounded-2xl border-2 border-bee-edge bg-bee-50 px-4 py-2.5">
          <Coin size={20} />
          <Text className="text-sm font-extrabold font-display text-ink">
            +{coins} coins
          </Text>
        </View>
        <View className="mt-7 w-full max-w-sm gap-3">
          <Button label="Done" onPress={() => router.replace("/home")} />
        </View>
        <Confetti fireKey={fireKey} />
      </SafeAreaView>
    );
  }

  // ─────────────────────────── RUNNING ───────────────────────────
  const showMouth = (step === "say" || step === "listen") && target;
  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top", "bottom"]}>
      <View className="flex-row items-center gap-3 px-4 py-3">
        <Pressable
          onPress={quit}
          className="h-9 w-9 items-center justify-center rounded-full bg-polar"
        >
          <Text className="text-lg font-bold font-heading text-hare">✕</Text>
        </Pressable>
        <ProgressBar value={total ? idx / total : 0} />
      </View>

      <View className="flex-1 items-center px-6 pt-2">
        {/* Coach + speech bubble */}
        <CoachFace style={child.coachStyle} speaking={speaking} mood="idle" size={130} />
        {coachText ? (
          <View className="mt-3 max-w-[90%] rounded-3xl border-2 border-swan bg-white px-4 py-3">
            <Text className="text-center text-base font-extrabold font-display text-ink">
              {coachText}
            </Text>
          </View>
        ) : null}

        {/* The word + how-to mouth (during say / listen) */}
        {showMouth ? (
          <View className="mt-4 items-center">
            <Text className="text-3xl font-extrabold font-display text-ink">
              {target!.emoji ? `${target!.emoji}  ` : ""}
              {target!.word}
            </Text>
            <View className="mt-2">
              <MouthModel sound={target!.targetSound} playing size={150} />
            </View>
          </View>
        ) : null}

        {step === "score" ? (
          <Text className="mt-8 text-sm font-extrabold font-display uppercase tracking-widest text-hare">
            Listening…
          </Text>
        ) : null}
      </View>

      {/* Bottom: the kid's mic during their turn */}
      {step === "listen" ? (
        <View className="px-6 pb-8">
          <Pressable onPress={tapDone}>
            <View style={{ backgroundColor: "#1899d6", borderRadius: 20 }}>
              <View
                className="items-center justify-center"
                style={{ backgroundColor: "#1cb0f6", borderRadius: 20, paddingVertical: 18, marginBottom: 5 }}
              >
                <MicIcon size={30} color="#ffffff" />
              </View>
            </View>
          </Pressable>
          <Text className="mt-3 text-center text-sm font-extrabold font-display uppercase tracking-wide text-macaw">
            Your turn — tap when done
          </Text>
        </View>
      ) : (
        <View className="pb-8" />
      )}
    </SafeAreaView>
  );
}
