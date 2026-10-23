import { Alert, AlertDescription, AlertTitle } from "@qeetrix/ui";
import { EyeIcon } from "@qeetrix/icons";
import { useTranslation } from "react-i18next";

export function ReadOnlyNotice({ title, description }: { title?: string; description?: string }) {
  const { t } = useTranslation("common");
  return (
    <Alert>
      <EyeIcon />
      <AlertTitle>{title ?? t("readOnlyNotice.title")}</AlertTitle>
      <AlertDescription>{description ?? t("readOnlyNotice.description")}</AlertDescription>
    </Alert>
  );
}
