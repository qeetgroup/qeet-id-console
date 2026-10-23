import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Switch,
  TimeSince,
} from "@qeetrix/ui";
import type { TranslationKey } from "@/i18n";
import { DataState } from "@/platform/components/data-state";
import { RadioTowerIcon, TrashIcon } from "@qeetrix/icons";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { PageHeader } from "@/platform/components/page-header";
import { applyServerErrors, FormError, useAppForm } from "@/platform/forms/app-form";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import {
  type SinkType,
  useCreateLogSink,
  useDeleteLogSink,
  useLogSinks,
  useToggleLogSink,
} from "../api/log-sinks";

const TYPE_LABELS: Record<SinkType, TranslationKey> = {
  splunk_hec: "security:logStreaming.type.splunkHec",
  datadog: "security:logStreaming.type.datadog",
  http: "security:logStreaming.type.http",
};

/** Renders the audit log sinks, with add, pause and delete. */
export function LogStreamingPage() {
  const { t, i18n } = useTranslation("security");
  const runSensitive = useSensitiveAction();
  const sinksQ = useLogSinks();
  const toggleM = useToggleLogSink();
  const deleteM = useDeleteLogSink();

  const items = sinksQ.data?.items ?? [];

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader description={t("logStreaming.description")} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("logStreaming.addSink.title")}</CardTitle>
          <CardDescription>{t("logStreaming.addSink.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <AddSinkForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("logStreaming.sinks.title")}</CardTitle>
          <CardDescription>{t("logStreaming.sinks.description")}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <DataState
            isLoading={sinksQ.isLoading}
            isError={sinksQ.isError}
            error={sinksQ.error}
            isEmpty={items.length === 0}
            emptyIcon={RadioTowerIcon}
            emptyTitle={t("logStreaming.sinks.empty")}
            emptyDescription={t("logStreaming.sinks.emptyDescription")}
            skeletonRows={2}
          >
            <ul className="divide-y">
              {items.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-4 px-6 py-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      {TYPE_LABELS[s.type] ? i18n.t(TYPE_LABELS[s.type]) : s.type}
                      {s.last_error ? (
                        <Badge variant="destructive">{t("logStreaming.state.error")}</Badge>
                      ) : s.last_forwarded_at ? (
                        <Badge variant="success">{t("logStreaming.state.streaming")}</Badge>
                      ) : (
                        <Badge variant="outline">{t("logStreaming.state.idle")}</Badge>
                      )}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{s.endpoint}</p>
                    {s.last_error ? (
                      <p className="truncate text-xs text-destructive">{s.last_error}</p>
                    ) : s.last_forwarded_at ? (
                      <p className="text-xs text-muted-foreground">
                        {t("logStreaming.sinks.lastForwarded")}{" "}
                        <TimeSince value={s.last_forwarded_at} />
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={s.enabled}
                      aria-label={t("logStreamingPage.enabled")}
                      disabled={toggleM.isPending}
                      onCheckedChange={(v) =>
                        runSensitive({
                          actionLabel: t("logStreaming.sinks.toggleAction"),
                          run: () => toggleM.mutateAsync({ id: s.id, enabled: v }),
                        }).catch(settleSensitiveAction)
                      }
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={deleteM.isPending}
                      onClick={() =>
                        runSensitive({
                          confirm: {
                            title: t("logStreaming.sinks.confirmRemoveTitle"),
                            confirmLabel: t("logStreaming.sinks.confirmRemoveLabel"),
                            tone: "destructive",
                          },
                          actionLabel: t("logStreaming.sinks.removeAction"),
                          run: () => deleteM.mutateAsync(s.id),
                        }).catch(settleSensitiveAction)
                      }
                    >
                      <TrashIcon /> {t("logStreaming.sinks.remove")}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </DataState>
        </CardContent>
      </Card>
    </div>
  );
}

const SINK_TYPES: SinkType[] = ["splunk_hec", "datadog", "http"];

/** Renders the inline form that adds a log sink; its token is write-only. */
function AddSinkForm() {
  const { t, i18n } = useTranslation("security");
  const runSensitive = useSensitiveAction();
  const createM = useCreateLogSink();
  const schema = useMemo(
    () =>
      z.object({
        type: z.enum(["splunk_hec", "datadog", "http"]),
        endpoint: z.url({
          protocol: /^https?$/,
          error: t("logStreaming.addSink.validation.endpoint"),
        }),
        token: z.string(),
      }),
    [t],
  );
  const form = useAppForm({
    defaultValues: { type: "splunk_hec" as SinkType, endpoint: "", token: "" },
    validators: { onSubmit: schema },
    onSubmit: async ({ value, formApi }) => {
      await runSensitive({
        actionLabel: t("logStreaming.addSink.addAction"),
        run: () =>
          createM.mutateAsync({
            type: value.type,
            endpoint: value.endpoint.trim(),
            token: value.token.trim(),
          }),
      })
        .then((sink) => sink && formApi.reset())
        .catch((err: unknown) => {
          applyServerErrors(formApi, err);
          settleSensitiveAction(err);
        });
    },
  });

  return (
    <form
      className="flex flex-col gap-3"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="sm:w-44">
          <form.AppField name="type">
            {(field) => (
              <field.SelectField
                label={t("logStreaming.addSink.type")}
                options={SINK_TYPES.map((type) => ({
                  value: type,
                  label: i18n.t(TYPE_LABELS[type]),
                }))}
              />
            )}
          </form.AppField>
        </div>
        <div className="flex-1">
          <form.AppField name="endpoint">
            {(field) => (
              <field.TextField
                label={t("logStreaming.addSink.endpointLabel")}
                placeholder="https://http-intake.logs.datadoghq.com/api/v2/logs"
                type="url"
                required
              />
            )}
          </form.AppField>
        </div>
        <div className="sm:w-56">
          <form.AppField name="token">
            {(field) => (
              <field.PasswordField
                label={t("logStreaming.addSink.tokenLabel")}
                description={t("logStreaming.addSink.tokenHelp")}
                placeholder="write-only"
                autoComplete="off"
              />
            )}
          </form.AppField>
        </div>
        <form.AppForm>
          <form.SubmitButton>{t("logStreaming.addSink.add")}</form.SubmitButton>
        </form.AppForm>
      </div>
      <FormError error={createM.error} />
    </form>
  );
}
