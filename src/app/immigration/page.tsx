import type { Metadata } from "next";
import ImmigrationView from "@/components/pages/ImmigrationView";

export const metadata: Metadata = { title: "Immigration · The 7", description: "A 3D hologram of where New Yorkers were born." };

export default function Page() {
  return <ImmigrationView />;
}
