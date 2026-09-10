import { Add, Bookmark } from "@qeetrix/icons";
// Saved-views bar: quick-apply chips for the built-in investigation presets and
// any user-saved views, plus a "Save view" popover that snapshots the current
// filter set. Applying a view navigates the URL (see the route), so every view
// stays paste-shareable.

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
import { useState } from "react";

import type { ActivitySearch } from "../activity-search";
import { PRESET_VIEWS, type SavedView, savedViewsActions, savedViewsStore } from "../saved-views";

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
          <Bookmark className="size-3.5" aria-hidden="true" />
          Saved views
        </span>
        <ChipGroup value={activeViewId ?? ""} onValueChange={handleChange}>
          {PRESET_VIEWS.map((v) => (
            <Chip key={v.id} value={v.id} size="sm">
              {v.name}
            </Chip>
          ))}
          {userViews.map((v) => (
            <Chip key={v.id} value={v.id} size="sm" onRemove={() => savedViewsActions.remove(v.id)}>
              {v.name}
            </Chip>
          ))}
        </ChipGroup>

        <Popover>
          {/* Save-current-view control, pushed to the trailing edge */}
          <PopoverTrigger
            render={
              <Button variant="ghost" size="sm" className="ml-auto text-muted-foreground">
                <Add className="size-3.5" aria-hidden="true" />
                Save current view
              </Button>
            }
          />
          <PopoverContent align="start" className="w-72 p-3">
            <PopoverTitle className="text-sm font-medium">Save current view</PopoverTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Snapshots the active filters, time range, and search as a reusable view.
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
                placeholder="View name"
                aria-label="View name"
                className="h-8"
              />
              <PopoverClose
                render={
                  <Button type="submit" size="sm" disabled={!name.trim()}>
                    Save
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
