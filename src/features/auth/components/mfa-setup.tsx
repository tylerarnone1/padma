"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth/client";

type Enrollment = {
  totpURI: string;
  backupCodes: string[];
};

/**
 * Changing a factor is gated server-side: an enrolled user must verify the
 * current factor first, and a user with no factor needs a recent sign-in. Both
 * denials are recoverable, so they get an explicit next step rather than a bare
 * error string.
 */
function recoveryFor(code: string | undefined): "verify" | "reauthenticate" | null {
  if (code === "RECENT_MFA_REQUIRED") return "verify";
  if (code === "FRESH_SESSION_REQUIRED") return "reauthenticate";
  return null;
}

export function MfaSetup({
  enabled,
  appName,
}: {
  enabled: boolean;
  appName: string;
}) {
  const router = useRouter();
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [recovery, setRecovery] = useState<
    "verify" | "reauthenticate" | null
  >(null);
  const [pending, setPending] = useState(false);

  async function beginEnrollment() {
    setPending(true);
    setMessage("");
    setRecovery(null);
    const result = await authClient.twoFactor.enable({
      issuer: appName,
    });

    if (result.error || !result.data) {
      setMessage(
        result.error?.message || "Multi-factor enrollment could not begin.",
      );
      setRecovery(recoveryFor(result.error?.code));
    } else {
      setEnrollment({
        totpURI: result.data.totpURI,
        backupCodes: result.data.backupCodes,
      });
    }
    setPending(false);
  }

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    const result = await authClient.twoFactor.verifyTotp({
      code,
      trustDevice: false,
    });

    if (result.error) {
      setMessage(result.error.message || "The verification code is invalid.");
      setPending(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {!enabled && !enrollment && (
        <div>
          <p className="leading-7 text-muted">
            Use an authenticator app to add a second factor. The secret and
            recovery codes are encrypted by the authentication framework.
          </p>
          <Button
            className="mt-5"
            disabled={pending}
            onClick={beginEnrollment}
          >
            Begin TOTP setup
          </Button>
        </div>
      )}

      {enrollment && (
        <div className="space-y-5">
          <div>
            <h2 className="font-semibold">1. Add the authenticator secret</h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              Import this URI into your authenticator. A QR renderer can be
              added by a downstream app without changing the security flow.
            </p>
            <code
              data-contrast-context="raised"
              className="mt-3 block overflow-x-auto rounded-lg bg-surface-raised p-3 font-mono text-xs"
            >
              {enrollment.totpURI}
            </code>
          </div>
          <div>
            <h2 className="font-semibold">2. Save recovery codes</h2>
            <p className="mt-1 text-sm text-danger">
              These are shown once. Store them somewhere safe.
            </p>
            <div
              data-contrast-context="raised"
              className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-surface-raised p-4 font-mono text-xs"
            >
              {enrollment.backupCodes.map((backupCode) => (
                <span key={backupCode}>{backupCode}</span>
              ))}
            </div>
          </div>
        </div>
      )}

      {(enabled || enrollment) && (
        <form onSubmit={verify} className="space-y-3">
          <label htmlFor="totp-code" className="block text-sm font-medium">
            {enrollment ? "3. Verify setup" : "Authenticator code"}
          </label>
          <Input
            id="totp-code"
            className="max-w-48 font-mono tracking-[0.25em]"
            inputMode="numeric"
            autoComplete="one-time-code"
            minLength={6}
            maxLength={8}
            pattern="[0-9]+"
            required
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="000000"
          />
          <Button type="submit" disabled={pending}>
            {pending ? "Verifying…" : "Verify code"}
          </Button>
        </form>
      )}

      {message && (
        <div role="alert" className="space-y-2">
          <p className="text-sm text-danger">{message}</p>
          {recovery === "verify" && (
            <p className="text-sm leading-6 text-muted">
              Enter a current authenticator code above, then start setup again.
              If you no longer have the device, use a recovery code instead.
            </p>
          )}
          {recovery === "reauthenticate" && (
            <a
              href="/sign-in"
              className="inline-block text-sm font-semibold underline"
            >
              Sign in again to continue
            </a>
          )}
        </div>
      )}
    </div>
  );
}
