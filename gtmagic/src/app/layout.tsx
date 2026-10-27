import type { Metadata } from "next";
import localFont from "next/font/local";
import type { ReactNode } from "react";
import { SvgDefs } from "@/components/figures";
import "./styles/base.css";
import "./styles/thread.css";
import "./styles/cards.css";
import "./styles/intake.css";

const jost = localFont({
  src: [
    { path: "./fonts/jost-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/jost-500.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-jost",
  display: "swap",
});

export const metadata: Metadata = {
  title: "GTMagic",
  description: "Find out who will buy from you, why, and what to say to them, before you spend money on marketing.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={jost.variable}>
      <body><SvgDefs />{children}</body>
    </html>
  );
}
