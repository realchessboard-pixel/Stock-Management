"use client";

import { useEffect, useRef, useState } from "react";
import { CameraOff, Flashlight, FlashlightOff, RefreshCw } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

type Status = "starting" | "scanning" | "error";

const FORMATS = ["code_128", "ean_13", "ean_8", "upc_a", "upc_e", "code_39", "code_93", "itf", "qr_code"];

type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> };
type DetectorCtor = {
  new (opts: { formats: string[] }): Detector;
  getSupportedFormats?: () => Promise<string[]>;
};

function cameraErrorMessage(e: unknown): string {
  const name = (e as { name?: string })?.name;
  if (typeof window !== "undefined" && !window.isSecureContext) return "Camera needs a secure (https) connection. You can type the code below.";
  if (name === "NotAllowedError" || name === "SecurityError") return "Camera permission was blocked. Allow camera access in your browser settings, or type the code below.";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "No camera found on this device. Type the code below or use a barcode scanner.";
  if (name === "NotReadableError") return "The camera is being used by another app. Close it and try again.";
  return "Couldn't start the camera. Type the code below instead.";
}

/**
 * Camera barcode scanner.
 * 1. Native BarcodeDetector (fast, Android Chrome) when it supports Code 128.
 * 2. Otherwise ZXing (pure JS, works on iOS Safari / desktop), loaded on demand.
 * Calls onDetected once per distinct code; the parent decides when to resume.
 */
export function BarcodeScanner({ onDetected, paused = false }: { onDetected: (code: string) => void; paused?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<Status>("starting");
  const [error, setError] = useState<string | null>(null);
  const [torch, setTorch] = useState<{ supported: boolean; on: boolean }>({ supported: false, on: false });
  const [attempt, setAttempt] = useState(0);
  const pausedRef = useRef(paused);
  const lastRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });
  const cbRef = useRef(onDetected);
  const trackRef = useRef<MediaStreamTrack | null>(null);

  useEffect(() => {
    pausedRef.current = paused;
    if (!paused) lastRef.current = { code: "", at: 0 };
  }, [paused]);
  useEffect(() => {
    cbRef.current = onDetected;
  }, [onDetected]);

  useEffect(() => {
    let cancelled = false;
    let stopFn: (() => void) | null = null;

    const emit = (raw: string) => {
      const code = raw.trim();
      if (!code || pausedRef.current) return;
      const now = Date.now();
      if (code === lastRef.current.code && now - lastRef.current.at < 2500) return;
      lastRef.current = { code, at: now };
      cbRef.current(code);
    };

    const constraints: MediaStreamConstraints = {
      audio: false,
      video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
    };

    async function start() {
      const video = videoRef.current;
      if (!video) return;
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error("no media"), { name: "NotFoundError" });
        const Native = (window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
        const supported = Native?.getSupportedFormats ? await Native.getSupportedFormats().catch(() => []) : [];

        if (Native && supported.includes("code_128")) {
          const stream = await navigator.mediaDevices.getUserMedia(constraints);
          if (cancelled) return stream.getTracks().forEach((t) => t.stop());
          video.srcObject = stream;
          await video.play();
          trackRef.current = stream.getVideoTracks()[0] ?? null;
          const detector = new Native({ formats: FORMATS.filter((f) => supported.includes(f)) });
          let raf = 0;
          let busy = false;
          const loop = async () => {
            if (cancelled) return;
            if (!busy && !pausedRef.current && video.readyState >= 2) {
              busy = true;
              try {
                const found = await detector.detect(video);
                if (found[0]?.rawValue) emit(found[0].rawValue);
              } catch {}
              busy = false;
            }
            raf = window.setTimeout(loop, 120) as unknown as number;
          };
          loop();
          stopFn = () => {
            clearTimeout(raf);
            stream.getTracks().forEach((t) => t.stop());
          };
        } else {
          const [{ BrowserMultiFormatReader }, { DecodeHintType, BarcodeFormat }] = await Promise.all([
            import("@zxing/browser"),
            import("@zxing/library"),
          ]);
          if (cancelled) return;
          const hints = new Map();
          hints.set(DecodeHintType.POSSIBLE_FORMATS, [
            BarcodeFormat.CODE_128,
            BarcodeFormat.EAN_13,
            BarcodeFormat.EAN_8,
            BarcodeFormat.UPC_A,
            BarcodeFormat.UPC_E,
            BarcodeFormat.CODE_39,
            BarcodeFormat.ITF,
            BarcodeFormat.QR_CODE,
          ]);
          hints.set(DecodeHintType.TRY_HARDER, true);
          const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 100 });
          const controls = await reader.decodeFromConstraints(constraints, video, (result) => {
            if (result) emit(result.getText());
          });
          if (cancelled) return controls.stop();
          const stream = video.srcObject as MediaStream | null;
          trackRef.current = stream?.getVideoTracks()[0] ?? null;
          stopFn = () => controls.stop();
        }

        const caps = (trackRef.current?.getCapabilities?.() ?? {}) as { torch?: boolean; focusMode?: string[] };
        // Android: continuous autofocus makes small barcodes read much faster.
        if (caps.focusMode?.includes("continuous")) {
          trackRef.current?.applyConstraints({ advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet] }).catch(() => {});
        }
        setTorch({ supported: Boolean(caps.torch), on: false });
        setStatus("scanning");
      } catch (e) {
        if (cancelled) return;
        setError(cameraErrorMessage(e));
        setStatus("error");
      }
    }

    // Release the camera when the app goes to the background (Android keeps it
    // locked otherwise, draining battery) and restart it when the user returns.
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        cancelled = true;
        stopFn?.();
        stopFn = null;
      } else if (cancelled) {
        setStatus("starting");
        setAttempt((a) => a + 1);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    start();
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      stopFn?.();
      trackRef.current = null;
    };
  }, [attempt]);

  const toggleTorch = async () => {
    const track = trackRef.current;
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !torch.on } as MediaTrackConstraintSet] });
      setTorch((t) => ({ ...t, on: !t.on }));
    } catch {
      setTorch({ supported: false, on: false });
    }
  };

  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-black sm:aspect-video">
      <video ref={videoRef} className="size-full object-cover" playsInline muted autoPlay aria-label="Camera preview" />
      {status === "scanning" ? (
        <>
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="relative h-2/5 w-4/5 rounded-xl border-2 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]">
              {!paused ? <div className="absolute inset-x-3 top-1/2 h-0.5 animate-pulse bg-danger-600" /> : null}
            </div>
          </div>
          <p className="absolute inset-x-0 bottom-3 text-center text-sm font-medium text-white drop-shadow">
            {paused ? "Paused" : "Point at a barcode"}
          </p>
          {torch.supported ? (
            <button
              type="button"
              onClick={toggleTorch}
              aria-label={torch.on ? "Turn off flashlight" : "Turn on flashlight"}
              className="absolute right-3 top-3 flex size-12 items-center justify-center rounded-full bg-black/50 text-white"
            >
              {torch.on ? <FlashlightOff className="size-6" aria-hidden /> : <Flashlight className="size-6" aria-hidden />}
            </button>
          ) : null}
        </>
      ) : null}
      {status === "starting" ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white">
          <Spinner className="size-8" />
          <p className="text-sm">Starting camera…</p>
        </div>
      ) : null}
      {status === "error" ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ink p-6 text-center text-white">
          <CameraOff className="size-10" aria-hidden />
          <p className="text-sm">{error}</p>
          <button
            type="button"
            onClick={() => {
              setStatus("starting");
              setError(null);
              setAttempt((a) => a + 1);
            }}
            className="flex h-11 items-center gap-2 rounded-xl bg-white/15 px-4 text-sm font-semibold"
          >
            <RefreshCw className="size-4" aria-hidden /> Try again
          </button>
        </div>
      ) : null}
    </div>
  );
}
