import {
  CopyIcon,
  EyeIcon,
  LockKeyholeIcon,
  PlusIcon,
  RotateCwIcon,
  TrashIcon,
} from "@qeetrix/icons";
import {
  Button,
  MenuItem,
  MenuSeparator,
  Select,
  Table,
  type TableColumn,
  type TableSort,
} from "@qeetrix/react";
import {
  Alert,
  type AppliedFilter,
  DataState,
  EmptyState,
  FilterTags,
  PageContent,
  PageHeader,
  Pagination,
  SearchField,
} from "@qeetrix/react/experimental";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { PageBreadcrumb } from "@/modules/dashboard";
import { useCapabilities } from "@/platform/security/capability-provider";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import { useCreateIntent } from "@/shared/hooks/use-create-intent";
import {
  type Secret,
  useDeleteSecret,
  useRevealSecret,
  useSecrets,
} from "@/modules/developer/api/secrets";
import { BandPlaceholder, useNumbers, When } from "../parts";
import { RevealDialog, RotateDrawer, SecretDrawer } from "./secret-drawers";
import { SecretsBand } from "./secrets-band";
import {
  CHANGED,
  type Changed,
  changedOf,
  looksOf,
  NO_SCOPE,
  type SecretFilters,
} from "./secrets-model";
import "../developer.css";

const PAGE_SIZES = [25, 50, 100] as const;
const ANY = "";

/**
 * Developer › Secrets: the vault agents and services read (`vault:<name>`). Values never show in
 * the list, only their last four characters; a reveal asks you to confirm it's you and is written
 * to the audit log. Rotating replaces the value at once: the server keeps no old one.
 */
export function SecretsPage({
  filters,
  onFiltersChange,
}: {
  filters: SecretFilters;
  onFiltersChange: (next: SecretFilters) => void;
}) {
  const { t } = useTranslation(["developer", "common"]);
  const { n } = useNumbers();
  const access = useCapabilities();
  const canWrite = access.can("secret.write");
  const runSensitive = useSensitiveAction();
  const secretsQ = useSecrets();
  const revealM = useRevealSecret();
  const deleteM = useDeleteSecret();
  const [creating, setCreating] = useCreateIntent(canWrite);
  const [rotating, setRotating] = useState<Secret | null>(null);
  const [revealed, setRevealed] = useState<{ secret: Secret; value: string } | null>(null);
  const [sort, setSort] = useState<TableSort | null>(null);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZES[0]);
  const [offset, setOffset] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(filters.q ?? "");
  useEffect(() => setText(filters.q ?? ""), [filters.q]);

  const all = useMemo(() => secretsQ.data?.items ?? [], [secretsQ.data]);
  const now = secretsQ.dataUpdatedAt || Date.now();
  const scopeOf = (s: Secret) => s.scope.trim() || NO_SCOPE;
  const scopes = [...new Set(all.map(scopeOf))].sort((a, b) =>
    a === NO_SCOPE ? 1 : b === NO_SCOPE ? -1 : a.localeCompare(b),
  );
  const rows = useMemo(() => {
    const q = filters.q?.trim().toLowerCase();
    const out = all.filter(
      (s) =>
        (!filters.scope || (s.scope.trim() || NO_SCOPE) === filters.scope) &&
        (!filters.changed || changedOf(s, now) === filters.changed) &&
        (!filters.look || looksOf(s, now).includes(filters.look)) &&
        (!q || `${s.name} ${s.scope}`.toLowerCase().includes(q)),
    );
    const dir = sort?.direction === "descending" ? -1 : 1;
    const by: Record<string, (a: Secret, b: Secret) => number> = {
      name: (a, b) => a.name.localeCompare(b.name),
      scope: (a, b) => a.scope.localeCompare(b.scope),
      changed: (a, b) => Date.parse(a.updated_at) - Date.parse(b.updated_at),
      added: (a, b) => Date.parse(a.created_at) - Date.parse(b.created_at),
    };
    const compare = sort ? by[sort.column] : undefined;
    return compare ? [...out].sort((a, b) => compare(a, b) * dir) : out;
  }, [all, filters, now, sort]);
  const start = offset < rows.length ? offset : 0;
  const onPage = rows.slice(start, start + pageSize);
  const change = (next: SecretFilters) => {
    setOffset(0);
    onFiltersChange(next);
  };
  const set = (patch: Partial<SecretFilters>) => change({ ...filters, ...patch });
  const scopeLabel = (scope: string) => (scope === NO_SCOPE ? t("secrets.noScope") : scope);

  const reveal = (s: Secret) =>
    void runSensitive({
      capability: "secret.read",
      actionLabel: t("secrets.reveal.action"),
      run: () => revealM.mutateAsync(s.id),
    })
      .then((res) => res && setRevealed({ secret: s, value: res.value }))
      .catch(settleSensitiveAction);
  const remove = (s: Secret) =>
    void runSensitive({
      confirm: {
        title: t("secrets.delete.title", { name: s.name }),
        description: t("secrets.delete.description", { name: s.name }),
        confirmLabel: t("secrets.delete.confirm"),
        tone: "destructive",
      },
      capability: "secret.write",
      actionLabel: t("secrets.delete.action"),
      run: () => deleteM.mutateAsync(s.id),
    }).catch(settleSensitiveAction);
  const copyName = (s: Secret) =>
    void navigator.clipboard
      .writeText(s.name)
      .then(() => toast.success(t("machine.actions.copied")))
      .catch(() => toast.error(t("machine.actions.copyFailed")));

  const columns: TableColumn<Secret>[] = [
    {
      id: "name",
      header: t("secrets.columns.name"),
      primary: true,
      sortable: true,
      cell: (s) => (
        <span className="dev-name">
          <code className="dev-strong-code">{s.name}</code>
          <span className="dev-ident">
            <code>vault:{s.name}</code>
          </span>
        </span>
      ),
    },
    {
      id: "scope",
      header: t("secrets.columns.scope"),
      sortable: true,
      width: 160,
      cell: (s) => (s.scope.trim() ? s.scope : <span className="dev-subtle">—</span>),
    },
    {
      id: "value",
      header: t("secrets.columns.value"),
      width: 140,
      cell: (s) =>
        s.last4 ? (
          <code className="dev-masked">
            <span aria-hidden="true">•••• {s.last4}</span>
            <span className="dev-hidden">{t("secrets.endsIn", { last4: s.last4 })}</span>
          </code>
        ) : (
          <span className="dev-subtle" title={t("secrets.shortHint")}>
            ••••
          </span>
        ),
    },
    {
      id: "changed",
      header: t("secrets.columns.changed"),
      sortable: true,
      sortFirst: "descending",
      width: 150,
      cell: (s) =>
        s.updated_at === s.created_at ? (
          <span className="dev-subtle">{t("secrets.neverChanged")}</span>
        ) : (
          <When at={s.updated_at} now={now} />
        ),
    },
    {
      id: "added",
      header: t("secrets.columns.added"),
      sortable: true,
      sortFirst: "descending",
      width: 140,
      cell: (s) => <When at={s.created_at} now={now} />,
    },
  ];

  const tags: AppliedFilter[] = [];
  if (filters.scope)
    tags.push({ id: "scope", label: t("secrets.columns.scope"), value: scopeLabel(filters.scope) });
  if (filters.changed)
    tags.push({
      id: "changed",
      label: t("secrets.columns.changed"),
      value: t(`secrets.changed.${filters.changed}`),
    });
  if (filters.look)
    tags.push({
      id: "look",
      label: t("machine.band.needsALook"),
      value: t(`secrets.looks.${filters.look}`),
    });

  return (
    <>
      <PageHeader
        breadcrumb={<PageBreadcrumb />}
        title={t("secrets.title")}
        count={secretsQ.data ? all.length : undefined}
        description={t("secrets.description")}
        actions={
          canWrite ? (
            <Button icon={PlusIcon} onClick={() => setCreating(true)}>
              {t("secrets.new")}
            </Button>
          ) : undefined
        }
        summary={
          secretsQ.isError ? undefined : !secretsQ.data ? (
            <BandPlaceholder cells={4} />
          ) : (
            <SecretsBand all={all} now={now} />
          )
        }
      />
      <PageContent>
        <div className="ppl dev-page">
          {!canWrite ? (
            <Alert tone="info" icon={EyeIcon} title={t("common:readOnlyNotice.title")}>
              {t("common:readOnlyNotice.description")}
            </Alert>
          ) : null}
          {secretsQ.isError ? (
            <DataState error={secretsQ.error} onRetry={() => void secretsQ.refetch()} />
          ) : (
            <>
              <Table<Secret>
                label={t("secrets.title")}
                rows={onPage}
                rowId={(s) => s.id}
                rowLabel={(s) => s.name}
                columns={columns}
                sort={sort}
                onSortChange={setSort}
                loading={secretsQ.isLoading}
                toolbar={
                  all.length ? (
                    <div className="ppl-toolbar">
                      <div className="ppl-filters">
                        <SearchField
                          ref={searchRef}
                          className="ppl-search"
                          aria-label={t("secrets.search")}
                          placeholder={t("secrets.search")}
                          value={text}
                          onValueChange={setText}
                          onSearch={(q) => set({ q: q.trim() || undefined })}
                        />
                        {scopes.length > 1 ? (
                          <Select
                            aria-label={t("secrets.columns.scope")}
                            className="ppl-filter"
                            value={filters.scope ?? ANY}
                            onValueChange={(v) => set({ scope: v ? String(v) : undefined })}
                            items={[
                              { value: ANY, label: t("secrets.anyScope") },
                              ...scopes.map((scope) => ({
                                value: scope,
                                label: `${scopeLabel(scope)} · ${n(all.filter((s) => scopeOf(s) === scope).length)}`,
                              })),
                            ]}
                          />
                        ) : null}
                        <Select
                          aria-label={t("secrets.columns.changed")}
                          className="ppl-filter"
                          value={filters.changed ?? ANY}
                          onValueChange={(v) =>
                            set({ changed: v ? (String(v) as Changed) : undefined })
                          }
                          items={[
                            { value: ANY, label: t("secrets.anyChanged") },
                            ...CHANGED.map((id) => ({
                              value: id,
                              label: `${t(`secrets.changed.${id}`)} · ${n(all.filter((s) => changedOf(s, now) === id).length)}`,
                            })),
                          ]}
                        />
                      </div>
                      {tags.length || filters.q ? (
                        <FilterTags
                          filters={tags}
                          onRemove={(id) => set({ [id]: undefined })}
                          onClear={() => change({ q: filters.q })}
                          returnFocusTo={searchRef}
                          summary={t("machine.filters.summary", {
                            n: n(rows.length),
                            total: n(all.length),
                          })}
                        />
                      ) : null}
                    </div>
                  ) : undefined
                }
                rowActions={(s) => (
                  <>
                    {access.can("secret.read") ? (
                      <MenuItem
                        icon={EyeIcon}
                        description={t("secrets.reveal.hint")}
                        onClick={() => reveal(s)}
                      >
                        {t("secrets.reveal.menu")}
                      </MenuItem>
                    ) : null}
                    {canWrite ? (
                      <MenuItem icon={RotateCwIcon} onClick={() => setRotating(s)}>
                        {t("secrets.rotate.menu")}
                      </MenuItem>
                    ) : null}
                    <MenuItem icon={CopyIcon} onClick={() => copyName(s)}>
                      {t("secrets.copyName")}
                    </MenuItem>
                    {canWrite ? (
                      <>
                        <MenuSeparator />
                        <MenuItem icon={TrashIcon} tone="danger" onClick={() => remove(s)}>
                          {t("secrets.delete.menu")}
                        </MenuItem>
                      </>
                    ) : null}
                  </>
                )}
                empty={
                  all.length ? (
                    <EmptyState
                      size="section"
                      icon={LockKeyholeIcon}
                      title={t("machine.empty.filteredTitle")}
                      description={t("machine.empty.filteredDescription")}
                      actions={
                        <Button variant="ghost" onClick={() => change({})}>
                          {t("machine.empty.clear")}
                        </Button>
                      }
                    />
                  ) : (
                    <EmptyState
                      size="section"
                      icon={LockKeyholeIcon}
                      title={t("secrets.empty.title")}
                      description={t("secrets.empty.description")}
                      actions={
                        canWrite ? (
                          <Button icon={PlusIcon} onClick={() => setCreating(true)}>
                            {t("secrets.new")}
                          </Button>
                        ) : undefined
                      }
                    />
                  )
                }
              />
              {rows.length > PAGE_SIZES[0] ? (
                <Pagination
                  offset={start}
                  pageSize={pageSize}
                  itemsOnPage={onPage.length}
                  total={rows.length}
                  onOffsetChange={setOffset}
                  pageSizes={PAGE_SIZES}
                  onPageSizeChange={(size) => {
                    setPageSize(size);
                    setOffset(0);
                  }}
                />
              ) : null}
            </>
          )}
        </div>
      </PageContent>

      {canWrite ? (
        <>
          <SecretDrawer open={creating} onOpenChange={setCreating} taken={all.map((s) => s.name)} />
          <RotateDrawer secret={rotating} now={now} onClose={() => setRotating(null)} />
        </>
      ) : null}
      <RevealDialog revealed={revealed} onClose={() => setRevealed(null)} />
    </>
  );
}
