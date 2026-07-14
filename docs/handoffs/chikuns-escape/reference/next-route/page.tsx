import type { Metadata } from "next";
import ArisGame from "./ArisGame";
import Leaderboard from "./Leaderboard";

const ARISE_DESCRIPTION =
  "The Elite clipped his wings. LitVM gave them back. Tap to flap, dodge Big Corp, reclaim the sky.";

export const metadata: Metadata = {
  title: "CHIKUN'S ESCAPE",
  description: ARISE_DESCRIPTION,
  openGraph: {
    title: "CHIKUN'S ESCAPE",
    description: ARISE_DESCRIPTION,
    images: [],
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "CHIKUN'S ESCAPE",
    description: ARISE_DESCRIPTION,
    images: [],
  },
};

export default function ArisePage() {
  return (
    <section
      className="arise-page min-h-screen flex flex-col items-center pt-14 sm:pt-20 pb-6 sm:pb-12"
      style={{ backgroundColor: "#2b5ede" }}
    >
      <div className="flex items-center justify-center w-full">
        <ArisGame />
      </div>
      <Leaderboard />
    </section>
  );
}
