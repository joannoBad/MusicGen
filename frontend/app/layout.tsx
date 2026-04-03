import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MusicGen",
  description: "Generate deterministic passwords from audio fingerprints."
};

type RootLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      {/* The shell stays neutral because the visible language is selected in the client UI. */}
      <body>{children}</body>
    </html>
  );
}
