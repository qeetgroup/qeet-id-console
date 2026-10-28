import { ChevronDownIcon, PlusIcon, TrashIcon } from "@qeetrix/icons";
import {
  Button,
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogFooter,
  Menu,
  MenuContent,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuSeparator,
  MenuSubmenu,
  MenuSubmenuTrigger,
  MenuTrigger,
  TextField,
} from "@qeetrix/react";
import { useStore } from "@tanstack/react-store";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { useStorageScope } from "@/platform/auth/scoped-storage";
import type { ActivitySearch } from "@/modules/activity/activity-search";
import {
  hydrateSavedViews,
  PRESET_VIEWS,
  type SavedView,
  savedViewsActions,
  savedViewsStore,
} from "@/modules/activity/saved-views";

/**
 * The toolbar's Saved views menu: the built-in investigations, the person's own views, and
 * "Save this view…", which names the current filters in a small dialog. Views are kept in this
 * browser, per person and organisation.
 */
export function ActivitySavedViews({
  search,
  onApply,
}: {
  search: ActivitySearch;
  onApply: (view: SavedView) => void;
}) {
  const { t, i18n } = useTranslation("activity");
  const scope = useStorageScope();
  const mine = useStore(savedViewsStore, (s) => s.views);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [missing, setMissing] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-read when the person or organisation changes
  useEffect(() => {
    hydrateSavedViews();
  }, [scope]);

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setMissing(true);
      return;
    }
    const view = savedViewsActions.add(trimmed, search);
    setSaving(false);
    setName("");
    toast.success(t("saveView.saved"));
    onApply(view);
  };

  return (
    <>
      <Menu>
        <MenuTrigger
          render={
            <Button variant="ghost" icon={ChevronDownIcon}>
              {t("toolbar.savedViews")}
            </Button>
          }
        />
        <MenuContent align="end">
          <MenuGroup>
            <MenuGroupLabel>{t("toolbar.builtIn")}</MenuGroupLabel>
            {PRESET_VIEWS.map((view) => (
              <MenuItem key={view.id} onClick={() => onApply(view)}>
                {i18n.t(view.name)}
              </MenuItem>
            ))}
          </MenuGroup>
          {mine.length ? (
            <>
              <MenuSeparator />
              <MenuGroup>
                <MenuGroupLabel>{t("toolbar.yours")}</MenuGroupLabel>
                {mine.map((view) => (
                  <MenuItem key={view.id} onClick={() => onApply(view)}>
                    {view.name}
                  </MenuItem>
                ))}
              </MenuGroup>
            </>
          ) : null}
          <MenuSeparator />
          <MenuItem icon={PlusIcon} onClick={() => setSaving(true)}>
            {t("toolbar.save")}
          </MenuItem>
          {mine.length ? (
            <MenuSubmenu>
              <MenuSubmenuTrigger icon={TrashIcon}>{t("toolbar.remove")}</MenuSubmenuTrigger>
              <MenuContent>
                {mine.map((view) => (
                  <MenuItem
                    key={view.id}
                    tone="danger"
                    onClick={() => {
                      savedViewsActions.remove(view.id);
                      toast.success(t("toolbar.removed", { name: view.name }));
                    }}
                  >
                    {view.name}
                  </MenuItem>
                ))}
              </MenuContent>
            </MenuSubmenu>
          ) : null}
        </MenuContent>
      </Menu>

      <Dialog
        open={saving}
        onOpenChange={(open) => {
          setSaving(open);
          if (!open) {
            setName("");
            setMissing(false);
          }
        }}
      >
        <DialogContent
          size="sm"
          title={t("saveView.title")}
          description={t("saveView.description")}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <DialogBody>
              <TextField
                label={t("saveView.name")}
                placeholder={t("saveView.placeholder")}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setMissing(false);
                }}
                error={missing ? t("saveView.nameMissing") : undefined}
                maxLength={60}
              />
            </DialogBody>
            <DialogFooter>
              <DialogClose render={<Button variant="ghost">{t("saveView.cancel")}</Button>} />
              <Button type="submit">{t("saveView.save")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
