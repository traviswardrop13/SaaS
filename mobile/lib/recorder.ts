/**
 * Audio recorder for the Speechace scoring path. Records a short clip of the
 * child's voice and returns its file URI so cloudScoring can upload it.
 *
 * Uses expo-av (stable Recording API). The module is dynamically required so
 * the JS bundle still loads cleanly when the package isn't installed yet —
 * callers get `supported: false` instead of a crash, and fall back to the
 * existing on-device path. After `npx expo install expo-av` and a dev build,
 * everything just works.
 */

type ExpoAvAudio = {
  Audio: {
    requestPermissionsAsync: () => Promise<{ granted: boolean }>;
    setAudioModeAsync: (mode: Record<string, unknown>) => Promise<void>;
    Recording: {
      createAsync: (
        options: unknown,
        onStatus?: (s: unknown) => void,
      ) => Promise<{ recording: AvRecording }>;
    };
    RecordingOptionsPresets: { HIGH_QUALITY: unknown };
    InterruptionModeIOS: { DoNotMix: number };
    InterruptionModeAndroid: { DoNotMix: number };
  };
};

type AvRecording = {
  stopAndUnloadAsync: () => Promise<void>;
  getURI: () => string | null;
};

let mod: ExpoAvAudio | null = null;
let modTried = false;
function getAv(): ExpoAvAudio | null {
  if (modTried) return mod;
  modTried = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require("expo-av") as ExpoAvAudio;
  } catch {
    mod = null;
  }
  return mod;
}

export function isRecordingSupported(): boolean {
  return getAv() != null;
}

export type RecorderHandle = {
  /** stop and unload. resolves with the file URI of the captured clip. */
  stop: () => Promise<string | null>;
};

/**
 * Start recording the mic. Caller is responsible for stopping it.
 *
 * The recording config matches what Speechace expects (mono, 16kHz, 16-bit).
 * Higher bitrates don't improve scoring and just waste upload bandwidth.
 */
export async function startRecording(opts?: {
  onError?: (err: string) => void;
}): Promise<RecorderHandle | null> {
  const av = getAv();
  if (!av) {
    opts?.onError?.("expo-av not installed — dev build required");
    return null;
  }

  try {
    const perm = await av.Audio.requestPermissionsAsync();
    if (!perm.granted) {
      opts?.onError?.("microphone permission denied");
      return null;
    }

    await av.Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      interruptionModeIOS: av.Audio.InterruptionModeIOS.DoNotMix,
      interruptionModeAndroid: av.Audio.InterruptionModeAndroid.DoNotMix,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });

    const options = {
      isMeteringEnabled: false,
      android: {
        extension: ".m4a",
        outputFormat: 2, // MPEG_4
        audioEncoder: 3, // AAC
        sampleRate: 16000,
        numberOfChannels: 1,
        bitRate: 64000,
      },
      ios: {
        extension: ".m4a",
        outputFormat: "aac ",
        audioQuality: 0x60, // MAX
        sampleRate: 16000,
        numberOfChannels: 1,
        bitRate: 64000,
        linearPCMBitDepth: 16,
        linearPCMIsBigEndian: false,
        linearPCMIsFloat: false,
      },
      web: {
        mimeType: "audio/webm",
        bitsPerSecond: 64000,
      },
    };

    const { recording } = await av.Audio.Recording.createAsync(options);

    return {
      stop: async () => {
        try {
          await recording.stopAndUnloadAsync();
          return recording.getURI();
        } catch (e: any) {
          opts?.onError?.(e?.message ?? "stop failed");
          return null;
        }
      },
    };
  } catch (e: any) {
    opts?.onError?.(e?.message ?? "start failed");
    return null;
  }
}
