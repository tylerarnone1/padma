import type { Metadata } from "next";
import { headers } from "next/headers";
import { ThemeHead } from "@/theme/theme";
import { ThemeControls } from "@/theme/theme-controls";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Padma",
    template: "%s · Padma",
  },
  description:
    "A secure-by-default, AI-legible Next.js foundation for serious applications.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Reading request headers opts pages into dynamic rendering so Next.js can
  // attach the per-request CSP nonce generated in src/proxy.ts.
  const nonce = (await headers()).get("x-nonce") ?? "";

  return (
    <html
      lang="en"
      className="h-full antialiased"
      suppressHydrationWarning
    >
      <head>
        <ThemeHead nonce={nonce} />
      </head>
      <body className="flex min-h-full flex-col">
        {children}
        <ThemeControls />
      </body>
    </html>
  );
}
