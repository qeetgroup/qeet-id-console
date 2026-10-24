import { cn } from "@qeetrix/ui";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { DirectoryEventPage } from "../api/directory";
import { DirectoryPanel } from "./directory-ui";

/** Daily synced users or groups, one series at a time. */
export function SyncVolumePanel({ volume }: { volume?: DirectoryEventPage["volume"] }) {
  const { t } = useTranslation("directory");
  const [series, setSeries] = useState<"users" | "groups">("users");
  return (
    <DirectoryPanel
      title={t("directory.activity.volumeTitle")}
      description={t("directory.activity.volumeDescription")}
      action={
        <fieldset className="flex shrink-0 rounded-md border border-border bg-muted/30 p-0.5">
          <legend className="sr-only">{t("directory.activity.series")}</legend>
          {(["users", "groups"] as const).map((value) => (
            <button
              type="button"
              key={value}
              aria-pressed={series === value}
              className={cn(
                "rounded-sm px-3 py-1 text-[10px] outline-none focus-visible:ring-2 focus-visible:ring-ring",
                series === value && "bg-primary/10 text-primary",
              )}
              onClick={() => setSeries(value)}
            >
              {t(`directory.activity.${value}`)}
            </button>
          ))}
        </fieldset>
      }
    >
      {volume?.length ? (
        <div className="h-48 w-full" role="img" aria-label={t("directory.activity.volumeTitle")}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={volume}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                tickFormatter={(value: string) => value.slice(5)}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
                width={38}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--card)",
                  borderColor: "var(--border)",
                  color: "var(--foreground)",
                }}
              />
              <Bar
                dataKey={series}
                fill={series === "users" ? "var(--color-blue-400)" : "var(--color-violet-400)"}
                maxBarSize={24}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="grid h-48 place-items-center text-xs text-muted-foreground">
          {t("directory.activity.emptyVolume")}
        </div>
      )}
    </DirectoryPanel>
  );
}
