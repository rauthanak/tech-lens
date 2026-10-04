import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";

// The brand sans: Montserrat, the free match for the client's Gotham. If Gotham
// is licensed for this tool, next/font/local with their files replaces this.
const brand = Montserrat({
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"], // a true italic, not the browser's slanted roman
  subsets: ["latin"],
  variable: "--font-brand",
});

export const metadata: Metadata = {
  title: "Tech Lens",
  description: "Tech Lens — the horizon-categorized source register",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={brand.variable}>
      <body className="bg-ground text-ink antialiased">{children}</body>
    </html>
  );
}
