import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { MfaSetup } from "@/features/auth/components/mfa-setup";
import { isDevelopmentAuthEnabled } from "@/lib/auth/auth-mode";
import { getCurrentSession } from "@/lib/auth/session";
import { getServerEnvironment } from "@/lib/env/server";

export const metadata: Metadata = {
  title: "Multi-factor verification",
};

export default async function MfaPage() {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/sign-in");
  }

  const environment = getServerEnvironment();
  const developmentAuth = isDevelopmentAuthEnabled(environment);

  return (
    <main
      id="main-content"
      className="mx-auto flex min-h-[85vh] w-full max-w-xl items-center px-6 py-16"
    >
      <div className="w-full">
        <Link
          href="/dashboard"
          className="mb-8 inline-block text-sm font-semibold text-muted hover:text-foreground"
        >
          ← Back to dashboard
        </Link>
        <Card className="p-7 sm:p-8">
          {developmentAuth ? (
            <>
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-primary">
                Development identity
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight">
                MFA requires a real OAuth session
              </h1>
              <p className="mt-4 leading-7 text-muted">
                The local mock account deliberately bypasses provider and
                factor enrollment. Set{" "}
                <code className="font-mono text-sm text-foreground">
                  AUTH_MODE=&quot;oauth&quot;
                </code>{" "}
                and restart the app to exercise this flow.
              </p>
            </>
          ) : (
            <>
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-primary">
                Step-up authentication
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight">
                {session.user.twoFactorEnabled
                  ? "Verify it’s really you"
                  : "Configure multi-factor authentication"}
              </h1>
              <div className="mt-6">
                <MfaSetup
                  enabled={session.user.twoFactorEnabled === true}
                  appName={environment.APP_NAME}
                />
              </div>
            </>
          )}
        </Card>
      </div>
    </main>
  );
}
