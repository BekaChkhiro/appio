import type { Metadata } from "next";
import { PersonaGallery } from "@/components/personas/persona-gallery";

export const metadata: Metadata = {
  title: "Theme Personas",
};

export default function PersonasPage() {
  return <PersonaGallery />;
}
