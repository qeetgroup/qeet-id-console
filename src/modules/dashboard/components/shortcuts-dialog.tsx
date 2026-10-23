import { useTranslation } from "react-i18next";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@qeetrix/ui";

import { useCapabilities } from "@/platform/security/capability-provider";
import { shortcutGroups } from "@/platform/keyboard/shortcuts";

type ShortcutsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{t("shortcutsDialog.keyboardShortcuts")}</SheetTitle>
          <SheetDescription>{t("shortcutsDialog.moveAroundWithoutTouching")}</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex flex-col gap-6">
            {groups.map((group) => (
              <div key={group.title}>
                <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {i18n.t(group.title)}
                </h3>
                <ul className="flex flex-col">
                  {group.items.map((item) => (
                    <li
                      key={item.description}
                      className="flex items-center justify-between gap-4 border-b border-border/60 py-2 text-sm last:border-0"
                    >
                      <span className="text-muted-foreground">{i18n.t(item.description)}</span>
                      <span className="flex items-center gap-1">
                        {item.keys.map((k) => (
                          <kbd
                            key={`${item.description}-${k}`}
                            className="inline-flex h-5 min-w-5 select-none items-center justify-center rounded border bg-muted px-1.5 font-mono text-[11px] font-medium text-muted-foreground"
                          >
                            {k}
                          </kbd>
                        ))}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
