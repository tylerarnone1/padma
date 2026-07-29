import type { Metadata } from "next";
import { StatusPage } from "@/components/ui/status-page";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function ForbiddenPage() {
  return (
    <StatusPage
      code="403"
      title="Permission denied."
      description="You are authenticated, but your assigned roles do not grant access to this operation."
      actionHref="/dashboard"
      actionLabel="Return to dashboard"
    />
  );
}
