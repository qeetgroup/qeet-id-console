// All users, filtered to Suspended: the same page, with what matters for a suspension — why, how
// risky, since when and whether it's been reviewed. GET /v1/users/suspended searches, filters and
// pages on the server, so this view asks it rather than the loaded directory.

import { ShieldCheckIcon, UserCheckIcon, UserRoundIcon, UserXIcon } from "@qeetrix/icons";
import {
  Badge,
  Button,
  Checkbox,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  Field,
  formatDateTime,
  formatRelativeTime,
  MenuItem,
  MenuSeparator,
  Select,
  Table,
  type TableColumn,
  Text,
} from "@qeetrix/react";
import { Alert, AvatarItem, EmptyState, Pagination } from "@qeetrix/react/experimental";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import {
  DEFAULT_SUSPENDED_FILTERS,
  SUSPENSION_REASONS,
  type SuspendedDirectoryUser,
  type SuspensionReview,
  suspensionCalls,
  useReviewSuspension,
  useSuspendedUsers,
} from "@/modules/users/api/suspended";
import type { User } from "@/modules/users/api/users";
import { type PeopleFilters, RISKS } from "@/modules/users/people-model";
import { errorMessage } from "@/platform/errors/user-message";
import {
  SensitiveActionCancelled,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import { usePeopleRun } from "./people-bulk";
import { PeopleToolbar } from "./people-toolbar";
import { useKeyedState } from "./use-keyed-state";

type Reason = (typeof SUSPENSION_REASONS)[number];
type Risk = (typeof RISKS)[number];
const PAGE_SIZES = [25, 50, 100] as const;
const RISK_TONE = {
  high: "danger",
  medium: "warning",
  low: "neutral",
  unknown: "neutral",
} as const;
const isReason = (value: string): value is Reason =>
  (SUSPENSION_REASONS as readonly string[]).includes(value);
const isRisk = (value: string): value is Risk => (RISKS as readonly string[]).includes(value);

/** Records why someone is suspended and how risky the account is; they stay suspended either way. */
function ReviewDialog({ user, onClose }: { user: SuspendedDirectoryUser; onClose: () => void }) {
  const { t } = useTranslation("users");
  const review = useReviewSuspension();
  const runSensitive = useSensitiveAction();
  const [input, setInput] = useState<SuspensionReview>({
    reason: user.reason,
    risk: user.risk,
    review: user.review === "reviewed" ? "reviewed" : "pending",
  });
  const [failure, setFailure] = useState<string | null>(null);
  const save = () => {
    setFailure(null);
    runSensitive({
      actionLabel: t("people.suspended.saveReview"),
      run: () => review.mutateAsync({ id: user.id, review: input }),
    })
      .then(onClose)
      .catch((err: unknown) => {
        if (!(err instanceof SensitiveActionCancelled)) setFailure(errorMessage(err));
      });
  };
  return (
    <Dialog open onOpenChange={(open) => !open && !review.isPending && onClose()}>
      <DialogContent
        title={t("people.suspended.reviewTitle", { name: user.display_name || user.email })}
        description={t("people.suspended.reviewDescription")}
        size="md"
      >
        <DialogBody>
          <div className="sub-form">
            {failure ? <Alert tone="danger" title={failure} /> : null}
            <Field label={t("people.suspended.reason")}>
              <Select
                value={input.reason}
                onValueChange={(value) => setInput({ ...input, reason: String(value) })}
                items={SUSPENSION_REASONS.map((key): { value: string; label: string } => ({
                  value: key,
                  label: t(`people.suspended.reasons.${key}`),
                }))}
              />
            </Field>
            <Field label={t("people.suspended.risk")} description={t("people.suspended.riskHelp")}>
              <Select
                value={input.risk}
                onValueChange={(value) => setInput({ ...input, risk: String(value) })}
                items={RISKS.map((key): { value: string; label: string } => ({
                  value: key,
                  label: t(`people.suspended.risks.${key}`),
                }))}
              />
            </Field>
            <Checkbox
              checked={input.review === "reviewed"}
              onCheckedChange={(checked) =>
                setInput({ ...input, review: checked ? "reviewed" : "pending" })
              }
              label={t("people.suspended.markReviewed")}
              description={t("people.suspended.markReviewedHelp")}
            />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={review.isPending}>
            {t("people.suspended.cancel")}
          </Button>
          <Button onClick={save} loading={review.isPending}>
            {t("people.suspended.saveReview")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function useSuspendedColumns(now: number): TableColumn<SuspendedDirectoryUser>[] {
  const { t } = useTranslation("users");
  const locale = formatLocale();
  const when = (at: string) => (
    <time dateTime={at} title={formatDateTime(at, locale)} className="ppl-nowrap">
      {formatRelativeTime(Math.min(Date.parse(at), now), locale, now)}
    </time>
  );
  return [
    {
      id: "person",
      header: t("people.columns.person"),
      primary: true,
      cell: (u) => (
        <AvatarItem
          name={u.display_name || u.email}
          description={u.email}
          src={u.avatar_url ?? undefined}
        />
      ),
    },
    {
      id: "reason",
      header: t("people.suspended.reason"),
      cell: (u) => (
        <span className="ppl-two">
          <span>{isReason(u.reason) ? t(`people.suspended.reasons.${u.reason}`) : u.reason}</span>
          <small>
            {t(
              `people.suspended.sources.${u.source === "policy" || u.source === "provider" ? u.source : "manual"}`,
            )}
          </small>
        </span>
      ),
    },
    {
      id: "risk",
      header: t("people.suspended.risk"),
      cell: (u) => {
        const risk = isRisk(u.risk) ? u.risk : "unknown";
        return (
          <Badge tone={RISK_TONE[risk]} size="sm">
            {t(`people.suspended.riskBadge.${risk}`)}
          </Badge>
        );
      },
    },
    {
      id: "since",
      header: t("people.suspended.since"),
      cell: (u) => (u.suspended_at ? when(u.suspended_at) : <Text tone="subtle">—</Text>),
    },
    {
      id: "seen",
      header: t("people.suspended.lastSignIn"),
      cell: (u) =>
        u.last_sign_in ? (
          when(u.last_sign_in)
        ) : (
          <Text tone="subtle">{t("people.suspended.never")}</Text>
        ),
    },
    {
      id: "review",
      header: t("people.suspended.review"),
      cell: (u) =>
        u.review === "pending" ? (
          <Badge tone="warning" size="sm">
            {t("people.suspended.reviews.pending")}
          </Badge>
        ) : (
          <span className="sub-done">
            <ShieldCheckIcon className="sub-done-icon" aria-hidden="true" />
            {u.review === "external"
              ? t("people.suspended.external")
              : t("people.suspended.reviews.reviewed")}
          </span>
        ),
    },
  ];
}

/** The suspended people, with the shared toolbar over them. */
export function SuspendedPeople({
  filters,
  onFiltersChange,
  users,
  canWrite,
}: {
  filters: PeopleFilters;
  onFiltersChange: (next: PeopleFilters) => void;
  users: User[];
  canWrite: boolean;
}) {
  const { t } = useTranslation("users");
  const [pageSize, setPageSize] = useState<number>(50);
  const filterKey = JSON.stringify(filters);
  const [offset, setOffset] = useKeyedState(`${filterKey}|${pageSize}`, 0);
  const [selected, setSelected] = useKeyedState<string[]>(filterKey, []);
  const [reviewing, setReviewing] = useState<SuspendedDirectoryUser | null>(null);
  const { run, running } = usePeopleRun(() => setSelected([]));
  const page = useSuspendedUsers({
    ...DEFAULT_SUSPENDED_FILTERS,
    q: filters.q ?? "",
    reason: filters.reason ?? "",
    risk: filters.risk ?? "",
    review: filters.review ?? "",
    limit: pageSize,
    offset,
  });
  const now = page.dataUpdatedAt || Date.now();
  const columns = useSuspendedColumns(now);
  const items = page.data?.items ?? [];
  const byId = new Map(items.map((u) => [u.id, u]));
  const manageable = (ids: string[]) => ids.filter((id) => byId.get(id)?.can_manage);
  const reactivate = (ids: string[]) =>
    run(t("people.suspended.reactivate"), manageable(ids), suspensionCalls.reactivate);
  const markReviewed = (ids: string[]) =>
    run(t("people.suspended.markReviewed"), manageable(ids), (id) => {
      const u = byId.get(id);
      return suspensionCalls.review(id, {
        reason: u?.reason ?? "unspecified",
        risk: u?.risk ?? "unknown",
        review: "reviewed",
      });
    });

  return (
    <>
      <Table<SuspendedDirectoryUser>
        label={t("people.suspended.label")}
        rows={items}
        rowId={(u) => u.id}
        rowLabel={(u) => u.display_name || u.email}
        columns={columns}
        selectable={canWrite}
        selected={canWrite ? selected : []}
        onSelectedChange={setSelected}
        loading={page.isLoading}
        error={
          page.isError ? (
            <EmptyState
              size="section"
              icon={UserXIcon}
              title={t("people.suspended.loadFailed")}
              description={errorMessage(page.error)}
              actions={
                <Button variant="ghost" onClick={() => page.refetch()}>
                  {t("people.suspended.retry")}
                </Button>
              }
            />
          ) : undefined
        }
        toolbar={
          <PeopleToolbar
            filters={filters}
            onFiltersChange={onFiltersChange}
            users={users}
            shown={page.data?.total ?? 0}
            suspended={page.data}
          />
        }
        bulkActions={(ids) =>
          running ? (
            <Text tone="subtle" role="status">
              {t("people.bulk.progress", {
                label: running.label,
                done: running.done,
                total: running.total,
              })}
            </Text>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                icon={UserCheckIcon}
                onClick={() => reactivate(ids)}
              >
                {t("people.suspended.reactivateN", { n: ids.length })}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                icon={ShieldCheckIcon}
                onClick={() => markReviewed(ids)}
              >
                {t("people.suspended.markReviewed")}
              </Button>
            </>
          )
        }
        rowActions={
          canWrite
            ? (u) => (
                <>
                  <MenuItem
                    icon={ShieldCheckIcon}
                    disabled={!u.can_manage}
                    onClick={() => setReviewing(u)}
                  >
                    {t("people.suspended.reviewAction")}
                  </MenuItem>
                  <MenuItem
                    icon={UserRoundIcon}
                    render={<Link to="/users/$userId" params={{ userId: u.id }} />}
                  >
                    {t("people.suspended.openProfile")}
                  </MenuItem>
                  <MenuSeparator />
                  <MenuItem
                    icon={UserCheckIcon}
                    disabled={!u.can_manage}
                    onClick={() => reactivate([u.id])}
                  >
                    {t("people.suspended.reactivate")}
                  </MenuItem>
                </>
              )
            : undefined
        }
        renderRowLink={(u) => <Link to="/users/$userId" params={{ userId: u.id }} />}
        empty={
          <EmptyState
            size="section"
            icon={UserCheckIcon}
            title={
              Object.entries(filters).some(([key, value]) => key !== "status" && value)
                ? t("people.empty.filteredTitle")
                : t("people.suspended.emptyTitle")
            }
            description={t("people.suspended.emptyDescription")}
          />
        }
      />
      {page.data && page.data.total > 0 ? (
        <Pagination
          offset={offset}
          pageSize={pageSize}
          itemsOnPage={items.length}
          total={page.data.total}
          loading={page.isFetching}
          onOffsetChange={setOffset}
          pageSizes={PAGE_SIZES}
          onPageSizeChange={setPageSize}
        />
      ) : null}
      {reviewing ? <ReviewDialog user={reviewing} onClose={() => setReviewing(null)} /> : null}
    </>
  );
}
