import type { Metadata } from "next";
import MyNewYorkView from "@/components/pages/MyNewYorkView";

export const metadata: Metadata = { title: "My New York", description: "Photos of the places that made New York mine." };

export default function Page() {
  return <MyNewYorkView />;
}
