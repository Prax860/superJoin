import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Fact Knowledge Layer",
  description: "Extract facts from PDFs and compare them across documents.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
