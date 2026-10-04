import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "StockFlow", template: "%s · StockFlow" },
  description: "Simple inventory for your shop — scan, receive, sell, done.",
  applicationName: "StockFlow",
  appleWebApp: { capable: true, title: "StockFlow", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#1f63e0",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-IN" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
