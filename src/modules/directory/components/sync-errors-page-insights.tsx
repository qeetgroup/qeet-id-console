import { TimeSince } from "@qeetrix/ui";
import { CircleCheckIcon } from "@qeetrix/icons";
import { useTranslation } from "react-i18next";

import type { DirectoryErrorPage } from "../api/directory";
import { DirectoryDonut, DirectoryPanel } from "./directory-ui";

const CATEGORY_COLORS = [
  "var(--color-rose-500)",
  "var(--color-orange-400)",
  "var(--color-amber-400)",
  "var(--color-blue-400)",
  "var(--color-slate-400)",
];

/** Errors by category, the connections raising the most, and recent remediations. */
export function SyncErrorInsights({
  page,
  nameFor,
}: {
  page?: DirectoryErrorPage;
  nameFor: (connectionId: string) => string;
}) {
  const { t } = useTranslation("dashboard");
  return (
    <div className="grid gap-3 @min-[850px]/directory-page:grid-cols-3">
      <DirectoryPanel
        title={t("directory.errors.categoriesTitle")}
        description={t("directory.errors.categoriesDescription")}
      >
        <div className="flex flex-wrap items-center gap-4">
          <DirectoryDonut
            value={page ? String(page.total) : "--"}
            label={t("directory.errors.errors")}
            values={(page?.categories ?? []).map((category, index) => ({
              label: category.key,
              count: category.count,
              color: CATEGORY_COLORS[index % CATEGORY_COLORS.length] ?? "var(--muted)", // fallback unreachable
            }))}
          />
          <dl className="min-w-28 flex-1 space-y-2 text-xs">
            {page?.categories.map((category) => (
              <div key={category.key} className="flex justify-between gap-3">
                <dt className="text-muted-foreground">
                  {t(`directory.errors.categories.${category.key}`, {
                    defaultValue: category.key,
                  })}
                </dt>
                <dd className="tabular-nums">{category.count}</dd>
              </div>
            ))}
          </dl>
        </div>
      </DirectoryPanel>
      <DirectoryPanel
        title={t("directory.errors.connectionsTitle")}
        description={t("directory.errors.connectionsDescription")}
      >
        <div className="space-y-3">
          {page?.connections.slice(0, 5).map((connection) => (
            <div
              key={connection.key}
              className="grid grid-cols-[minmax(0,1fr)_minmax(3rem,1fr)_auto] items-center gap-3 text-xs"
            >
              <span className="truncate" title={nameFor(connection.key)}>
                {nameFor(connection.key)}
              </span>
              <progress
                className="h-2 w-full overflow-hidden rounded-full [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:bg-rose-400 [&::-moz-progress-bar]:bg-rose-400"
                value={connection.count}
                max={Math.max(1, page.connections[0]?.count ?? 1)}
                aria-label={nameFor(connection.key)}
              />
              <span className="tabular-nums">{connection.count}</span>
            </div>
          ))}
          {!page?.connections.length ? (
            <p className="py-10 text-center text-xs text-muted-foreground">
              {t("directory.errors.empty")}
            </p>
          ) : null}
        </div>
      </DirectoryPanel>
      <DirectoryPanel title={t("directory.errors.remediationTitle")}>
        <ul className="space-y-3">
          {page?.remediations.map((event) => (
            <li key={event.id} className="flex items-start gap-2">
              <CircleCheckIcon className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <div className="min-w-0 flex-1">
                <p className="text-xs">{nameFor(event.connection_id)}</p>
                <p className="text-[10px] text-muted-foreground">
                  {t(`directory.errors.${event.resolution}`)}
                </p>
              </div>
              {event.resolved_at ? (
                <TimeSince
                  value={event.resolved_at}
                  className="shrink-0 text-[10px] text-muted-foreground"
                />
              ) : null}
            </li>
          ))}
        </ul>
        {!page?.remediations.length ? (
          <p className="py-10 text-center text-xs text-muted-foreground">
            {t("directory.errors.noRemediation")}
          </p>
        ) : null}
      </DirectoryPanel>
    </div>
  );
}
