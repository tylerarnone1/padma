"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";

export function SignOutButton({
  compactOnMobile = false,
  developmentAuth = false,
}: {
  compactOnMobile?: boolean;
  developmentAuth?: boolean;
}) {
  const router = useRouter();

  async function signOut() {
    if (developmentAuth) {
      await fetch("/api/auth/development-session", {
        method: "DELETE",
      });
    } else {
      await authClient.signOut();
    }

    router.push("/sign-in");
    router.refresh();
  }

  return (
    <Button
      variant="secondary"
      onClick={signOut}
      aria-label={compactOnMobile ? "Sign out" : undefined}
    >
      {compactOnMobile && (
        <svg
          aria-hidden="true"
          className="size-4 sm:hidden"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <path d="M10 5H5v14h5M14 8l4 4-4 4m4-4H9" />
        </svg>
      )}
      <span className={compactOnMobile ? "hidden sm:inline" : undefined}>
        Sign out
      </span>
    </Button>
  );
}
