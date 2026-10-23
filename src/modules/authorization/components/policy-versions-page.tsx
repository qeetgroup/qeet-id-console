import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  JSONTree,
  Timeline,
  TimelineContent,
  TimelineDescription,
  TimelineIndicator,
  TimelineItem,
  TimelineTime,
  TimelineTitle,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@qeetrix/ui";
import { formatLocale } from "@/i18n";
import { DataState } from "@/platform/components/data-state";
import { RotateCcwClockIcon, RotateCcwIcon, SlidersHorizontalIcon } from "@qeetrix/icons";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { PageHeader } from "@/platform/components/page-header";
import { ComingSoon } from "./shared/coming-soon";
import { useAbacPolicies } from "../api/abac";
import { toVersionTimeline, useAuditEvents } from "../api/audit";

/** Renders each policy's change history. */
export function PolicyVersionsPage() {
  const { t } = useTranslation("authorization");
  const policiesQ = useAbacPolicies();
  const auditQ = useAuditEvents({ resource_type: "abac_policy", limit: 500 });
  const policies = policiesQ.data?.items ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const timeline = selectedId ? toVersionTimeline(auditQ.data?.items ?? [], selectedId) : [];

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader description={t("policyVersionsPage.everyPolicyChangeIs")} />

      <ComingSoon
        icon={RotateCcwIcon}
        title={t("policyVersionsPage.oneClickRollbackIsComing")}
        description={t("policyVersionsPage.theBackendRecordsEvery")}
        note={t("policyVersionsPage.revertNote")}
      />

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="text-base">{t("policyVersionsPage.policies")}</CardTitle>
            <CardDescription>{t("policyVersionsPage.selectAPolicyTo")}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <DataState
              isLoading={policiesQ.isLoading}
              isError={policiesQ.isError}
              error={policiesQ.error}
              isEmpty={policies.length === 0}
              emptyIcon={SlidersHorizontalIcon}
              emptyTitle={t("policyVersionsPage.noPoliciesToTrack")}
              skeletonRows={4}
            >
              <ul className="divide-y">
                {policies.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(p.id)}
                      aria-current={p.id === selectedId ? "true" : undefined}
                      className={`flex w-full items-center gap-2 p-3 text-left hover:bg-muted/40 ${p.id === selectedId ? "bg-muted/60" : ""}`}
                    >
                      <Badge variant={p.effect === "deny" ? "destructive" : "success"}>
                        {t(`abac.editor.${p.effect}`)}
                      </Badge>
                      <span className="truncate text-sm">{p.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </DataState>
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="text-base">{t("policyVersionsPage.changeHistory")}</CardTitle>
            <CardDescription>
              {selectedId
                ? t("policyVersionsPage.recordedChanges", { count: timeline.length })
                : t("policyVersionsPage.noPolicySelected")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedId ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t("policyVersionsPage.selectAPolicyTo2")}
              </p>
            ) : (
              <DataState
                isLoading={auditQ.isLoading}
                isError={auditQ.isError}
                error={auditQ.error}
                isEmpty={timeline.length === 0}
                emptyIcon={RotateCcwClockIcon}
                emptyTitle={t("policyVersionsPage.noChangesRecordedFor")}
                skeletonRows={3}
              >
                <Timeline>
                  {timeline.map((v) => (
                    <TimelineItem key={v.id}>
                      <TimelineIndicator>
                        <span className="size-2 rounded-full bg-primary" />
                      </TimelineIndicator>
                      <TimelineContent>
                        <div className="flex items-center gap-2">
                          <TimelineTitle className="font-mono text-xs">{v.action}</TimelineTitle>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger
                                render={
                                  <Button
                                    variant="ghost"
                                    size="xs"
                                    disabled
                                    aria-label={t("policyVersionsPage.rollbackUnavailable")}
                                  >
                                    <RotateCcwIcon />
                                  </Button>
                                }
                              />
                              <TooltipContent>
                                {t("policyVersionsPage.serverSideRollbackComingSoon")}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <TimelineDescription>
                          {t("overview.changes.byActor", { actor: v.actor.slice(0, 8) })}
                        </TimelineDescription>
                        <TimelineTime>{new Date(v.at).toLocaleString(formatLocale())}</TimelineTime>
                        {v.metadata && Object.keys(v.metadata).length > 0 && (
                          <div className="mt-2 rounded-md border bg-muted/20 p-2">
                            <JSONTree
                              value={v.metadata}
                              initialOpenDepth={1}
                              rootLabel="metadata"
                            />
                          </div>
                        )}
                      </TimelineContent>
                    </TimelineItem>
                  ))}
                </Timeline>
              </DataState>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
