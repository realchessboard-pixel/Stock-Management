"use client";

import { useRef, useState } from "react";
import { Camera, Trash2 } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

/** Shrinks a phone photo to max 1280px JPEG before upload (saves mobile data). */
async function compress(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.82));
    return blob ?? file;
  } catch {
    return file;
  }
}

export function PhotoInput({ name, defaultValue, error }: { name: string; defaultValue?: string | null; error?: string[] }) {
  const [url, setUrl] = useState(defaultValue ?? "");
  const [busy, setBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setUploadError(null);
    try {
      const body = new FormData();
      body.set("file", await compress(file), "photo.jpg");
      const res = await fetch("/api/uploads/product-image", { method: "POST", body });
      const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !json.url) throw new Error(json.error ?? "Upload failed. Please try again.");
      setUrl(json.url);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-1.5">
      <span className="block text-sm font-medium">Photo</span>
      <input type="hidden" name={name} value={url} />
      <div className="flex items-center gap-3">
        <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-line bg-canvas text-ink-faint">
          {busy ? (
            <Spinner />
          ) : url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="Product photo" className="size-full object-cover" />
          ) : (
            <Camera className="size-7" aria-hidden />
          )}
        </div>
        <div className="flex flex-col gap-2">
          <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl border border-line bg-surface px-4 text-sm font-semibold">
            <Camera className="size-4" aria-hidden /> {url ? "Change photo" : "Take or choose photo"}
            <input ref={inputRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => upload(e.target.files?.[0])} disabled={busy} />
          </label>
          {url ? (
            <button type="button" onClick={() => setUrl("")} className="inline-flex h-9 items-center gap-1 text-sm font-medium text-danger-600">
              <Trash2 className="size-4" aria-hidden /> Remove
            </button>
          ) : null}
        </div>
      </div>
      {uploadError || error?.length ? <p className="text-sm text-danger-600">{uploadError ?? error?.[0]}</p> : null}
    </div>
  );
}
