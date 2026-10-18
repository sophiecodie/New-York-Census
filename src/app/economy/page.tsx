import type { Metadata } from "next";
import EconomyView from "@/components/pages/EconomyView";

export const metadata: Metadata = { title: "Economy · The 4", description: "Income, poverty and work along the 4 train." };

export default function Page() {
  return <EconomyView />;
}
