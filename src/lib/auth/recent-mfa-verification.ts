import { isAPIError } from "better-auth/api";
import { database } from "@/lib/db/client";

const mfaVerificationPaths = new Set([
  "/two-factor/verify-totp",
  "/two-factor/verify-otp",
  "/two-factor/verify-backup-code",
]);

export function isMfaVerificationPath(path: string | undefined): boolean {
  return path !== undefined && mfaVerificationPaths.has(path);
}

export function isSuccessfulMfaVerification(input: {
  path: string | undefined;
  returned: unknown;
}): boolean {
  return (
    isMfaVerificationPath(input.path) &&
    input.returned !== undefined &&
    !isAPIError(input.returned)
  );
}

type MfaSessionSnapshot = {
  session: {
    id: string;
  };
  user: {
    id: string;
  };
};

export async function recordMfaVerificationResult(input: {
  path: string | undefined;
  returned: unknown;
  newSession: MfaSessionSnapshot | null;
  session: MfaSessionSnapshot | null;
  headers?: Headers;
}): Promise<void> {
  if (!isMfaVerificationPath(input.path)) return;

  const successful = isSuccessfulMfaVerification(input);
  const outcome =
    successful
      ? "SUCCESS"
      : isAPIError(input.returned) && input.returned.statusCode >= 500
        ? "FAILURE"
        : "DENIED";
  const session = input.newSession ?? input.session;
  const requestId = input.headers?.get("x-request-id") ?? null;
  const userAgent =
    input.headers?.get("user-agent")?.slice(0, 500) ?? null;

  await database.$transaction(async (transaction) => {
    if (successful && session) {
      const updated = await transaction.session.updateMany({
        where: {
          id: session.session.id,
          userId: session.user.id,
        },
        data: { mfaVerifiedAt: new Date() },
      });
      if (updated.count !== 1) {
        throw new Error("The verified MFA session could not be updated.");
      }
    }

    await transaction.auditEvent.create({
      data: {
        actorId: session?.user.id ?? null,
        action: "mfa:verify",
        targetType: "session",
        targetId: session?.session.id ?? null,
        outcome,
        requestId,
        userAgent,
      },
    });
  });
}
