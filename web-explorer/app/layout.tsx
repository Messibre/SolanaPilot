import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SolanaPilot Registry",
  description: "Discover AI-generated Solana programs on-chain",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
