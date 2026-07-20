import type { Metadata, Viewport } from "next";
// Self-hosted fonts (no build-time Google fetch → reliable builds + faster first
// paint). Family names: "Inter Variable" / "Fraunces Variable" (see globals.css).
import "@fontsource-variable/inter";
import "@fontsource-variable/fraunces";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "LexMind — Understand your legal situation in minutes",
    template: "%s · LexMind",
  },
  description:
    "LexMind is a legal information, document, and workflow assistant — built for people and the lawyers who help them. Legal information, not legal advice.",
  applicationName: "LexMind",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf7f2" },
    { media: "(prefers-color-scheme: dark)", color: "#12181f" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
