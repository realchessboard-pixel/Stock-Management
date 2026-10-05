"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Download, X } from "lucide-react";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

// The install event can fire before React mounts, so capture it at module load.
let deferred: InstallEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    notify();
  });
}

function useInstallPrompt() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => deferred,
    () => null,
  );
}

/** Registers the service worker (production only, so dev never serves stale code). */
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    const register = () => navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);
  return null;
}

/** "Install app" button; renders nothing when the browser can't install or it's already installed. */
export function InstallAppButton({ className }: { className?: string }) {
  const prompt = useInstallPrompt();
  if (!prompt) return null;
  return (
    <button
      type="button"
      onClick={async () => {
        await prompt.prompt();
        await prompt.userChoice.catch(() => null);
        deferred = null;
        notify();
      }}
      className={className ?? "flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 font-semibold text-white"}
    >
      <Download className="size-5" aria-hidden /> Install StockFlow app
    </button>
  );
}

const DISMISS_KEY = "sf-install-dismissed";

/** Dismissible install banner for the dashboard (remembered per device). */
export function InstallBanner() {
  const prompt = useInstallPrompt();
  const [dismissed, setDismissed] = useState(true);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read device preference after hydration
      setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);
  if (!prompt || dismissed) return null;
  return (
    <div className="mb-4 flex items-center gap-3 rounded-[var(--radius-card)] border border-brand-200 bg-brand-50 p-3">
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold text-brand-800">Install StockFlow on this phone</p>
        <p className="text-ink-muted">Opens full screen from your home screen, like an app.</p>
      </div>
      <InstallAppButton className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-brand-600 px-3 text-sm font-semibold text-white" />
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => {
          setDismissed(true);
          try {
            localStorage.setItem(DISMISS_KEY, "1");
          } catch {}
        }}
        className="flex size-11 shrink-0 items-center justify-center rounded-lg text-ink-muted"
      >
        <X className="size-5" aria-hidden />
      </button>
    </div>
  );
}
