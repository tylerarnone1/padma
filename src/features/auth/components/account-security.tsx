type AccountSecurityProps = {
  developmentAuth?: boolean;
};

export function AccountSecurity({
  developmentAuth = false,
}: AccountSecurityProps) {
  if (developmentAuth) {
    return (
      <div>
        <p className="leading-7 text-muted">
          Mock authentication is active for local exploration. Set{" "}
          <code className="font-mono text-sm text-foreground">
            AUTH_MODE=&quot;oauth&quot;
          </code>{" "}
          to exercise real OAuth sessions and TOTP.
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="leading-7 text-muted">
        OAuth is the only sign-in path. Add TOTP for explicit second-factor
        verification before sensitive operations.
      </p>
      <a
        href="/auth/mfa"
        data-contrast-context="surface"
        data-contrast-hover-context="raised"
        className="mt-4 inline-flex min-h-10 items-center rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold hover:bg-surface-raised"
      >
        Configure TOTP
      </a>
    </div>
  );
}
