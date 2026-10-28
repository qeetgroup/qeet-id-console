import { Drawer, DrawerBody, DrawerContent } from "@qeetrix/react";
import { useTranslation } from "react-i18next";

import { shortcutGroups } from "@/platform/keyboard/shortcuts";
import { useCapabilities } from "@/platform/security/capability-provider";

type ShortcutsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * The keyboard shortcuts (`?`), in a drawer from the end edge: each group's shortcuts as ruled
 * rows, what it does and then its keys. Shortcuts to pages this person can't open are left out.
 */
export function ShortcutsDialog({ open, onOpenChange }: ShortcutsDialogProps) {
  const { t, i18n } = useTranslation("dashboard");
  const access = useCapabilities();
  const groups = shortcutGroups()
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.path || access.canAccessPath(item.path)),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        size="sm"
        title={t("shortcutsDialog.keyboardShortcuts")}
        description={t("shortcutsDialog.moveAroundWithoutTouching")}
      >
        <DrawerBody>
          <div className="frame-shortcuts">
            {groups.map((group) => (
              <section key={group.title} className="frame-shortcuts-group">
                <h3>{i18n.t(group.title)}</h3>
                <ul>
                  {group.items.map((item) => (
                    <li key={item.description}>
                      <span>{i18n.t(item.description)}</span>
                      <span className="frame-shortcuts-keys">
                        {item.keys.map((k) => (
                          <kbd key={`${item.description}-${k}`}>{k}</kbd>
                        ))}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}
