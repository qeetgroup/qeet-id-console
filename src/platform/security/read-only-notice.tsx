import { Eye } from "@qeetrix/icons";
import { Alert, AlertDescription, AlertTitle } from "@qeetrix/ui";

export function ReadOnlyNotice({
  title = "Read-only access",
  description = "You can inspect and export this data, but your organization role cannot change it.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <Alert>
      <Eye />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{description}</AlertDescription>
    </Alert>
  );
}
