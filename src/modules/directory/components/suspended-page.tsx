import { Button, buttonVariants, cn } from "@qeetrix/ui";
import { useMutation } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  Clock3Icon,
  DownloadIcon,
  FileCheckIcon,
  ShieldCheckIcon,
  TriangleAlertIcon,
  UserCheckIcon,
  UsersRoundIcon,
  XIcon,
} from "@qeetrix/icons";
import { useDeferredValue, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  DEFAULT_SUSPENDED_FILTERS,
  fetchSuspendedExport,
  safeSuspendedCsvValue,
  SUSPENSION_REASONS,
  type SuspendedDirectoryUser,
  type SuspendedFilters,
  type SuspendedUsersPage,
  type SuspensionReview,
  useReactivateUsers,
  useReviewSuspension,
  useSuspendedUsers,
} from "@/modules/users";
import { sessionStore } from "@/platform/api/client";
import { PageHeader } from "@/platform/components/page-header";
import { errorMessage } from "@/platform/errors/user-message";
import { useCapabilities } from "@/platform/security/capability-provider";
import {
  SensitiveActionCancelled,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import { exportToCsv } from "@/shared/utils/data-export";
import {
  DIRECTORY_ACTION,
  DIRECTORY_PAGE,
  DIRECTORY_PANEL,
  DirectoryQueryError,
  DirectorySearch,
  DirectorySelect,
  DirectoryStat,
} from "./directory-ui";
import { SuspendedInsights } from "./suspended-page-insights";
import { SuspensionReviewDialog } from "./suspended-page-review-dialog";
import { SuspendedTable } from "./suspended-page-table";

export function SuspendedPage() {
  const { t } = useTranslation("directory");
  const [filters, setFilters] = useState(DEFAULT_SUSPENDED_FILTERS);
  const search = useDeferredValue(filters.q);
  const query = useSuspendedUsers({ ...filters, q: search });
  const access = useCapabilities();
  const sensitive = useSensitiveAction();
  const reactivate = useReactivateUsers();
  const review = useReviewSuspension();
  const [reviewing, setReviewing] = useState<SuspendedDirectoryUser | null>(null);
  const [actionError, setActionError] = useState<string>();
  const exporting = useMutation({
    mutationFn: async () => {
      const rows = await fetchSuspendedExport(filters);
      exportToCsv("suspended-users", rows, [
        { header: "id", value: (user) => user.id },
        { header: "name", value: (user) => safeSuspendedCsvValue(user.display_name) },
        { header: "email", value: (user) => safeSuspendedCsvValue(user.email) },
        { header: "team", value: (user) => safeSuspendedCsvValue(user.team) },
        { header: "reason", value: (user) => user.reason },
        { header: "source", value: (user) => user.source },
        { header: "risk", value: (user) => user.risk },
        { header: "review", value: (user) => user.review },
        { header: "suspended_at", value: (user) => user.suspended_at },
        { header: "last_sign_in", value: (user) => user.last_sign_in },
      ]);
    },
  });
  const report = (error: unknown) => {
    if (!(error instanceof SensitiveActionCancelled)) setActionError(errorMessage(error));
  };

  async function reactivateSelected(users: SuspendedDirectoryUser[]) {
    setActionError(undefined);
    try {
      await sensitive({
        capability: "user.write",
        actionLabel: t("directory.suspended.reactivateActionLabel"),
        confirm: {
          title: t("directory.suspended.reactivateTitle", { count: users.length }),
          description: t("directory.suspended.reactivateDescription"),
          confirmLabel: t("directory.suspended.reactivate"),
          tone: "default",
        },
        run: () => reactivate.mutateAsync(users.map((user) => user.id)),
      });
    } catch (error) {
      report(error);
    }
  }

  async function saveReview(input: SuspensionReview) {
    if (!reviewing) return;
    setActionError(undefined);
    try {
      await sensitive({
        capability: "user.write",
        actionLabel: t("directory.suspended.saveReview"),
        run: () => review.mutateAsync({ id: reviewing.id, review: input }),
      });
      setReviewing(null);
    } catch (error) {
      report(error);
    }
  }

  return (
    <>
      <SuspendedView
        page={query.isError ? undefined : query.data}
        filters={filters}
        onFiltersChange={setFilters}
        loading={query.isPending}
        error={query.isError}
        busy={query.isFetching}
        retry={query.refetch}
        canWrite={access.can("user.write")}
        canReviewPolicy={access.can("policy.read")}
        currentUserId={sessionStore.getUserId()}
        onReactivate={(users) => void reactivateSelected(users)}
        onReview={(user) => {
          setActionError(undefined); // the dialog opens clean, not with an earlier failure
          setReviewing(user);
        }}
        acting={reactivate.isPending || review.isPending}
        onExport={() => {
          setActionError(undefined); // an earlier failure would hide this export's outcome
          exporting.mutate();
        }}
        exporting={exporting.isPending}
        actionError={actionError ?? (exporting.isError ? errorMessage(exporting.error) : undefined)}
      />
      {reviewing ? (
        <SuspensionReviewDialog
          key={reviewing.id}
          user={reviewing}
          busy={review.isPending}
          error={actionError}
          onSave={(input) => void saveReview(input)}
          onClose={() => setReviewing(null)}
        />
      ) : null}
    </>
  );
}

export function SuspendedView({
  page,
  filters,
  onFiltersChange,
  loading,
  error,
  busy,
  retry,
  canWrite,
  canReviewPolicy,
  currentUserId,
  onReactivate,
  onReview,
  acting,
  onExport,
  exporting,
  actionError,
}: {
  page?: SuspendedUsersPage;
  filters: SuspendedFilters;
  onFiltersChange: (filters: SuspendedFilters) => void;
  loading: boolean;
  error: boolean;
  busy: boolean;
  retry: () => unknown;
  canWrite: boolean;
  canReviewPolicy: boolean;
  currentUserId: string | null;
  onReactivate: (users: SuspendedDirectoryUser[]) => void;
  onReview: (user: SuspendedDirectoryUser) => void;
  acting: boolean;
  onExport: () => void;
  exporting: boolean;
  actionError?: string;
}) {
  const { t } = useTranslation("directory");
  const manageable = (user: SuspendedDirectoryUser) =>
    canWrite && user.can_manage && user.id !== currentUserId;
  const change = (next: Partial<SuspendedFilters>) =>
    onFiltersChange({ ...filters, ...next, offset: 0 });
  const summary = page?.summary;

  return (
    <div className={DIRECTORY_PAGE}>
      <PageHeader
        title={t("directory.suspended.title")}
        description={t("directory.suspended.description")}
        actions={
          <>
            <Button
              variant="outline"
              className={DIRECTORY_ACTION}
              onClick={onExport}
              disabled={exporting || !page?.total}
            >
              <DownloadIcon />
              {t("directory.suspended.export")}
            </Button>
            {canReviewPolicy ? (
              <Link
                to="/settings/organization/security-policy"
                className={cn(buttonVariants({ size: "sm" }), DIRECTORY_ACTION)}
              >
                <ShieldCheckIcon />
                {t("directory.suspended.policies")}
              </Link>
            ) : null}
          </>
        }
      />
      {error ? <DirectoryQueryError retry={retry} busy={busy} /> : null}
      {actionError ? (
        <p role="alert" className="text-sm text-destructive">
          {actionError}
        </p>
      ) : null}
      <section
        aria-label={t("directory.suspended.summary")}
        className="grid gap-3 @min-[460px]/directory-page:grid-cols-2 @min-[900px]/directory-page:grid-cols-5"
      >
        <DirectoryStat
          label={t("directory.suspended.total")}
          value={summary?.total}
          icon={UsersRoundIcon}
          loading={loading}
        />
        <DirectoryStat
          label={t("directory.suspended.highRisk")}
          value={summary?.high_risk}
          icon={TriangleAlertIcon}
          tone="danger"
          loading={loading}
        />
        <DirectoryStat
          label={t("directory.suspended.byPolicy")}
          value={summary?.policy}
          icon={FileCheckIcon}
          tone="warning"
          loading={loading}
        />
        <DirectoryStat
          label={t("directory.suspended.manual")}
          value={summary?.manual}
          icon={UserCheckIcon}
          tone="info"
          loading={loading}
        />
        <DirectoryStat
          label={t("directory.suspended.pending")}
          value={summary?.pending}
          icon={Clock3Icon}
          tone="info"
          loading={loading}
        />
      </section>
      <search
        aria-label={t("directory.suspended.filters")}
        className={cn(DIRECTORY_PANEL, "flex flex-wrap items-end gap-3 p-3")}
      >
        <DirectorySearch
          label={t("directory.suspended.search")}
          value={filters.q}
          onChange={(q) => change({ q })}
        />
        <DirectorySelect
          label={t("directory.suspended.reason")}
          value={filters.reason}
          onChange={(reason) => change({ reason })}
          options={[
            { value: "all", label: t("directory.suspended.allReasons") },
            ...SUSPENSION_REASONS.map((value) => ({
              value,
              label: t(`directory.suspended.reasons.${value}`),
            })),
          ]}
        />
        <DirectorySelect
          label={t("directory.suspended.source")}
          value={filters.source}
          onChange={(source) => change({ source })}
          options={[
            { value: "all", label: t("directory.suspended.allSources") },
            ...(["manual", "scim", "ldap", "policy", "unknown", "external"] as const).map(
              (value) => ({
                value,
                label: t(`directory.suspended.sources.${value}`),
              }),
            ),
          ]}
        />
        <DirectorySelect
          label={t("directory.suspended.team")}
          value={filters.team}
          onChange={(team) => change({ team })}
          options={[
            { value: "all", label: t("directory.suspended.allTeams") },
            ...(page?.teams ?? []).map((value) => ({ value, label: value })),
          ]}
        />
        <DirectorySelect
          label={t("directory.suspended.risk")}
          value={filters.risk}
          onChange={(risk) => change({ risk })}
          options={[
            { value: "all", label: t("directory.suspended.allRisks") },
            ...(["high", "medium", "low", "unknown"] as const).map((value) => ({
              value,
              label: t(`directory.suspended.risks.${value}`),
            })),
          ]}
        />
        {filters.review ? (
          <Button
            variant="ghost"
            size="sm"
            aria-label={t("directory.suspended.clearPending")}
            onClick={() => change({ review: "" })}
          >
            <XIcon />
            {t("directory.suspended.pending")}
          </Button>
        ) : null}
      </search>

      <SuspendedTable
        page={page}
        filters={filters}
        onFiltersChange={onFiltersChange}
        loading={loading}
        error={error}
        busy={busy}
        canWrite={canWrite}
        isManageable={manageable}
        acting={acting}
        onReactivate={onReactivate}
        onReview={onReview}
      />

      <SuspendedInsights
        page={page}
        isManageable={manageable}
        acting={acting}
        onReview={onReview}
        onViewPending={() => change({ review: "pending" })}
      />
    </div>
  );
}
