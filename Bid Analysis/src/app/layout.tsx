import type { Metadata, Viewport } from "next";
import "@/styles/app.css";
import "@/styles/service-area.css";

export const metadata: Metadata = {
  title: "Bid Analytics · Washington Contract Explorer",
  description: "Find open public works opportunities across Washington, see how each fits your business, and contact the agency.",
  applicationName: "Bid Analytics",
  openGraph: {
    title: "Bid Analytics · Washington Contract Explorer",
    description: "Open public works opportunities across Washington on one map, with an honest read on how each fits your business.",
    siteName: "Bid Analytics",
    type: "website",
  },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#26232c" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Figtree:wght@500;600&display=swap" />
      </head>
      <body>{children}</body>
    </html>
  );
}
