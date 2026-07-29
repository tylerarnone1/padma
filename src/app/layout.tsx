import type { Metadata } from "next";
import { headers } from "next/headers";
import { ThemeHead } from "@/theme/theme";
import { ThemeControls } from "@/theme/theme-controls";
import "./globals.css";
/*
 * The landing page's motion system: a large, self-contained stylesheet kept
 * apart from the base rules so neither has to be read to understand the other.
 * Imported here rather than with a CSS `@import` inside `globals.css` so the
 * bundler resolves it, and imported second so its rules sit after the base
 * element styles in the cascade.
 */
import "./landing.css";

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
        <a
          href="#main-content"
          data-contrast-context="raised"
          className="fixed left-4 top-4 z-50 -translate-y-24 rounded-[var(--radius-sm)] border border-border bg-surface-raised px-4 py-2 text-sm font-semibold shadow-[var(--shadow-md)] focus:translate-y-0"
        >
          Skip to main content
        </a>
        {children}
        {process.env.NODE_ENV !== "production" ? <ThemeControls /> : null}
      </body>
    </html>
  );
}
