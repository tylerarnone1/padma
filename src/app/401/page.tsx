import { StatusPage } from "@/components/ui/status-page";

export default function UnauthorizedPage() {
  return (
    <StatusPage
      code="401"
      title="Authentication required."
      description="Your session is missing or no longer valid. Sign in again to continue."
      actionHref="/sign-in"
      actionLabel="Sign in"
    />
  );
}
