import {
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Field,
  FieldError,
  FieldLabel,
  Input,
  Skeleton,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
  TimeSince,
} from "@qeetrix/ui";
import { Link } from "@tanstack/react-router";
import {
  ArrowDownIcon,
  ArrowRightIcon,
  CircleCheckIcon,
  Code2Icon,
  EllipsisIcon,
  LayersIcon,
  PencilIcon,
  PlayIcon,
  PlusIcon,
  PowerIcon,
  Trash2Icon,
  TriangleAlertIcon,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { PageHeader } from "@/platform/components/page-header";
import { errorMessage } from "@/platform/errors/user-message";
import { useCapabilities } from "@/platform/security/capability-provider";
import {
  SensitiveActionCancelled,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import {
  type DirectoryMapping,
  type DirectoryMappings,
  type MappingInput,
  type MappingPreview,
  useDeleteDirectoryMappings,
  useDirectoryConnections,
  useDirectoryMappings,
  usePreviewDirectoryMappings,
  useSaveDirectoryMapping,
} from "../api/directory";
import { type DirectoryConnection, parseMappingSource } from "../directory-model";
import {
  DIRECTORY_ACTION,
  DIRECTORY_PAGE,
  DIRECTORY_PANEL,
  DirectoryQueryError,
  DirectorySearch,
  DirectorySelect,
  DirectoryStat,
  DirectoryStatus,
} from "./directory-ui";

export function MappingsPage() {
  const connections = useDirectoryConnections();
  const [connectionId, setConnectionId] = useState("");
  const selected =
    connections.data?.find((connection) => connection.id === connectionId) ?? connections.data?.[0];
  return (
    <MappingsWorkspace
      key={selected?.id ?? "none"}
      connection={selected}
      connections={connections.data ?? []}
      onConnectionChange={setConnectionId}
      loadingConnections={connections.isPending}
      connectionError={connections.isError}
      retryConnections={connections.refetch}
    />
  );
}

function MappingsWorkspace({
  connection,
  connections,
  onConnectionChange,
  loadingConnections,
  connectionError,
  retryConnections,
}: {
  connection?: DirectoryConnection;
  connections: DirectoryConnection[];
  onConnectionChange: (id: string) => void;
  loadingConnections: boolean;
  connectionError: boolean;
  retryConnections: () => unknown;
}) {
  const { t } = useTranslation("dashboard");
  const query = useDirectoryMappings(connection?.id ?? "");
  const save = useSaveDirectoryMapping(connection?.id ?? "");
  const remove = useDeleteDirectoryMappings(connection?.id ?? "");
  const preview = usePreviewDirectoryMappings(connection?.id ?? "");
  const sensitive = useSensitiveAction();
  const canWrite = useCapabilities().can("connection.write");
  const [source, setSource] = useState("{}");
  const [draft, setDraft] = useState<MappingInput | null>(null);
  const [localError, setLocalError] = useState<string>();
  const signature =
    query.data?.items.map((mapping) => `${mapping.id}:${mapping.version}`).join("|") ?? "";
  const fingerprint = `${signature}\n${source}`;
  const currentPreview = preview.variables?.fingerprint === fingerprint ? preview.data : undefined;
  const report = (error: unknown) => {
    if (!(error instanceof SensitiveActionCancelled)) setLocalError(errorMessage(error));
  };

  async function saveRule(mapping: MappingInput) {
    setLocalError(undefined);
    try {
      await sensitive({
        capability: "connection.write",
        actionLabel: t("directory.mappings.save"),
        run: () => save.mutateAsync(mapping),
      });
      setDraft(null);
      preview.reset();
    } catch (error) {
      report(error);
    }
  }

  async function deleteRules(mappings: DirectoryMapping[]) {
    setLocalError(undefined);
    try {
      await sensitive({
        capability: "connection.write",
        confirm: {
          title: t("directory.mappings.deleteTitle", { count: mappings.length }),
          confirmLabel: t("directory.mappings.delete"),
          tone: "destructive",
        },
        run: () => remove.mutateAsync(mappings.map((mapping) => mapping.id)),
      });
      preview.reset();
    } catch (error) {
      report(error);
    }
  }

  function testMapping() {
    setLocalError(undefined);
    try {
      const input = parseMappingSource(source);
      preview.mutate({ source: input, fingerprint });
    } catch {
      setLocalError(t("directory.mappings.invalidSource"));
    }
  }

  return (
    <>
      <MappingsView
        data={query.isError ? undefined : query.data}
        connection={connection}
        connections={connections}
        onConnectionChange={onConnectionChange}
        loading={loadingConnections || (!!connection && query.isPending)}
        error={query.isError || connectionError}
        retry={connectionError ? retryConnections : query.refetch}
        canWrite={canWrite}
        busy={save.isPending || remove.isPending}
        source={source}
        onSourceChange={(value) => {
          setSource(value);
          preview.reset();
        }}
        preview={currentPreview}
        onPreview={testMapping}
        previewing={preview.isPending}
        actionError={localError ?? (preview.isError ? errorMessage(preview.error) : undefined)}
        onAdd={() =>
          setDraft({
            source_attribute: "",
            target_field: "display_name",
            value_type: "string",
            transform: "none",
            pattern: "",
            enabled: true,
            required: false,
          })
        }
        onEdit={setDraft}
        onDelete={(mappings) => void deleteRules(mappings)}
        onToggle={(mapping) => void saveRule({ ...mapping, enabled: !mapping.enabled })}
      />
      {draft ? (
        <MappingEditor
          key={draft.id ?? "new"}
          initial={draft}
          targets={query.data?.targets ?? {}}
          busy={save.isPending}
          error={localError}
          onSave={(mapping) => void saveRule(mapping)}
          onClose={() => setDraft(null)}
        />
      ) : null}
    </>
  );
}

export function MappingsView({
  data,
  connection,
  connections,
  onConnectionChange,
  loading,
  error,
  retry,
  canWrite,
  busy,
  source,
  onSourceChange,
  preview,
  onPreview,
  previewing,
  actionError,
  onAdd,
  onEdit,
  onDelete,
  onToggle,
}: {
  data?: DirectoryMappings;
  connection?: DirectoryConnection;
  connections: DirectoryConnection[];
  onConnectionChange: (id: string) => void;
  loading: boolean;
  error: boolean;
  retry: () => unknown;
  canWrite: boolean;
  busy: boolean;
  source: string;
  onSourceChange: (source: string) => void;
  preview?: MappingPreview;
  onPreview: () => void;
  previewing: boolean;
  actionError?: string;
  onAdd: () => void;
  onEdit: (mapping: DirectoryMapping) => void;
  onDelete: (mappings: DirectoryMapping[]) => void;
  onToggle: (mapping: DirectoryMapping) => void;
}) {
  const { t } = useTranslation("dashboard");
  const [search, setSearch] = useState("");
  const [state, setState] = useState("");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const mappings = data?.items ?? [];
  const active = mappings.filter((mapping) => mapping.enabled);
  const required = active.filter((mapping) => mapping.required);
  const covered = preview
    ? required.filter((mapping) => preview.profile[mapping.target_field] != null).length
    : null;
  const visible = mappings.filter(
    (mapping) =>
      (!state || mapping.enabled === (state === "active")) &&
      `${mapping.source_attribute} ${mapping.target_field}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const selectedMappings = mappings.filter((mapping) => selected.has(mapping.id));
  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className={DIRECTORY_PAGE}>
      <PageHeader
        title={t("directory.mappings.title")}
        description={t("directory.mappings.description")}
        actions={
          <>
            <Button
              variant="outline"
              className={DIRECTORY_ACTION}
              disabled={!active.length || previewing}
              onClick={onPreview}
            >
              <PlayIcon />
              {t("directory.mappings.test")}
            </Button>
            {canWrite ? (
              <Button
                className={DIRECTORY_ACTION}
                disabled={!connection || !data || busy}
                onClick={onAdd}
              >
                <PlusIcon />
                {t("directory.mappings.add")}
              </Button>
            ) : null}
          </>
        }
      />
      {error ? <DirectoryQueryError retry={retry} busy={loading} /> : null}
      {actionError ? (
        <p role="alert" className="text-sm text-destructive">
          {actionError}
        </p>
      ) : null}
      <section
        aria-label={t("directory.mappings.sourceConnection")}
        className={cn(DIRECTORY_PANEL, "flex flex-wrap items-center gap-5 p-4")}
      >
        <div className="min-w-56 flex-1">
          <p className="mb-2 text-xs font-medium">{t("directory.mappings.sourceConnection")}</p>
          <DirectorySelect
            label={t("directory.mappings.sourceConnection")}
            value={connection?.id ?? ""}
            onChange={onConnectionChange}
            options={
              connections.length
                ? connections.map((item) => ({ value: item.id, label: item.name }))
                : [{ value: "all", label: t("directory.mappings.noConnection") }]
            }
          />
        </div>
        <div className="min-w-20 border-s border-border/60 ps-5">
          <p className="text-[10px] text-muted-foreground">{t("directory.connectionsPage.type")}</p>
          <p className="mt-1 text-xs">
            {connection ? (connection.type === "scim" ? "SCIM" : "LDAP / AD") : "--"}
          </p>
        </div>
        <div className="min-w-36 border-s border-border/60 ps-5">
          <p className="text-[10px] text-muted-foreground">
            {t("directory.connectionsPage.lastSync")}
          </p>
          <div className="mt-1 text-xs">
            {connection?.lastSyncAt ? (
              <TimeSince value={connection.lastSyncAt} />
            ) : (
              t("directory.notReported")
            )}
          </div>
        </div>
        <div className="border-s border-border/60 ps-5">
          <p className="mb-1 text-[10px] text-muted-foreground">
            {t("directory.connectionsPage.status")}
          </p>
          <DirectoryStatus
            label={
              connection
                ? t(
                    `directory.connectionsPage.${connection.health === "unknown" ? connection.status : connection.health}`,
                  )
                : t("directory.notSet")
            }
            tone={connection?.health === "healthy" ? "success" : "neutral"}
          />
        </div>
        {connection ? (
          <Link
            to={connection.type === "scim" ? "/auth/connections/scim" : "/auth/connections/ldap"}
            className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("directory.connectionsPage.view")}
            <ArrowRightIcon className="size-3.5" />
          </Link>
        ) : null}
      </section>

      <section
        aria-label={t("directory.mappings.summary")}
        className="grid gap-3 @min-[460px]/directory-page:grid-cols-2 @min-[900px]/directory-page:grid-cols-4"
      >
        <DirectoryStat
          label={t("directory.mappings.active")}
          value={data ? active.length : null}
          detail={t("directory.mappings.disabledCount", { count: mappings.length - active.length })}
          icon={LayersIcon}
          tone="success"
          loading={loading}
        />
        <DirectoryStat
          label={t("directory.mappings.covered")}
          value={covered == null ? null : `${covered}/${required.length}`}
          detail={
            preview ? t("directory.mappings.validated") : t("directory.mappings.notValidated")
          }
          icon={CircleCheckIcon}
          tone="info"
          loading={loading}
        />
        <DirectoryStat
          label={t("directory.mappings.transforms")}
          value={data ? active.filter((mapping) => mapping.transform !== "none").length : null}
          detail={t("directory.mappings.transformTypes")}
          icon={Code2Icon}
          tone="info"
          loading={loading}
        />
        <DirectoryStat
          label={t("directory.mappings.warnings")}
          value={preview?.issues.length}
          detail={
            preview
              ? t(preview.valid ? "directory.mappings.valid" : "directory.mappings.review")
              : t("directory.mappings.notValidated")
          }
          icon={TriangleAlertIcon}
          tone="warning"
          loading={loading}
        />
      </section>

      <div className="grid items-start gap-3 @min-[1050px]/directory-page:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)]">
        <section className={DIRECTORY_PANEL} aria-label={t("directory.mappings.rules")}>
          <header className="flex flex-wrap items-center justify-between gap-3 p-4">
            <h2 className="font-heading text-sm font-semibold">
              {t("directory.mappings.rules")}{" "}
              <span className="text-muted-foreground">({mappings.length})</span>
            </h2>
            <div className="flex flex-wrap gap-2">
              <DirectorySearch
                label={t("directory.mappings.search")}
                value={search}
                onChange={setSearch}
              />
              <DirectorySelect
                label={t("directory.mappings.filter")}
                value={state}
                onChange={setState}
                options={[
                  { value: "all", label: t("directory.allStatuses") },
                  { value: "active", label: t("directory.mappings.activeLabel") },
                  { value: "disabled", label: t("directory.mappings.disabled") },
                ]}
              />
            </div>
          </header>
          {canWrite && selectedMappings.length ? (
            <div className="flex items-center justify-between border-y border-border bg-primary/5 px-4 py-2 text-xs">
              <span>{t("directory.mappings.selected", { count: selectedMappings.length })}</span>
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => onDelete(selectedMappings)}
              >
                <Trash2Icon />
                {t("directory.mappings.delete")}
              </Button>
            </div>
          ) : null}
          <div className="overflow-x-auto">
            <Table className="min-w-160 text-xs [&_td]:px-3 [&_td]:py-3 [&_th]:px-3 [&_th]:text-[10px]">
              <TableHeader className="border-y border-border/60 bg-muted/25">
                <TableRow>
                  {canWrite ? (
                    <TableHead>
                      <input
                        type="checkbox"
                        aria-label={t("directory.mappings.selectAll")}
                        checked={
                          visible.length > 0 && visible.every((mapping) => selected.has(mapping.id))
                        }
                        onChange={(event) =>
                          setSelected(
                            event.target.checked
                              ? new Set(visible.map((mapping) => mapping.id))
                              : new Set(),
                          )
                        }
                        className="size-3.5 accent-primary"
                      />
                    </TableHead>
                  ) : null}
                  {[
                    "source",
                    "target",
                    "type",
                    "transform",
                    "previewValue",
                    "status",
                    "actions",
                  ].map((column) => (
                    <TableHead key={column}>{t(`directory.mappings.${column}`)}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading
                  ? [0, 1, 2].map((row) => (
                      <TableRow key={row}>
                        <TableCell colSpan={8}>
                          <Skeleton className="h-8 w-full" />
                        </TableCell>
                      </TableRow>
                    ))
                  : visible.map((mapping) => (
                      <TableRow key={mapping.id}>
                        {canWrite ? (
                          <TableCell>
                            <input
                              type="checkbox"
                              aria-label={t("directory.mappings.select", {
                                field: mapping.target_field,
                              })}
                              checked={selected.has(mapping.id)}
                              onChange={() => toggle(mapping.id)}
                              className="size-3.5 accent-primary"
                            />
                          </TableCell>
                        ) : null}
                        <TableCell>
                          <code
                            className="block max-w-32 truncate rounded border border-border/60 bg-muted/20 px-2 py-1"
                            title={mapping.source_attribute}
                          >
                            {mapping.source_attribute}
                          </code>
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center gap-2">
                            <ArrowRightIcon className="size-3 shrink-0 text-muted-foreground" />
                            <code className="rounded border border-border/60 bg-muted/20 px-2 py-1">
                              {mapping.target_field}
                            </code>
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">
                            {t(`directory.mappings.types.${mapping.value_type}`)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <p>{t(`directory.mappings.transformOptions.${mapping.transform}`)}</p>
                          {mapping.pattern ? (
                            <code
                              className="mt-1 block max-w-28 truncate text-[10px] text-muted-foreground"
                              title={mapping.pattern}
                            >
                              {mapping.pattern}
                            </code>
                          ) : null}
                        </TableCell>
                        <TableCell
                          className="max-w-28 truncate"
                          title={JSON.stringify(preview?.values[mapping.id])}
                        >
                          {preview?.values[mapping.id] == null
                            ? "--"
                            : typeof preview.values[mapping.id] === "string"
                              ? String(preview.values[mapping.id])
                              : JSON.stringify(preview.values[mapping.id])}
                        </TableCell>
                        <TableCell>
                          <DirectoryStatus
                            label={t(
                              mapping.enabled
                                ? "directory.mappings.activeLabel"
                                : "directory.mappings.disabled",
                            )}
                            tone={mapping.enabled ? "success" : "neutral"}
                          />
                        </TableCell>
                        <TableCell>
                          {canWrite ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                render={
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-7"
                                    aria-label={t("directory.mappings.rowActions", {
                                      field: mapping.target_field,
                                    })}
                                    disabled={busy}
                                  />
                                }
                              >
                                <EllipsisIcon />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => onEdit(mapping)}>
                                  <PencilIcon />
                                  {t("directory.mappings.edit")}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onToggle(mapping)}>
                                  <PowerIcon />
                                  {t(
                                    mapping.enabled
                                      ? "directory.mappings.disable"
                                      : "directory.mappings.enable",
                                  )}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onDelete([mapping])}>
                                  <Trash2Icon />
                                  {t("directory.mappings.delete")}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : (
                            "--"
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                {!loading && visible.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-40 text-center text-muted-foreground">
                      {t(search || state ? "directory.noResults" : "directory.mappings.empty")}
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </section>

        <aside className={cn(DIRECTORY_PANEL, "p-4")} aria-label={t("directory.mappings.preview")}>
          <header className="mb-3 flex items-center justify-between gap-2">
            <h2 className="font-heading text-sm font-semibold">
              {t("directory.mappings.preview")}
            </h2>
            <Button
              variant="outline"
              className={DIRECTORY_ACTION}
              onClick={onPreview}
              disabled={previewing || !active.length}
            >
              <PlayIcon />
              {t("directory.mappings.testData")}
            </Button>
          </header>
          <Field>
            <FieldLabel htmlFor="directory-mapping-source" className="text-xs">
              {t("directory.mappings.sourceData")}
            </FieldLabel>
            <Textarea
              id="directory-mapping-source"
              value={source}
              onChange={(event) => onSourceChange(event.target.value)}
              maxLength={64000}
              spellCheck={false}
              className="min-h-44 resize-y bg-muted/20 font-mono text-[11px] leading-5"
            />
          </Field>
          <ArrowDownIcon className="mx-auto my-3 size-5 text-muted-foreground" aria-hidden="true" />
          <div className="rounded-md border border-border/60 bg-muted/20 p-3">
            <h3 className="mb-2 text-xs font-medium">{t("directory.mappings.mappedProfile")}</h3>
            <pre className="max-h-60 overflow-auto whitespace-pre-wrap wrap-anywhere font-mono text-[11px] leading-5">
              {JSON.stringify(preview?.profile ?? {}, null, 2)}
            </pre>
          </div>
          <div
            className={cn(
              "mt-3 rounded-md p-3 text-xs",
              !preview
                ? "bg-muted/40 text-muted-foreground"
                : preview.valid
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                  : "bg-amber-500/10 text-amber-700 dark:text-amber-400",
            )}
            role="status"
          >
            <p className="font-medium">
              {t(
                !preview
                  ? "directory.mappings.notValidated"
                  : preview.valid
                    ? "directory.mappings.valid"
                    : "directory.mappings.review",
              )}
            </p>
            {preview?.issues.map((issue, index) => (
              <p key={`${issue.mapping_id}-${index}`} className="mt-1 text-[11px]">
                {issue.field}: {issue.message}
              </p>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

export function MappingEditor({
  initial,
  targets,
  busy,
  error,
  onSave,
  onClose,
}: {
  initial: MappingInput;
  targets: Record<string, "string" | "array">;
  busy: boolean;
  error?: string;
  onSave: (mapping: MappingInput) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation("dashboard");
  const [mapping, setMapping] = useState(initial);
  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t(initial.id ? "directory.mappings.edit" : "directory.mappings.add")}
          </DialogTitle>
          <DialogDescription>{t("directory.mappings.editorDescription")}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!busy && mapping.source_attribute.trim())
              onSave({ ...mapping, source_attribute: mapping.source_attribute.trim() });
          }}
        >
          <fieldset disabled={busy} className="space-y-4">
            <Field>
              <FieldLabel htmlFor="mapping-source-field">
                {t("directory.mappings.source")}
              </FieldLabel>
              <Input
                id="mapping-source-field"
                required
                maxLength={128}
                value={mapping.source_attribute}
                onChange={(event) =>
                  setMapping({ ...mapping, source_attribute: event.target.value })
                }
              />
            </Field>
            <DirectorySelect
              label={t("directory.mappings.target")}
              value={mapping.target_field}
              onChange={(target_field) =>
                setMapping({
                  ...mapping,
                  target_field,
                  value_type: targets[target_field] ?? "string",
                })
              }
              options={Object.keys(targets).map((value) => ({
                value,
                label: t(`directory.mappings.targets.${value}`, { defaultValue: value }),
              }))}
            />
            <DirectorySelect
              label={t("directory.mappings.transform")}
              value={mapping.transform}
              onChange={(transform) =>
                setMapping({
                  ...mapping,
                  transform: transform as MappingInput["transform"],
                  pattern: transform === "extract" ? mapping.pattern : "",
                })
              }
              options={["none", "trim", "lowercase", "uppercase", "extract"].map((value) => ({
                value,
                label: t(`directory.mappings.transformOptions.${value}`),
              }))}
            />
            {mapping.transform === "extract" ? (
              <Field>
                <FieldLabel htmlFor="mapping-pattern">{t("directory.mappings.pattern")}</FieldLabel>
                <Input
                  id="mapping-pattern"
                  className="font-mono"
                  required
                  maxLength={256}
                  value={mapping.pattern}
                  onChange={(event) => setMapping({ ...mapping, pattern: event.target.value })}
                />
              </Field>
            ) : null}
            <div className="flex items-center justify-between">
              <label htmlFor="mapping-enabled" className="text-sm">
                {t("directory.mappings.activeLabel")}
              </label>
              <Switch
                id="mapping-enabled"
                checked={mapping.enabled}
                onCheckedChange={(enabled) => setMapping({ ...mapping, enabled })}
              />
            </div>
            <div className="flex items-center justify-between">
              <label htmlFor="mapping-required" className="text-sm">
                {t("directory.mappings.required")}
              </label>
              <Switch
                id="mapping-required"
                checked={mapping.required}
                onCheckedChange={(required) => setMapping({ ...mapping, required })}
              />
            </div>
            {error ? <FieldError>{error}</FieldError> : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                {t("directory.cancel")}
              </Button>
              <Button type="submit" disabled={busy || !mapping.source_attribute.trim()}>
                {t("directory.mappings.save")}
              </Button>
            </DialogFooter>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  );
}
