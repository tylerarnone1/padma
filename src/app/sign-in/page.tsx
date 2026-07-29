import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { SignInForm } from "@/features/auth/components/sign-in-form";
import { isDevelopmentAuthRequestEnabled } from "@/lib/auth/auth-mode";
import { getCurrentSession } from "@/lib/auth/session";
import { getServerEnvironment } from "@/lib/env/server";

export const metadata: Metadata = {
  title: "Sign in",
};

export default async function SignInPage() {
  const session = await getCurrentSession();
  if (session) {
    redirect("/dashboard");
  }

  const environment = getServerEnvironment();
  const developmentAuth = isDevelopmentAuthRequestEnabled(
    environment,
    (await headers()).get("x-padma-request-host"),
  );

  return (
    <main
      id="main-content"
      className="mx-auto flex min-h-[85vh] w-full max-w-md items-center px-6 py-16"
    >
      <div className="w-full">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-foreground"
        >
          ← Back to Padma
        </Link>
        <Card className="p-7 sm:p-8">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            {developmentAuth ? "Local development" : "OAuth access"}
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            Sign in to Padma
          </h1>
          <p className="mt-2 mb-7 leading-7 text-muted">
            {developmentAuth
              ? "Choose the local fixture account to explore Padma without configuring an OAuth application."
              : "Choose a trusted identity provider. No application password or email input is required."}
          </p>
          <SignInForm
            developmentAuth={developmentAuth}
            githubEnabled={Boolean(environment.GITHUB_CLIENT_ID)}
            googleEnabled={Boolean(environment.GOOGLE_CLIENT_ID)}
          />
        </Card>
        <p className="mt-5 text-center text-xs leading-5 text-muted">
          Sign-in attempts are rate limited. Session cookies are HTTP-only,
          same-site, and secure in production.
        </p>
      </div>
    </main>
  );
}
