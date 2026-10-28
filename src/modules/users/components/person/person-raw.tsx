import { Button, Drawer, DrawerBody, DrawerContent, DrawerFooter } from "@qeetrix/react";
import { CodeBlock, CopyButton } from "@qeetrix/react/experimental";
import { useTranslation } from "react-i18next";

import type { UserDetail } from "@/modules/users/api/user360";
import { personNames } from "@/modules/users/person-model";

/**
 * The person's record as the API returns it (once the Developer tab): for an integration or a
 * support ticket. Read-only; the IDs and attributes also sit in Overview › Details.
 */
export function RawRecordDrawer({
  user,
  onOpenChange,
}: {
  user: UserDetail | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation("users");
  const json = user ? JSON.stringify(user, null, 2) : "";
  return (
    <Drawer open={!!user} onOpenChange={onOpenChange}>
      <DrawerContent
        title={user ? t("person.raw.title", { name: personNames(user).full }) : ""}
        description={user ? t("person.raw.description", { id: user.id }) : undefined}
        size="lg"
      >
        {user ? (
          <>
            <DrawerBody>
              <CodeBlock className="prs-raw" code={json} language="json" />
            </DrawerBody>
            <DrawerFooter>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                {t("person.raw.done")}
              </Button>
              <CopyButton value={json} variant="soft" tone="neutral">
                {t("person.raw.copy")}
              </CopyButton>
            </DrawerFooter>
          </>
        ) : null}
      </DrawerContent>
    </Drawer>
  );
}
