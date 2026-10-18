import type { Metadata } from "next";
import HousingView from "@/components/pages/HousingView";

export const metadata: Metadata = { title: "Housing · The Q", description: "Rent and rent burden along the Q line, across NYC's 55 neighborhoods." };

export default function Page() {
  return <HousingView />;
}
