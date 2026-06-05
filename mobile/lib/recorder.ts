/**
 * Audio recorder for the Speechace scoring path. Records a short clip of the
 * child's voice and returns its file URI so cloudScoring can upload it.
 *
 * Uses expo-av's documented Recording flow with the HIGH_QUALITY preset.
 * Verbose console logging (prefixed [REC]) is intentional while we debug the
 * on-device recording path — it surfaces the exact failure point in the Metro
 * terminal. The module is dynamically required so the bundle loads even if the
 * package is missing; callers then fall back to self-rate.
 */

let mod: any = null;
let modTried = false;
function getAv(): any {
  if (modTried) return mod;
  modTried = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require("expo-av");
  } catch (e: any) {
    console.log("[REC] require(expo-av) failed:", e?.message);
    mod = null;
  }
  return mod;
}

export function isRecordingSupported(): boolean {
  const av = getAv();
  return Boolean(av?.Audio?.Recording);
}

/**
 * Put the audio session into loud playback mode: route to the main speaker
 * (not the quiet earpiece) and play even when the phone's ringer is on
 * silent. Call this before TTS so Leo is actually audible. Safe no-op if
 * expo-av isn't present.
 */
export async function configurePlaybackAudio(): Promise<void> {
  const av = getAv();
  if (!av?.Audio?.setAudioModeAsync) return;
  try {
    await av.Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
  } catch (e: any) {
    console.log("[REC] configurePlaybackAudio failed:", e?.message);
  }
}

export type RecorderHandle = {
  /** stop and unload. resolves with the file URI of the captured clip. */
  stop: () => Promise<string | null>;
};

export async function startRecording(opts?: {
  onError?: (err: string) => void;
}): Promise<RecorderHandle | null> {
  const av = getAv();
  console.log(
    "[REC] startRecording — av:",
    !!av,
    "Audio:",
    !!av?.Audio,
    "Recording:",
    !!av?.Audio?.Recording,
  );
  if (!av?.Audio?.Recording) {
    opts?.onError?.("Recorder unavailable (expo-av not loaded).");
    return null;
  }
  const { Audio } = av;

  try {
    const perm = await Audio.requestPermissionsAsync();
    console.log("[REC] permission:", JSON.stringify(perm));
    if (!perm.granted) {
      opts?.onError?.("Microphone permission denied. Enable it in Settings.");
      return null;
    }

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });
    console.log("[REC] audio mode set");

    console.log(
      "[REC] presets available:",
      Object.keys(Audio.RecordingOptionsPresets ?? {}),
    );
    const { recording } = await Audio.Recording.createAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY,
    );
    console.log("[REC] recording created OK");

    return {
      stop: async () => {
        try {
          await recording.stopAndUnloadAsync();
          // Restore loud playback mode so the next prompt is audible.
          try {
            await Audio.setAudioModeAsync({
              allowsRecordingIOS: false,
              playsInSilentModeIOS: true,
              playThroughEarpieceAndroid: false,
            });
          } catch {
            // non-fatal
          }
          const uri = recording.getURI();
          console.log("[REC] stopped, uri:", uri);
          return uri;
        } catch (e: any) {
          console.log("[REC] stop error:", e?.message, e);
          opts?.onError?.(e?.message ?? "Failed to stop recording.");
          return null;
        }
      },
    };
  } catch (e: any) {
    console.log("[REC] start error:", e?.message, e);
    opts?.onError?.(`Record failed: ${e?.message ?? "unknown"}`);
    return null;
  }
}
