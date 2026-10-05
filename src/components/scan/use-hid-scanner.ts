"use client";

import { useEffect, useRef } from "react";

/**
 * USB / Bluetooth barcode scanners act as keyboards that "type" the code very
 * fast and press Enter. When no text field is focused, collect such bursts
 * and report them as scans. Human typing is too slow to trigger this.
 */
export function useHidScanner(onScan: (code: string) => void, enabled = true) {
  const buffer = useRef("");
  const last = useRef(0);
  const cb = useRef(onScan);
  useEffect(() => {
    cb.current = onScan;
  }, [onScan]);

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      const now = performance.now();
      if (now - last.current > 60) buffer.current = "";
      last.current = now;
      if (e.key === "Enter") {
        if (buffer.current.length >= 3) {
          e.preventDefault();
          cb.current(buffer.current);
        }
        buffer.current = "";
      } else if (e.key.length === 1) {
        buffer.current += e.key;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);
}
