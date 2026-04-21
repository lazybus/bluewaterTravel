import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Bluewater Travels",
    short_name: "Bluewater",
    description:
      "Offline-first Bruce Peninsula trip planning for logistics, conditions, and itinerary building.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4efe4",
    theme_color: "#0f7f92",
    orientation: "portrait",
    lang: "en-CA",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}