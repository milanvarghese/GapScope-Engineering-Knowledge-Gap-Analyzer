import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GapScope — Engineering Knowledge Gap Analyzer",
  description: "Identify and close the skill gaps between your current toolkit and where the field is headed.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
