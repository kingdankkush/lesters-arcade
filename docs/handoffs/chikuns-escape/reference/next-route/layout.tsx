import type { Viewport } from "next";

// Route-scoped viewport: disable pinch-zoom on the ARISE page so repeated
// taps for flapping can't accidentally trigger the browser zoom, and honor
// iPhone safe-area so the notch / home indicator don't clip the game frame.
// Desktop browsers ignore this meta entirely.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#2b5ede",
};

export default function AriseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
