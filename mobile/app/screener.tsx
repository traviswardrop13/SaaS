import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useStore } from "@/lib/store";
import {
  SCREENER_PROBES,
  evaluateProbe,
  skippedResult,
  buildPlan,
  type ProbeResult,
} from "@/lib/screener";
import {
  DIAGNOSTIC_CHALLENGES,
  diagnosticToFocus,
  findSkill,
} from "@/lib/lessons";
import { speak } from "@/lib/speech";
import {
  startRecording,
  isRecordingSupported,
  configurePlaybackAudio,
  type RecorderHandle,
} from "@/lib/recorder";
import { scoreAudio } from "@/lib/cloudScoring";
import { Button, ProgressBar, Loading } from "@/components/ui";
import LeoImage from "@/components/LeoImage";
import { hapticLight, hapticSuccess, hapticCelebrate } from "@/lib/haptics";

type Phase = "intro" | "probe" | "parent" | "result";

const LISTEN_MS = 3500;

export default function Screener() {
  const router = useRouter();
  const { ready, activeChild, setChildFocus } = useStore();

  const [phase, setPhase] = useState<Phase>("intro");
  const [idx, setIdx] = useState(0);
  const [results, setResults] = useState<ProbeResult[]>([]);
  const [listening, setListening] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [parentSel, setParentSel] = useState<Set<string>>(new Set());

  const recorderRef = useRef<RecorderHandle | null>(null);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const busyRef = useRef(false); // guard against double-running a probe

  const canRecord = isRecordingSupported();
  const probe = SCREENER_PROBES[idx];
  const total = SCREENER_PROBES.length;

  useEffect(() => {
    configurePlaybackAudio();
  }, []);

  // Run the current probe whenever we land on a new one.
  useEffect(() => {
    if (phase !== "probe" || !probe) return;
    runProbe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, idx]);

  // Cleanup on unmount.
  useEffect(
    () => () => {
      if (autoStopRef.current) clearTimeout(autoStopRef.current);
      recorderRef.current?.stop().catch(() => {});
    },
    [],
  );

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

  function startProbes() {
    hapticLight();
    if (canRecord) {
      setPhase("probe");
    } else {
      // No mic (e.g. Expo Go without a dev build) — go straight to the parent
      // checklist so the screener still produces a plan.
      setPhase("parent");
    }
  }

  function runProbe() {
    if (busyRef.current || !probe) return;
    busyRef.current = true;
    // Leo models the word; the moment he finishes, the mic goes live.
    speak(probe.word, {
      onEnd: () => beginListen(),
    });
  }

  async function beginListen() {
    if (!probe) return;
    setListening(true);
    const handle = await startRecording({
      onError: () => {
        // Couldn't record this one — mark unknown and move on.
        setListening(false);
        busyRef.current = false;
        recordResult(skippedResult(probe));
      },
    });
    if (!handle) {
      setListening(false);
      busyRef.current = false;
      recordResult(skippedResult(probe));
      return;
    }
    recorderRef.current = handle;
    if (autoStopRef.current) clearTimeout(autoStopRef.current);
    autoStopRef.current = setTimeout(() => stopAndScore(), LISTEN_MS);
  }

  async function stopAndScore() {
    if (autoStopRef.current) {
      clearTimeout(autoStopRef.current);
      autoStopRef.current = null;
    }
    const handle = recorderRef.current;
    recorderRef.current = null;
    if (!handle || !probe) {
      busyRef.current = false;
      return;
    }
    setListening(false);
    setScoring(true);
    const uri = await handle.stop();
    if (!uri) {
      setScoring(false);
      busyRef.current = false;
      recordResult(skippedResult(probe));
      return;
    }
    const cloud = await scoreAudio({
      audioUri: uri,
      text: probe.word,
      targetSound: probe.targetSound,
      userId: activeChild?.id,
      mode: probe.mode,
    });
    const result = evaluateProbe(probe, cloud);
    setScoring(false);
    // A little reward: solid sound → success buzz, tricky → gentle tap.
    if (!result.unknown && !result.tricky) hapticSuccess();
    else hapticLight();
    busyRef.current = false;
    recordResult(result);
  }

  function recordResult(result: ProbeResult) {
    setResults((prev) => {
      const next = [...prev.filter((r) => r.probeId !== result.probeId), result];
      return next;
    });
    advance();
  }

  function advance() {
    if (idx + 1 >= total) {
      // Pre-select parent checklist items that match what the AI flagged, so
      // the parent confirms/extends rather than starts from scratch.
      setParentSel((prev) => {
        const next = new Set(prev);
        setResults((cur) => {
          const trickyIds = new Set(cur.filter((r) => r.tricky).map((r) => r.skillId));
          for (const ch of DIAGNOSTIC_CHALLENGES) {
            if (ch.focusSkillIds.some((sid) => trickyIds.has(sid))) next.add(ch.id);
          }
          return cur;
        });
        return next;
      });
      setPhase("parent");
    } else {
      setIdx((i) => i + 1);
    }
  }

  function skipProbe() {
    if (!probe) return;
    if (autoStopRef.current) clearTimeout(autoStopRef.current);
    recorderRef.current?.stop().catch(() => {});
    recorderRef.current = null;
    setListening(false);
    setScoring(false);
    busyRef.current = false;
    recordResult(skippedResult(probe));
  }

  function toggleChallenge(id: string) {
    hapticLight();
    setParentSel((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  const plan = buildPlan(results, diagnosticToFocus(Array.from(parentSel)));

  function applyPlan() {
    hapticCelebrate();
    setChildFocus(activeChild!.id, plan);
    router.replace("/home");
  }

  // ─────────────────────────── INTRO ───────────────────────────
  if (phase === "intro") {
    return (
      <SafeAreaView className="flex-1 bg-white" edges={["top", "bottom"]}>
        <Header onClose={() => router.replace("/home")} />
        <View className="flex-1 items-center justify-center px-8">
          <LeoImage speaking={false} mood="idle" size={170} />
          <Text className="mt-5 text-center text-3xl font-extrabold font-display text-ink">
            Let's find {activeChild.name}'s sounds!
          </Text>
          <Text className="mt-3 text-center text-base font-bold font-heading text-wolf">
            {canRecord
              ? `Hand the phone to ${activeChild.name}. Leo will say a word and they just say it back — that's it!`
              : "Tell us which sounds are tricky and Leo will build a plan."}
          </Text>
          <View className="mt-8 w-full max-w-sm">
            <Button
              label={canRecord ? `Start the sound check` : "Choose sounds"}
              onPress={startProbes}
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ─────────────────────────── PROBE ───────────────────────────
  if (phase === "probe" && probe) {
    const status = scoring
      ? "Checking…"
      : listening
        ? "Your turn — say it!"
        : "Listen to Leo…";
    return (
      <SafeAreaView className="flex-1 bg-white" edges={["top", "bottom"]}>
        <View className="flex-row items-center gap-3 px-4 py-3">
          <Pressable
            onPress={() => router.replace("/home")}
            className="h-9 w-9 items-center justify-center rounded-full bg-polar"
          >
            <Text className="text-lg font-bold font-heading text-hare">✕</Text>
          </Pressable>
          <ProgressBar value={(idx) / total} />
          <Text className="text-sm font-extrabold font-display text-hare">
            {idx + 1}/{total}
          </Text>
        </View>

        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-xs font-extrabold font-display uppercase tracking-widest text-hare">
            What is this?
          </Text>
          <View
            className="mt-4 items-center justify-center rounded-5xl bg-polar"
            style={{ width: 230, height: 230 }}
          >
            <Text style={{ fontSize: 130 }}>{probe.emoji}</Text>
          </View>
          <View className="mt-6 flex-row items-center gap-2">
            <LeoImage speaking={listening ? false : true} mood="idle" size={56} />
            <Text
              className="text-lg font-extrabold font-display"
              style={{ color: listening ? "#1899d6" : "#afafaf" }}
            >
              {status}
            </Text>
          </View>
        </View>

        <View className="items-center px-6 pb-4">
          <Pressable onPress={skipProbe} className="px-4 py-2">
            <Text className="text-sm font-bold font-heading text-hare">
              Skip this one ›
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ─────────────────────────── PARENT ───────────────────────────
  if (phase === "parent") {
    return (
      <SafeAreaView className="flex-1 bg-white" edges={["top", "bottom"]}>
        <Header onClose={() => router.replace("/home")} />
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 28 }}>
          <Text className="text-2xl font-extrabold font-display text-ink">
            Anything else, grown-up?
          </Text>
          <Text className="mt-1 text-base font-bold font-heading text-wolf">
            {canRecord
              ? "Tap any sounds you've noticed are tricky — we pre-checked what Leo heard."
              : "Tap any sounds that are tricky for " + activeChild.name + "."}
          </Text>
          <View className="mt-5 gap-3">
            {DIAGNOSTIC_CHALLENGES.map((ch) => {
              const on = parentSel.has(ch.id);
              return (
                <Pressable
                  key={ch.id}
                  onPress={() => toggleChallenge(ch.id)}
                  className={`flex-row items-center gap-3 rounded-4xl border-2 px-4 py-3 ${
                    on ? "border-feather bg-feather-50" : "border-swan bg-white"
                  }`}
                >
                  <Text className="text-2xl">{ch.emoji}</Text>
                  <View className="flex-1">
                    <Text className="text-base font-extrabold font-display text-ink">
                      {ch.label}
                    </Text>
                    <Text className="text-xs font-bold font-heading text-wolf">
                      {ch.example}
                    </Text>
                  </View>
                  <View
                    className={`h-7 w-7 items-center justify-center rounded-full ${
                      on ? "bg-feather" : "bg-swan"
                    }`}
                  >
                    {on ? (
                      <Text className="text-sm font-extrabold text-white">✓</Text>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
        <View className="border-t-2 border-swan px-6 py-4">
          <Button label="See the plan" onPress={() => setPhase("result")} />
        </View>
      </SafeAreaView>
    );
  }

  // ─────────────────────────── RESULT ───────────────────────────
  const planSkills = plan.map((id) => findSkill(id)).filter(Boolean);
  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={{ padding: 24, alignItems: "center" }}>
        <LeoImage speaking={false} mood="holding-star" size={150} />
        <Text className="mt-4 text-center text-3xl font-extrabold font-display text-feather-edge">
          {activeChild.name}'s plan is ready!
        </Text>
        {planSkills.length > 0 ? (
          <>
            <Text className="mt-2 text-center text-base font-bold font-heading text-wolf">
              We'll practice these {planSkills.length} sound
              {planSkills.length > 1 ? "s" : ""} — easiest first.
            </Text>
            <View className="mt-5 w-full gap-3">
              {planSkills.map((s, i) => (
                <View
                  key={s!.id}
                  className="flex-row items-center gap-3 rounded-4xl border-2 border-swan bg-polar px-4 py-3"
                >
                  <View className="h-9 w-9 items-center justify-center rounded-full bg-feather">
                    <Text className="text-sm font-extrabold text-white">
                      {i + 1}
                    </Text>
                  </View>
                  <Text className="text-2xl">{s!.emoji}</Text>
                  <Text className="flex-1 text-base font-extrabold font-display text-ink">
                    {s!.title}
                  </Text>
                </View>
              ))}
            </View>
          </>
        ) : (
          <Text className="mt-3 text-center text-base font-bold font-heading text-wolf">
            Leo didn't hear any tricky sounds — nice! You can practice any sound
            you like.
          </Text>
        )}
      </ScrollView>
      <View className="border-t-2 border-swan px-6 py-4">
        <Button label="Start practicing!" onPress={applyPlan} />
      </View>
    </SafeAreaView>
  );
}

function Header({ onClose }: { onClose: () => void }) {
  return (
    <View className="flex-row items-center justify-between px-4 pb-2 pt-1">
      <Pressable
        onPress={onClose}
        className="h-9 w-9 items-center justify-center rounded-full bg-polar"
      >
        <Text className="text-lg font-bold font-heading text-hare">✕</Text>
      </Pressable>
      <Text className="text-sm font-extrabold font-display uppercase tracking-widest text-hare">
        Sound Check
      </Text>
      <View className="h-9 w-9" />
    </View>
  );
}
