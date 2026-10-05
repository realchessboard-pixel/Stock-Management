import type { Metadata } from "next";
import { WifiOff } from "lucide-react";

export const metadata: Metadata = { title: "Offline" };
// Static so the service worker can cache it at install time.
export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-warn-50 text-warn-600">
        <WifiOff className="size-8" aria-hidden />
      </span>
      <h1 className="text-2xl font-bold">You&apos;re offline</h1>
      <p className="max-w-xs text-ink-muted">
        StockFlow needs internet to save stock changes safely. Check your mobile data or Wi-Fi, then try again.
      </p>
      {/* Plain link (not client JS) so it works even when scripts failed to load. */}
      <a href="/dashboard" className="mt-2 flex h-12 items-center rounded-xl bg-brand-600 px-6 font-semibold text-white">
        Try again
      </a>
    </div>
  );
}
