import { cn, TimeSince } from "@qeetrix/ui";
import { useTranslation } from "react-i18next";

import type { DirectoryEvent } from "../api/directory";
import { formatDirectoryDuration } from "./directory-ui";

/** One sync run's figures and outcome, for the latest-run panel and the details sheet. */
export function EventDetails({ event, name }: { event: DirectoryEvent; name: string }) {
  const { t, i18n } = useTranslation("dashboard");
  return (
    <div className="text-xs">
      <div className="mb-3 flex items-start justify-between gap-3">
        <strong>{name}</strong>
        <TimeSince
          value={event.started_at}
          className="shrink-0 text-[10px] text-muted-foreground"
        />
      </div>
      <dl className="divide-y divide-border/50">
        {[
          [t("directory.activity.duration"), formatDirectoryDuration(event.duration_ms)],
          [t("directory.activity.users"), event.users_synced.toLocaleString(i18n.resolvedLanguage)],
          [
            t("directory.activity.groups"),
            event.groups_synced.toLocaleString(i18n.resolvedLanguage),
          ],
          [t("directory.activity.trigger"), t(`directory.activity.triggerTypes.${event.trigger}`)],
          [t("directory.activity.result"), t(`directory.activity.${event.status}`)],
        ].map(([label, value]) => (
          <div key={String(label)} className="flex justify-between gap-4 py-1.5">
            <dt className="text-muted-foreground">{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <div
        className={cn(
          "mt-3 rounded-md p-3",
          event.status === "success"
            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
            : event.status === "warning"
              ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
              : "bg-rose-500/10 text-rose-700 dark:text-rose-400",
        )}
      >
        <p className="font-medium">{t(`directory.activity.${event.status}`)}</p>
        <p className="mt-1 text-[11px]">{event.message}</p>
      </div>
    </div>
  );
}
