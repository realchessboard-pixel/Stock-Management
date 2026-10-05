import type { MetadataRoute } from "next";

/** Web app manifest: makes StockFlow installable on Android (Chrome "Install app") and desktop. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "StockFlow — Shop Inventory",
    short_name: "StockFlow",
    description: "Scan, receive and sell stock from your phone.",
    start_url: "/dashboard?source=pwa",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "portrait",
    background_color: "#f4f6fa",
    theme_color: "#1f63e0",
    lang: "en-IN",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Long-press the app icon on Android to jump straight to these.
    shortcuts: [
      { name: "Scan barcode", short_name: "Scan", url: "/scan?source=shortcut", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Receive stock", short_name: "Receive", url: "/receive?source=shortcut", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Stock out", short_name: "Stock out", url: "/stock-out?source=shortcut", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
