/**
 * Audio recorder for the Speechace scoring path. Records a short clip of the
 * child's voice and returns its file URI so cloudScoring can upload it.
 *
 * Uses expo-av's documented Recording flow with the HIGH_QUALITY preset —
 * deliberately the simplest, most-compatible configuration (custom encoder
 * settings were rejected by the native module on device). The module is
 * dynamically required so the JS bundle still loads even if the package
 * isn't installed; callers get `supported: false` and fall back to self-rate.
 */

let mod: any = null;
let modTried = false;
function getAv(): any {
  if (modTried) return mod;
  modTried = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require("expo-av");
  } catch {
    mod = null;
  }
  return mod;
}

export function isRecordingSupported(): boolean {
  const av = getAv();
  return Boolean(av?.Audio?.Recording);
}

export type RecorderHandle = {
  /** stop and unload. resolves with the file URI of the captured clip. */
  stop: () => Promise<string | null>;
};

export async function startRecording(opts?: {
  onError?: (err: string) => void;
}): Promise<RecorderHandle | null> {
  const av = getAv();
  if (!av?.Audio?.Recording) {
    opts?.onError?.("Recorder unavailable (expo-av not loaded).");
    return null;
  }
  const { Audio } = av;

  try {
    const perm = await Audio.requestPermissionsAsync();
    if (!perm.granted) {
      opts?.onError?.("Microphone permission denied. Enable it in Settings.");
      return null;
    }

    // Minimal, well-supported audio mode: just allow recording on iOS and
    // play in silent mode. Anything fancier (interruption modes) is what was
    // throwing before.
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });

    const { recording } = await Audio.Recording.createAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY,
    );

    return {
      stop: async () => {
        try {
          await recording.stopAndUnloadAsync();
          // Restore normal playback audio mode after recording.
          try {
            await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
          } catch {
            // non-fatal
          }
          return recording.getURI();
        } catch (e: any) {
          opts?.onError?.(e?.message ?? "Failed to stop recording.");
          return null;
        }
      },
    };
  } catch (e: any) {
    opts?.onError?.(e?.message ?? "Failed to start recording.");
    return null;
  }
}
