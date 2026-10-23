import { Button, TimeSince } from "@qeetrix/ui";
import { ChevronRightIcon } from "@qeetrix/icons";
import { useTranslation } from "react-i18next";

import type { SuspendedDirectoryUser, SuspendedUsersPage } from "@/modules/users";
import { DirectoryDonut, DirectoryPanel } from "./directory-ui";
import { SuspendedUserAvatar } from "./suspended-page-table";

const REASON_COLORS = [
  "var(--color-rose-500)",
  "var(--color-orange-400)",
  "var(--color-blue-400)",
  "var(--color-emerald-500)",
  "var(--color-violet-400)",
  "var(--color-slate-400)",
];

function riskColor(risk: string): string {
  return risk === "high"
    ? "var(--color-rose-500)"
    : risk === "medium"
      ? "var(--color-amber-400)"
      : risk === "low"
        ? "var(--color-emerald-500)"
        : "var(--color-slate-400)";
}

/** Why people were suspended, who awaits review, and how risky they are. */
export function SuspendedInsights({
  page,
  isManageable,
  acting,
  onReview,
  onViewPending,
}: {
  page?: SuspendedUsersPage;
  isManageable: (user: SuspendedDirectoryUser) => boolean;
  acting: boolean;
  onReview: (user: SuspendedDirectoryUser) => void;
  onViewPending: () => void;
}) {
  const { t } = useTranslation("dashboard");
  return (
    <div className="grid gap-3 @min-[850px]/directory-page:grid-cols-3">
      <DirectoryPanel
        title={t("directory.suspended.reasonsTitle")}
        description={t("directory.suspended.reasonsDescription")}
      >
        <div className="flex flex-wrap items-center gap-4">
          <DirectoryDonut
            value={page ? String(page.total) : "--"}
            label={t("directory.suspended.label")}
            values={(page?.reasons ?? []).map((reason, index) => ({
              label: reason.key,
              count: reason.count,
              color: REASON_COLORS[index % REASON_COLORS.length] ?? "var(--muted)", // fallback unreachable
            }))}
          />
          <dl className="min-w-32 flex-1 space-y-2 text-[11px]">
            {page?.reasons.map((reason) => (
              <div key={reason.key} className="flex justify-between gap-2">
                <dt className="text-muted-foreground">
                  {t(`directory.suspended.reasons.${reason.key}`, { defaultValue: reason.key })}
                </dt>
                <dd className="tabular-nums">{reason.count}</dd>
              </div>
            ))}
          </dl>
        </div>
      </DirectoryPanel>
      <DirectoryPanel
        title={t("directory.suspended.queueTitle")}
        description={t("directory.suspended.queueDescription")}
      >
        <ul className="space-y-3">
          {page?.queue.map((user) => (
            <li key={user.id}>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md text-start outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default"
                onClick={() => onReview(user)}
                disabled={!isManageable(user) || acting}
              >
                <SuspendedUserAvatar user={user} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium">
                    {user.display_name || user.email}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {t(`directory.suspended.reasons.${user.reason}`)}
                  </span>
                </span>
                {user.suspended_at ? (
                  <TimeSince
                    value={user.suspended_at}
                    className="text-[10px] text-muted-foreground"
                  />
                ) : null}
                {isManageable(user) ? (
                  <ChevronRightIcon className="size-3.5 shrink-0 text-muted-foreground" />
                ) : null}
              </button>
            </li>
          ))}
        </ul>
        {page?.summary.pending ? (
          <Button
            variant="ghost"
            size="sm"
            className="mt-3 h-7 px-0 text-xs text-primary"
            onClick={onViewPending}
          >
            {t("directory.suspended.viewPending", { count: page.summary.pending })}
            <ChevronRightIcon />
          </Button>
        ) : (
          <p className="py-8 text-center text-xs text-muted-foreground">
            {t(page ? "directory.suspended.noPending" : "directory.notReported")}
          </p>
        )}
      </DirectoryPanel>
      <DirectoryPanel
        title={t("directory.suspended.riskTitle")}
        description={t("directory.suspended.riskDescription")}
      >
        <div className="flex flex-wrap items-center gap-4">
          <DirectoryDonut
            value={page ? String(page.total) : "--"}
            label={t("directory.suspended.label")}
            values={(page?.risks ?? []).map((risk) => ({
              label: risk.key,
              count: risk.count,
              color: riskColor(risk.key),
            }))}
          />
          <dl className="min-w-28 flex-1 space-y-3 text-xs">
            {page?.risks.map((risk) => (
              <div key={risk.key} className="flex justify-between gap-3">
                <dt className="text-muted-foreground">
                  {t(`directory.suspended.risks.${risk.key}`)}
                </dt>
                <dd className="tabular-nums">{risk.count}</dd>
              </div>
            ))}
          </dl>
        </div>
      </DirectoryPanel>
    </div>
  );
}
