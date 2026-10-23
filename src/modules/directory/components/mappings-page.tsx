import { Button, cn, TimeSince } from "@qeetrix/ui";
import { Link } from "@tanstack/react-router";
import {
  ArrowRightIcon,
  CircleCheckIcon,
  CodeXmlIcon,
  LayersIcon,
  PlayIcon,
  PlusIcon,
  TriangleAlertIcon,
} from "@qeetrix/icons";
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
  DirectorySelect,
  DirectoryStat,
  DirectoryStatus,
} from "./directory-ui";
import { MappingEditor } from "./mappings-page-editor";
import { MappingPreviewPanel } from "./mappings-page-preview";
import { MappingRulesTable } from "./mappings-page-rules";

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
        actionLabel: t("directory.mappings.save").toLowerCase(),
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
        actionLabel: t("directory.mappings.deleteActionLabel").toLowerCase(),
        run: () => remove.mutateAsync(mappings.map((mapping) => mapping.id)),
      });
      preview.reset();
    } catch (error) {
      report(error);
    }
  }

  // The editor opens clean rather than repeating an earlier action's error.
  function openEditor(mapping: MappingInput) {
    setLocalError(undefined);
    setDraft(mapping);
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
          openEditor({
            source_attribute: "",
            target_field: "display_name",
            value_type: "string",
            transform: "none",
            pattern: "",
            enabled: true,
            required: false,
          })
        }
        onEdit={openEditor}
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
  const mappings = data?.items ?? [];
  const active = mappings.filter((mapping) => mapping.enabled);
  const required = active.filter((mapping) => mapping.required);
  const covered = preview
    ? required.filter((mapping) => preview.profile[mapping.target_field] != null).length
    : null;

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
          icon={CodeXmlIcon}
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
        <MappingRulesTable
          mappings={mappings}
          loading={loading}
          canWrite={canWrite}
          busy={busy}
          preview={preview}
          onEdit={onEdit}
          onDelete={onDelete}
          onToggle={onToggle}
        />

        <MappingPreviewPanel
          source={source}
          onSourceChange={onSourceChange}
          preview={preview}
          onPreview={onPreview}
          previewing={previewing}
          hasActiveRules={active.length > 0}
        />
      </div>
    </div>
  );
}
