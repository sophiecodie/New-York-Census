import type { Metadata } from "next";
import { Inter, Inter_Tight, Caveat, JetBrains_Mono } from "next/font/google";
import Nav from "@/components/ui/Nav";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-body" });
const interTight = Inter_Tight({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-display" });
const caveat = Caveat({ subsets: ["latin"], variable: "--font-hand" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["500", "700"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: { default: "The New York Census Line", template: "%s · The New York Census Line" },
  description: "New York City through Census data, subway lines and personal photos: housing, immigration and the economy across the five boroughs.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${interTight.variable} ${caveat.variable} ${mono.variable}`}>
      <body>
        <Nav />
        <main>{children}</main>
        <footer className="site-footer">
          Data: U.S. Census Bureau ACS · NYC Open Data · BLS CPI-U. Lines are illustrative, not MTA routes. <a href="/methods">Methods →</a>
        </footer>
      </body>
    </html>
  );
}
