import { StatusPage } from "@/components/ui/status-page";

export default function NotFound() {
  return (
    <StatusPage
      code="404"
      title="This route does not exist."
      description="The resource may have moved, been removed, or never existed. Protected resources may also return not found when revealing their existence would cross an access boundary."
    />
  );
}
