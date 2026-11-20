import type { Metadata, Viewport } from "next";
// Self-hosted fonts (no build-time Google fetch → reliable builds + faster first
// paint). Family names: "Inter Variable" / "Fraunces Variable" (see globals.css).
import "@fontsource-variable/inter";
import "@fontsource-variable/fraunces/full.css";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const description =
  "Lexa explains your legal situation and documents in plain language, scoped to where you live, with the sources behind each answer. Legal information, not legal advice.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://lexa-main.netlify.app"),
  title: {
    default: "Lexa: Understand your legal situation in minutes",
    template: "%s · Lexa",
  },
  description,
  applicationName: "Lexa",
  keywords: [
    "legal information",
    "understand a contract",
    "tenant rights",
    "legal document analysis",
    "find a lawyer",
    "legal research",
  ],
  openGraph: {
    type: "website",
    siteName: "Lexa",
    title: "Lexa: Understand your legal situation in minutes",
    description,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "Lexa: Understand your legal situation in minutes",
    description,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf9f5" },
    { media: "(prefers-color-scheme: dark)", color: "#1f1e1d" },
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
