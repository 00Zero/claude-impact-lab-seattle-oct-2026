import type { Metadata } from "next";
import { Figtree } from "next/font/google";
import { Header } from "@/components/header";
import "./globals.css";

// One family, three weights (brand/DESIGN.md).
const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
  weight: ["400", "600", "800"],
});

export const metadata: Metadata = {
  title: "ALongTable",
  description: "Turn empty tables into thriving communities.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  // suppressHydrationWarning: the landing page's boot script adds a class to <html> before React loads.
  return (
    <html lang="en" className={`${figtree.variable} h-full`} suppressHydrationWarning>
      <body className="alt-root flex min-h-full flex-col">
        <Header />
        {children}
      </body>
    </html>
  );
}
