import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  cn,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TimeSince,
} from "@qeetrix/ui";
import { DataState } from "@/platform/components/data-state";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { errorMessage } from "@/platform/errors/user-message";
import {
  CircleAlertIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  DownloadIcon,
  LoaderCircleIcon,
  RefreshCwIcon,
  ShieldCheckIcon,
} from "@qeetrix/icons";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { PageHeader } from "@/platform/components/page-header";
import { api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";
import { exportToJson } from "@/shared/utils/data-export";

type ControlStatus = "pass" | "fail" | "na";

type ControlResult = {
  id: string;
  name: string;
  category: string;
  criteria: string; // the framework's reference, e.g. "CC6.1" or "A.9.4"
  status: ControlStatus;
  detail: string; // what was found; never empty
};

type EvidenceRun = {
  id: string;
  tenant_id: string;
  framework: string;
  generated_at: string;
  generated_by?: string | null;
  pass_count: number;
  fail_count: number;
  na_count: number;
  controls?: ControlResult[]; // sent by the detail endpoint, not the list
};

function statusBadge(status: ControlStatus) {
  if (status === "pass") {
    return (
      <Badge className="gap-1 border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400">
        <CircleCheckIcon className="size-3" />
        pass
      </Badge>
    );
  }
  if (status === "na") {
    return (
      <Badge variant="secondary" className="gap-1">
        <CircleDashedIcon className="size-3" />
        n/a
      </Badge>
    );
  }
  return (
    <Badge variant="destructive" className="gap-1">
      <CircleAlertIcon className="size-3" />
      fail
    </Badge>
  );
}

const SKELETON_IDS = ["a", "b", "c"] as const;

type ComplianceEvidencePageProps = {
  framework: "soc2" | "iso27001";
};

/** Renders the SOC 2 or ISO 27001 evidence screen: generate a run, then review its controls. */
export function ComplianceEvidencePage({ framework }: ComplianceEvidencePageProps) {
  const { t } = useTranslation("compliance");
  const tenantId = useTenantId();
  const qc = useQueryClient();

  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const listQ = useQuery({
    queryKey: ["compliance-evidence-list", tenantId, framework],
    queryFn: () =>
      api<{ items: EvidenceRun[] }>(`/v1/tenants/${tenantId}/compliance/${framework}/evidence`),
    enabled: !!tenantId,
  });

  const items: EvidenceRun[] = listQ.data?.items ?? [];

  // The run the user picked, else the newest: the list arrives newest first.
  const effectiveSelectedId = selectedRunId ?? items[0]?.id ?? null;

  const runQ = useQuery({
    queryKey: ["compliance-evidence-run", tenantId, effectiveSelectedId],
    queryFn: () =>
      api<EvidenceRun>(`/v1/tenants/${tenantId}/compliance/evidence/${effectiveSelectedId}`),
    enabled: !!tenantId && !!effectiveSelectedId,
  });

  const selectedRun = runQ.data;
  const controls: ControlResult[] = selectedRun?.controls ?? [];
  const total =
    (selectedRun?.pass_count ?? 0) + (selectedRun?.fail_count ?? 0) + (selectedRun?.na_count ?? 0);

  const generateM = useMutation({
    mutationFn: () => {
      if (!tenantId) throw new Error("No tenant selected");
      return api<EvidenceRun>(`/v1/tenants/${tenantId}/compliance/${framework}/evidence`, {
        method: "POST",
      });
    },
    onSuccess: (run) => {
      qc.invalidateQueries({
        queryKey: ["compliance-evidence-list", tenantId, framework],
      });
      // The POST answer already carries the controls, so it seeds the detail cache.
      qc.setQueryData(["compliance-evidence-run", tenantId, run.id], run);
      setSelectedRunId(run.id);
    },
    meta: { successMessage: "Evidence generated" },
  });

  const isGenerating = generateM.isPending;

  const handleDownloadJson = () => {
    if (selectedRun) {
      exportToJson(`evidence-${framework}`, [selectedRun]);
    }
  };

  return (
    <div className="flex min-w-0 flex-col gap-6">
      {/* Header */}
      <PageHeader
        title={t(`${framework}.title`)}
        description={t(`${framework}.description`)}
        actions={
          <Button onClick={() => generateM.mutate()} disabled={isGenerating || !tenantId}>
            {isGenerating ? <LoaderCircleIcon className="animate-spin" /> : <RefreshCwIcon />}
            {isGenerating ? t("evidence.generating") : t("evidence.generate")}
          </Button>
        }
      />

      {/* List loading skeletons */}
      {listQ.isLoading && (
        <div className="space-y-3">
          {SKELETON_IDS.map((id) => (
            <Skeleton key={id} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      )}

      {/* List error */}
      {listQ.isError && (
        <Card className="border-destructive">
          <CardContent className="p-4 text-sm text-destructive">
            {errorMessage(listQ.error)}
          </CardContent>
        </Card>
      )}

      {/* Empty state: no runs yet */}
      {!listQ.isLoading && !listQ.isError && items.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <ShieldCheckIcon className="size-10 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">{t("evidence.emptyTitle")}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t("evidence.emptyDescription")}</p>
            </div>
            <Button onClick={() => generateM.mutate()} disabled={isGenerating || !tenantId}>
              {isGenerating && <LoaderCircleIcon className="animate-spin" />}
              {t("evidence.generate")}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Shown once there is at least one run */}
      {items.length > 0 && (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>{t("evidence.stats.passing")}</CardDescription>
              </CardHeader>
              <CardContent>
                {selectedRun ? (
                  <div className="text-2xl font-semibold tracking-tight text-emerald-600 dark:text-emerald-400">
                    {selectedRun.pass_count}
                    <span className="text-base font-medium text-muted-foreground">/{total}</span>
                  </div>
                ) : (
                  <Skeleton className="h-8 w-20" />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>{t("evidence.stats.failing")}</CardDescription>
              </CardHeader>
              <CardContent>
                {selectedRun ? (
                  <div className="text-2xl font-semibold tracking-tight text-destructive">
                    {selectedRun.fail_count}
                  </div>
                ) : (
                  <Skeleton className="h-8 w-12" />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>{t("evidence.stats.notDeterminable")}</CardDescription>
              </CardHeader>
              <CardContent>
                {selectedRun ? (
                  <div className="text-2xl font-semibold tracking-tight text-muted-foreground">
                    {selectedRun.na_count}
                  </div>
                ) : (
                  <Skeleton className="h-8 w-12" />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>{t("evidence.stats.lastGenerated")}</CardDescription>
              </CardHeader>
              <CardContent>
                {selectedRun ? (
                  <TimeSince value={selectedRun.generated_at} className="text-base font-medium" />
                ) : (
                  <Skeleton className="h-6 w-28" />
                )}
              </CardContent>
            </Card>
          </div>

          {/* Controls table */}
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div>
                <CardTitle>{t("evidence.controls.title")}</CardTitle>
                <CardDescription>
                  {t("evidence.controls.count", { count: controls.length })}
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadJson}
                disabled={!selectedRun}
                aria-label={t("evidence.controls.download")}
              >
                <DownloadIcon className="mr-2 size-4" />
                {t("evidence.controls.download")}
              </Button>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <DataState
                isLoading={runQ.isLoading}
                isError={runQ.isError}
                error={runQ.error}
                isEmpty={controls.length === 0}
                emptyIcon={ShieldCheckIcon}
                emptyTitle={t("evidence.controls.empty")}
                skeletonRows={8}
              >
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("evidence.controls.columns.criteria")}</TableHead>
                      <TableHead>{t("evidence.controls.columns.control")}</TableHead>
                      <TableHead>{t("evidence.controls.columns.category")}</TableHead>
                      <TableHead>{t("evidence.controls.columns.status")}</TableHead>
                      <TableHead>{t("evidence.controls.columns.evidence")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {controls.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-mono text-xs">{c.criteria}</TableCell>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell className="text-muted-foreground">{c.category}</TableCell>
                        <TableCell>{statusBadge(c.status)}</TableCell>
                        <TableCell className="max-w-sm text-xs text-muted-foreground">
                          {c.detail}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </DataState>
            </CardContent>
          </Card>

          {/* Report history card */}
          <Card>
            <CardHeader>
              <CardTitle>{t("evidence.history.title")}</CardTitle>
              <CardDescription>
                {t("evidence.history.count", { count: items.length })}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("evidence.history.columns.generated")}</TableHead>
                    <TableHead>{t("evidence.history.columns.passing")}</TableHead>
                    <TableHead>{t("evidence.history.columns.failing")}</TableHead>
                    <TableHead>{t("evidence.history.columns.na")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((run) => {
                    const isSelected = effectiveSelectedId === run.id;
                    return (
                      <TableRow
                        key={run.id}
                        className={cn(
                          "cursor-pointer transition-colors",
                          isSelected && "bg-muted/60",
                        )}
                        onClick={() => setSelectedRunId(run.id)}
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelectedRunId(run.id);
                          }
                        }}
                        aria-selected={isSelected}
                      >
                        <TableCell>
                          <TimeSince value={run.generated_at} className="text-sm" />
                        </TableCell>
                        <TableCell className="font-medium text-emerald-600 dark:text-emerald-400">
                          {run.pass_count}
                        </TableCell>
                        <TableCell className="font-medium text-destructive">
                          {run.fail_count}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{run.na_count}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
