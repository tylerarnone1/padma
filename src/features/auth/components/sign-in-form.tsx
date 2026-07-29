"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  GitHubIcon,
  GoogleIcon,
} from "@/features/auth/components/oauth-icons";
import { authClient } from "@/lib/auth/client";

type SignInFormProps = {
  developmentAuth: boolean;
  githubEnabled: boolean;
  googleEnabled: boolean;
};

export function SignInForm({
  developmentAuth,
  githubEnabled,
  googleEnabled,
}: SignInFormProps) {
  const [pendingProvider, setPendingProvider] = useState<
    "github" | "google" | null
  >(null);

  async function signInWith(provider: "github" | "google") {
    setPendingProvider(provider);
    await authClient.signIn.social({
      provider,
      callbackURL: "/dashboard",
      errorCallbackURL: "/sign-in?error=oauth",
    });
    setPendingProvider(null);
  }

  return (
    <div>
      {developmentAuth && (
        <form action="/api/auth/development-session" method="post">
          <Button type="submit" className="w-full gap-3">
            <span
              aria-hidden="true"
              className="inline-flex size-5 items-center justify-center rounded-full border border-current font-mono text-[0.65rem]"
            >
              D
            </span>
            Continue with mock account
          </Button>
        </form>
      )}

      {developmentAuth && (githubEnabled || googleEnabled) && (
        <div className="my-5 flex items-center gap-3 text-xs text-muted">
          <span className="h-px flex-1 bg-border" />
          <span>or use OAuth</span>
          <span className="h-px flex-1 bg-border" />
        </div>
      )}

      <div className="grid gap-3">
        {githubEnabled && (
          <Button
            variant="secondary"
            className="w-full gap-3"
            disabled={pendingProvider !== null}
            onClick={() => signInWith("github")}
          >
            <GitHubIcon />
            <span>
              {pendingProvider === "github"
                ? "Connecting..."
                : "Continue with GitHub"}
            </span>
          </Button>
        )}
        {googleEnabled && (
          <Button
            variant="secondary"
            className="w-full gap-3"
            disabled={pendingProvider !== null}
            onClick={() => signInWith("google")}
          >
            <GoogleIcon />
            <span>
              {pendingProvider === "google"
                ? "Connecting..."
                : "Continue with Google"}
            </span>
          </Button>
        )}
      </div>

      {!developmentAuth && !githubEnabled && !googleEnabled && (
        <p className="mt-4 text-center text-xs leading-5 text-muted">
          Configure GitHub or Google OAuth credentials to enable sign-in.
        </p>
      )}
    </div>
  );
}
