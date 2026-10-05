import type { Metadata, Viewport } from "next";
import { PwaRegister } from "@/components/pwa/pwa";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "StockFlow", template: "%s · StockFlow" },
  description: "Simple inventory for your shop — scan, receive, sell, done.",
  applicationName: "StockFlow",
  appleWebApp: { capable: true, title: "StockFlow", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon.svg", type: "image/svg+xml" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#1f63e0",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Android: shrink the page when the keyboard opens so inputs and the Confirm button stay visible.
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-IN" className="h-full antialiased">
      <body className="min-h-full">
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
