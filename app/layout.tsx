import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Pixelify_Sans, Source_Serif_4 } from "next/font/google";
import "./globals.css";

const ui = Inter({ subsets: ["latin"], variable: "--font-ui", display: "swap" });
const doc = Source_Serif_4({ subsets: ["latin"], variable: "--font-doc", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });
const pixel = Pixelify_Sans({ subsets: ["latin"], variable: "--font-pixel", display: "swap" });

export const metadata: Metadata = {
  title: "NoteSmith",
  description: "Scribble while you watch. NoteSmith forges your scribbles into clean notes.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${ui.variable} ${doc.variable} ${mono.variable} ${pixel.variable}`}>
      <body>{children}</body>
    </html>
  );
}
