import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CCNA Cards — Jeremy's IT Lab",
    short_name: "CCNA Cards",
    description: "Spaced-repetition CCNA flashcards organized by Jeremy's IT Lab study days.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f4f6f9",
    theme_color: "#2563eb",
    categories: ["education", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Study", url: "/study", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Study Plan", url: "/plan", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
