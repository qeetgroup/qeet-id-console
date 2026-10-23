import {
  Button,
  Chip,
  ChipGroup,
  Input,
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@qeetrix/ui";
import { useStore } from "@tanstack/react-store";
import { BookmarkIcon, PlusIcon } from "@qeetrix/icons";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { ActivitySearch } from "../activity-search";
import { PRESET_VIEWS, type SavedView, savedViewsActions, savedViewsStore } from "../saved-views";

/** Renders the saved-view chips and a popover that saves the current search as a new view. */
export function ActivitySavedViews({
  activeViewId,
  currentSearch,
  onApply,
  className,
}: {
  activeViewId?: string;
  currentSearch: ActivitySearch;
  onApply: (view: SavedView) => void;
  className?: string;
}) {
  const { t, i18n } = useTranslation(["activity", "common"]);
  const userViews = useStore(savedViewsStore, (s) => s.views);
  const [name, setName] = useState("");

  const all = [...PRESET_VIEWS, ...userViews];

  const handleChange = (value: string | string[]) => {
    const id = Array.isArray(value) ? value[0] : value;
    const view = all.find((v) => v.id === id);
    if (view) onApply(view);
  };

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const view = savedViewsActions.add(trimmed, currentSearch);
    setName("");
    onApply(view);
  };

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex shrink-0 items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <BookmarkIcon className="size-3.5" aria-hidden="true" />
          {t("activitySavedViews.savedViews")}
        </span>
        <ChipGroup value={activeViewId ?? ""} onValueChange={handleChange}>
          {PRESET_VIEWS.map((v) => (
            <Chip key={v.id} value={v.id} size="sm">
              {i18n.t(v.name)}
            </Chip>
          ))}
          {userViews.map((v) => (
            <Chip key={v.id} value={v.id} size="sm" onRemove={() => savedViewsActions.remove(v.id)}>
              {v.name}
            </Chip>
          ))}
        </ChipGroup>

        <Popover>
          {/* Pushed to the trailing edge of the bar */}
          <PopoverTrigger
            render={
              <Button variant="ghost" size="sm" className="ml-auto text-muted-foreground">
                <PlusIcon className="size-3.5" aria-hidden="true" />
                {t("activitySavedViews.saveCurrentView")}
              </Button>
            }
          />
          <PopoverContent align="start" className="w-72 p-3">
            <PopoverTitle className="text-sm font-medium">
              {t("activitySavedViews.saveCurrentView")}
            </PopoverTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("activitySavedViews.snapshotsTheActiveFilters")}
            </p>
            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                handleSave();
              }}
            >
              <Input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("activitySavedViews.viewName")}
                aria-label={t("activitySavedViews.viewName")}
                className="h-8"
              />
              <PopoverClose
                render={
                  <Button type="submit" size="sm" disabled={!name.trim()}>
                    {t("common:actions.save")}
                  </Button>
                }
              />
            </form>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
