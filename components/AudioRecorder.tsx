"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Self-contained recorder using the browser MediaRecorder API. Captures
 * audio into a webm blob, exposes playback, and gives the parent a download
 * button to save the file. Designed for the admin "label these clips" flow,
 * not for kid-facing UI.
 */
export default function AudioRecorder({
  filename,
  onSaved,
}: {
  filename: string;
  /** Called once the recording is committed (saved to local store / downloaded). */
  onSaved?: (blob: Blob, filename: string) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startedAtRef = useRef<number>(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      // Clean up object URLs on unmount.
      if (url) URL.revokeObjectURL(url);
      if (tickRef.current) clearInterval(tickRef.current);
      recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function start() {
    setError(null);
    setBlob(null);
    if (url) {
      URL.revokeObjectURL(url);
      setUrl(null);
    }
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream, { mimeType: "audio/webm" });
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const b = new Blob(chunksRef.current, { type: "audio/webm" });
        setBlob(b);
        setUrl(URL.createObjectURL(b));
        stream.getTracks().forEach((t) => t.stop());
      };
      rec.start();
      recorderRef.current = rec;
      startedAtRef.current = Date.now();
      setElapsed(0);
      tickRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startedAtRef.current) / 100) / 10);
      }, 100);
      setRecording(true);
    } catch (e: unknown) {
      setError(
        e instanceof Error
          ? e.message
          : "Couldn't access the microphone — check browser permissions.",
      );
    }
  }

  function stop() {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }

  function discard() {
    if (url) URL.revokeObjectURL(url);
    setBlob(null);
    setUrl(null);
    setElapsed(0);
  }

  function downloadAndSave() {
    if (!blob) return;
    const a = document.createElement("a");
    const dlUrl = URL.createObjectURL(blob);
    a.href = dlUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(dlUrl);
    onSaved?.(blob, filename);
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        {!recording && !blob && (
          <button
            type="button"
            onClick={start}
            className="rounded-xl bg-brand-500 px-4 py-2 font-bold text-white shadow-chunky-sm hover:bg-brand-600"
          >
            🎤 Record
          </button>
        )}
        {recording && (
          <button
            type="button"
            onClick={stop}
            className="rounded-xl bg-red-500 px-4 py-2 font-bold text-white shadow-chunky-sm hover:bg-red-600"
          >
            ⏹ Stop ({elapsed.toFixed(1)}s)
          </button>
        )}
        {blob && url && (
          <>
            <audio src={url} controls className="h-9" />
            <button
              type="button"
              onClick={start}
              className="rounded-xl bg-gray-100 px-4 py-2 font-bold text-gray-700 hover:bg-gray-200"
            >
              Re-record
            </button>
            <button
              type="button"
              onClick={downloadAndSave}
              className="rounded-xl bg-grass-500 px-4 py-2 font-bold text-white shadow-chunky-sm hover:bg-grass-600"
            >
              ⬇︎ Save
            </button>
            <button
              type="button"
              onClick={discard}
              className="rounded-xl bg-transparent px-2 py-2 text-sm text-gray-400 hover:text-gray-700"
            >
              Discard
            </button>
          </>
        )}
      </div>
      <div className="mt-2 truncate font-mono text-xs text-gray-400">
        {filename}
      </div>
      {error && (
        <div className="mt-2 rounded-lg bg-red-50 p-2 text-sm text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}
