import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tech Lens",
  description: "Tech Lens — the horizon-categorized source register",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
