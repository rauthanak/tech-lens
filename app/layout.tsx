import type { Metadata } from "next";
import "./fonts/montserrat-other-scripts.css"; // before the Latin faces, which win where the ranges overlap
import localFont from "next/font/local";
import "./globals.css";

// The brand sans: Montserrat, the free match for the client's Gotham, from
// app/fonts (so a build needs no font service). Latin is preloaded; the other
// scripts are in montserrat-other-scripts.css. A true italic, not the browser's
// slanted roman. If Gotham is licensed for this tool, its files replace these.
// Named Montserrat: the loader names the family after the variable. Its
// fallback (Arial sized to match) is in the CSS file too, with the metrics
// Google gave, so text before the font arrives takes the same room as before.
const Montserrat = localFont({
  src: [
    { path: "./fonts/montserrat-latin-normal.woff2", weight: "300 600", style: "normal" },
    { path: "./fonts/montserrat-latin-italic.woff2", weight: "300 600", style: "italic" },
  ],
  declarations: [ // the font loader takes literals only
    { prop: "font-family", value: "Montserrat" },
    { prop: "unicode-range", value: "U+00??,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD" },
  ],
  variable: "--font-brand",
  fallback: ["Montserrat Fallback"],
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  title: "Tech Lens",
  description: "Tech Lens — the horizon-categorized source register",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={Montserrat.variable}>
      <body className="bg-ground text-ink antialiased">{children}</body>
    </html>
  );
}
