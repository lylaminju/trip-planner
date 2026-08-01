import type { MetadataRoute } from "next";

import {
  LAUNCH_BACKGROUND_COLOR,
  SERVICE_DESCRIPTION,
  SERVICE_TITLE,
  THEME_COLOR,
} from "@/lib/service-brand";

/**
 * Web app manifest for home-screen installs.
 *
 * `display: "standalone"` is what drops Safari's address and tab bars once the
 * site is opened from the home screen (honoured by iOS 16.4 and later).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SERVICE_TITLE,
    short_name: SERVICE_TITLE,
    description: SERVICE_DESCRIPTION,
    // Installers are signed in, so open the dashboard directly; signed-out
    // visitors are redirected to the landing page by the route itself.
    start_url: "/trips",
    display: "standalone",
    theme_color: THEME_COLOR,
    background_color: LAUNCH_BACKGROUND_COLOR,
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
