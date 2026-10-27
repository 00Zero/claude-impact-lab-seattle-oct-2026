import type { Metadata } from "next";
import { Archivo, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });
const archivo = Archivo({ subsets: ["latin"], display: "swap", variable: "--font-archivo" });
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  title: "OneTrip",
  description:
    "Customers send photos from a text. You get a one-screen brief: what's wrong, why, and what to bring.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: browser extensions (Grammarly, Dark Reader…)
    // add attributes to <html>/<body> before React hydrates. Only silences
    // these two elements, not their children.
    <html
      lang="en"
      className={`${inter.variable} ${archivo.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body className="bg-white font-sans text-neutral-950 antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
