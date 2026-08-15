// Filter-bar extras: a "More filters" popover (extra client-side facets) and a
// "Save view" popover that snapshots the current filter state to localStorage.

import {
  Button,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@qeetrix/ui";
import { BookmarkIcon, SlidersHorizontalIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

export interface UsersViewState {
  search: string;
  status: string;
  role: string;
  mfa: string;
  emailVerified: string;
}

const VIEWS_KEY = "qeetid.users.savedViews";

function loadViews(): Record<string, UsersViewState> {
  try {
    return JSON.parse(localStorage.getItem(VIEWS_KEY) ?? "{}");
  } catch {
    return {};
  }
}
function persistViews(v: Record<string, UsersViewState>) {
  localStorage.setItem(VIEWS_KEY, JSON.stringify(v));
}

export function MoreFilters({
  emailVerified,
  onEmailVerified,
  activeCount,
}: {
  emailVerified: string;
  onEmailVerified: (v: string) => void;
  activeCount: number;
}) {
  const { t } = useTranslation("users");
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="outline" size="sm">
            <SlidersHorizontalIcon />
            {t("filters.more")}
            {activeCount > 0 ? (
              <span className="ml-1 inline-flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                {activeCount}
              </span>
            ) : null}
          </Button>
        }
      />
      <PopoverContent align="end" className="w-64 space-y-3">
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            {t("filters.emailVerification")}
          </span>
          <Select
            value={emailVerified || "all"}
            onValueChange={(v) => onEmailVerified(v && v !== "all" ? v : "")}
          >
            <SelectTrigger aria-label={t("filters.emailVerification")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("filters.any")}</SelectItem>
              <SelectItem value="verified">{t("detail.verified")}</SelectItem>
              <SelectItem value="unverified">{t("detail.unverified")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function SaveView({
  current,
  onApply,
}: {
  current: UsersViewState;
  onApply: (v: UsersViewState) => void;
}) {
  const { t } = useTranslation("users");
  const [views, setViews] = useState<Record<string, UsersViewState>>(() => loadViews());
  const [name, setName] = useState("");
  const names = Object.keys(views);

  function save() {
    const n = name.trim();
    if (!n) return;
    const next = { ...views, [n]: current };
    setViews(next);
    persistViews(next);
    setName("");
  }
  function remove(n: string) {
    const next = { ...views };
    delete next[n];
    setViews(next);
    persistViews(next);
  }

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="outline" size="sm">
            <BookmarkIcon />
            {t("filters.saveView")}
          </Button>
        }
      />
      <PopoverContent align="end" className="w-64 space-y-3">
        <div className="flex gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("filters.viewName")}
            onKeyDown={(e) => e.key === "Enter" && save()}
          />
          <Button size="sm" onClick={save} disabled={!name.trim()}>
            {t("filters.save")}
          </Button>
        </div>
        {names.length > 0 ? (
          <ul className="space-y-1">
            {names.map((n) => (
              <li key={n} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onApply(views[n])}
                  className="flex-1 truncate rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                >
                  {n}
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t("common:actions.delete")}
                  onClick={() => remove(n)}
                >
                  <Trash2Icon className="size-3.5 text-muted-foreground" />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">{t("filters.noViews")}</p>
        )}
      </PopoverContent>
    </Popover>
  );
}
