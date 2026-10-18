import type { Metadata } from "next";
import MethodsView from "@/components/pages/MethodsView";

export const metadata: Metadata = { title: "Data & Methods", description: "Sources, definitions and statistical methods." };

export default function Page() {
  return <MethodsView />;
}
