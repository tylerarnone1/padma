/**
 * Better Auth endpoint paths that Padma treats as security-sensitive.
 *
 * Pure data with no imports, so both the request guard and the audit hook can
 * agree on the same set without depending on each other.
 */

/** Verifying an existing factor. Success elevates the session. */
const verificationPaths = new Set([
  "/two-factor/verify-totp",
  "/two-factor/verify-otp",
  "/two-factor/verify-backup-code",
]);

/**
 * Creating, replacing, revealing, or removing a factor. These change the
 * credential itself, so they must never be reachable with only a bearer
 * session: `/two-factor/get-totp-uri` discloses the shared secret and
 * `/two-factor/enable` silently replaces an existing enrollment.
 */
const lifecyclePaths = new Set([
  "/two-factor/enable",
  "/two-factor/disable",
  "/two-factor/get-totp-uri",
  "/two-factor/generate-backup-codes",
]);

export function isMfaVerificationPath(
  path: string | undefined,
): path is string {
  return path !== undefined && verificationPaths.has(path);
}

export function isMfaLifecyclePath(path: string | undefined): path is string {
  return path !== undefined && lifecyclePaths.has(path);
}

/** Stable audit action name for an MFA endpoint. */
export function mfaAuditAction(path: string): string {
  return `mfa:${path.replace("/two-factor/", "")}`;
}
