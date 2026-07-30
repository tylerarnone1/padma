import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { TopNav } from "@/components/navigation/top-nav";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getAccessSummary } from "@/features/access-control/data/authorization";
import { AccountSecurity } from "@/features/auth/components/account-security";
import { SignOutButton } from "@/features/auth/components/sign-out-button";
import { isDevelopmentAuthEnabled } from "@/lib/auth/auth-mode";
import { getCurrentSession } from "@/lib/auth/session";
import { getServerEnvironment } from "@/lib/env/server";

export const metadata: Metadata = {
  title: "Foundation",
};

const foundations = [
  {
    title: "Identity",
    description:
      "Passwordless OAuth, revocable database sessions, and TOTP step-up are wired and ready.",
  },
  {
    title: "Authorization",
    description:
      "Application-level roles compose explicit permissions. Missing permission always means deny.",
  },
  {
    title: "Reliable side effects",
    description:
      "The transactional outbox, signed webhooks, retries, and idempotency primitives are available to every feature.",
  },
  {
    title: "Observability",
    description:
      "Structured request context, redacted logs, and durable audit events provide one trail through the app.",
  },
] as const;

export default async function DashboardPage() {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/sign-in");
  }

  const developmentAuth = isDevelopmentAuthEnabled(getServerEnvironment());
  const access = await getAccessSummary(session.user.id);

  return (
    <>
      <TopNav
        authenticated
        current="dashboard"
        action={
          <SignOutButton
            compactOnMobile
            developmentAuth={developmentAuth}
          />
        }
      />

      <main
        id="main-content"
        className="mx-auto w-full max-w-6xl flex-1 px-6 pb-8 sm:px-10"
      >
        <section className="pt-8 pb-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-primary">
              Foundation
            </p>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
              <span>{session.user.email}</span>
              {developmentAuth && (
                <Badge variant="primary" className="font-mono">
                  Mock session
                </Badge>
              )}
            </div>
          </div>

          <h1 className="mt-3 text-4xl font-semibold tracking-tight">
            Define your product, not your plumbing.
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-muted">
            Padma deliberately ships without organizations, workspaces,
            projects, or another borrowed product model. Start with a feature,
            declare who owns its records, and extend the security patterns
            already in place.
          </p>

          <div className="mt-8 grid gap-5 md:grid-cols-2">
            {foundations.map((foundation) => (
              <Card key={foundation.title}>
                <h2 className="text-xl font-semibold">{foundation.title}</h2>
                <p className="mt-2 leading-7 text-muted">
                  {foundation.description}
                </p>
              </Card>
            ))}
          </div>
        </section>

        <section className="grid gap-5 border-t border-border py-10 md:grid-cols-2">
          <Card>
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-primary">
              Your access
            </p>
            <h2 className="mt-3 text-xl font-semibold">
              {access.roles.length > 0
                ? access.roles.map((role) => role.name).join(", ")
                : "No roles assigned"}
            </h2>
            <p className="mt-2 leading-7 text-muted">
              {access.permissions.length} explicit permission
              {access.permissions.length === 1 ? "" : "s"} granted.
              Authentication alone grants nothing.
            </p>
          </Card>

          <Card>
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-primary">
              First feature
            </p>
            <h2 className="mt-3 text-xl font-semibold">
              Create a vertical slice
            </h2>
            <p className="mt-2 leading-7 text-muted">
              The atomic generator creates UI, schema, policy, data, service,
              and adversarial-test seams, then points to the ownership decision
              that makes the slice pass.
            </p>
            <code className="mt-4 block overflow-x-auto rounded-lg bg-surface px-4 py-3 font-mono text-sm">
              npm run generate:feature -- your-feature
            </code>
          </Card>
        </section>

        <section className="border-t border-border py-10">
          <h2 className="text-xl font-semibold">Account security</h2>
          <div className="mt-4 max-w-2xl">
            <AccountSecurity developmentAuth={developmentAuth} />
          </div>
        </section>
      </main>
    </>
  );
}
