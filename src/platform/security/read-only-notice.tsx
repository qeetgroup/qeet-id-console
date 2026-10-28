import { EyeIcon } from "@qeetrix/icons";
import { Alert } from "@qeetrix/react/experimental";
import { useTranslation } from "react-i18next";

/** Renders the note that the person can look at this page but their role can't change it. */
export function ReadOnlyNotice({ title, description }: { title?: string; description?: string }) {
  const { t } = useTranslation("common");
  return (
    <Alert tone="info" icon={EyeIcon} title={title ?? t("readOnlyNotice.title")}>
      {description ?? t("readOnlyNotice.description")}
    </Alert>
  );
}
