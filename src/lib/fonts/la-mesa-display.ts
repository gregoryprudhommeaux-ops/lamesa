import { Caveat } from "next/font/google";

/**
 * Fallback until Lumios Marker is added to public/fonts/ (see public/fonts/README.md).
 * Caveat 700 — sign-pen feel, closer to Lumios Marker than Permanent Marker.
 */
export const laMesaDisplayFallback = Caveat({
  subsets: ["latin"],
  weight: ["700"],
  variable: "--font-la-mesa-display-fallback",
  display: "swap",
});
