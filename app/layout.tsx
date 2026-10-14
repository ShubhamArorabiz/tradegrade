import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import BottomTabs from "@/components/BottomTabs";
import ServiceWorker from "@/components/ServiceWorker";

const manrope = Manrope({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-manrope" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: "TradeGrade: construction surplus near you", template: "%s · TradeGrade" },
  description: "Snap a photo of leftover building material, sell it to a contractor nearby. Toronto's surplus marketplace.",
  applicationName: "TradeGrade",
  appleWebApp: { capable: true, title: "TradeGrade", statusBarStyle: "default" },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#f4f7fb",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-CA" className={manrope.variable}>
      <body className="antialiased">
        {children}
        <BottomTabs />
        <ServiceWorker />
      </body>
    </html>
  );
}
