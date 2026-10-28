import { CodeXmlIcon, PlusIcon, RadioTowerIcon, ServerIcon } from "@qeetrix/icons";
import { Badge, Button, Field, formatNumber, Radio, RadioGroup, TextField } from "@qeetrix/react";
import {
  Alert,
  CodeBlock,
  DataState,
  EmptyState,
  PageContent,
  PageHeader,
  PasswordInput,
} from "@qeetrix/react/experimental";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { PageBreadcrumb, PageTabList, PageTabs } from "@/modules/dashboard";
import {
  type LogSink,
  type SinkType,
  useCreateLogSink,
  useDeleteLogSink,
  useLogSinks,
  useToggleLogSink,
} from "@/modules/security/api/log-sinks";
import { errorMessage } from "@/platform/errors/user-message";
import { useCapabilities } from "@/platform/security/capability-provider";
import {
  SensitiveActionCancelled,
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import { Detail, Failure, Item, Panel, Section } from "../security-parts";
import { When, whenText } from "../when";
import "../security.css";

const TYPES: readonly SinkType[] = ["splunk_hec", "datadog", "http"];
const TYPE_ICON = { splunk_hec: ServerIcon, datadog: RadioTowerIcon, http: CodeXmlIcon } as const;

// What a Generic HTTP destination receives: a batch of the forwarded form of audit rows
// (siem.AuditEvent; metadata only when the event has some). Example values.
const SAMPLE = JSON.stringify(
  {
    events: [
      {
        id: "bc3a1fb3-a59b-4397-9cea-d0f72c5ef43c",
        tenant_id: "6fa0b6d7-fef5-47ca-ae95-92b3bde8c366",
        action: "auth.login_succeeded",
        actor_type: "user",
        actor_user_id: "bfb60e00-3d33-403d-ba9b-6ac00696a9c8",
        resource_type: "session",
        resource_id: "4bb97c11-ce01-4e17-b447-f25ea585d0b1",
        ip: "203.0.113.24",
        user_agent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
        request_id: "ad2026f2-9bd6-4c81-af7c-5f3eac433b04",
        created_at: "2026-10-26T16:12:06.771035Z",
      },
    ],
  },
  null,
  2,
);

/** The destination's host, for its words: "Can't deliver to ingest.example.com". */
function host(endpoint: string): string {
  try {
    return new URL(endpoint).host;
  } catch {
    return endpoint;
  }
}

/**
 * Security › Monitoring › Log streams: where the audit log is sent and whether it's getting there.
 * Every 10 seconds each destination on is sent its new events, up to 100 at a time; a batch is
 * sent again until a 2xx, waiting twice as long after each failure, up to an hour (siem.go). A
 * destination gets the events from when it was added, never earlier ones. There's no way to send
 * a test event yet (a QTID gap), so the page doesn't offer one.
 */
export function LogStreamsPage() {
  const { t } = useTranslation("security");
  const canWrite = useCapabilities().can("audit.write");
  const sinks = useLogSinks();
  const [adding, setAdding] = useState(false);
  const items = sinks.data?.items ?? [];

  return (
    <PageTabs>
      <PageHeader
        breadcrumb={<PageBreadcrumb />}
        title={t("logStreams.title")}
        description={t("logStreams.description")}
        actions={
          canWrite && !adding ? (
            <Button icon={PlusIcon} onClick={() => setAdding(true)}>
              {t("logStreams.add.open")}
            </Button>
          ) : undefined
        }
        tabs={<PageTabList />}
      />
      <PageContent width="narrow">
        <Section
          title={t("logStreams.destinations.title")}
          status={sinks.data ? <Badge size="sm">{formatNumber(items.length)}</Badge> : undefined}
          description={t("logStreams.destinations.description")}
        >
          {adding ? <AddDestination onDone={() => setAdding(false)} /> : null}
          {sinks.isError ? (
            <DataState error={sinks.error} onRetry={() => sinks.refetch()} />
          ) : (
            <DataState
              loading={sinks.isLoading}
              empty={!adding && items.length === 0}
              emptyState={
                <EmptyState
                  size="section"
                  icon={RadioTowerIcon}
                  title={t("logStreams.destinations.emptyTitle")}
                  description={t("logStreams.destinations.emptyDescription")}
                  actions={
                    canWrite ? (
                      <Button icon={PlusIcon} onClick={() => setAdding(true)}>
                        {t("logStreams.add.open")}
                      </Button>
                    ) : undefined
                  }
                />
              }
            >
              {items.length ? (
                <ul className="account-rows">
                  {items.map((sink) => (
                    <Destination key={sink.id} sink={sink} canWrite={canWrite} />
                  ))}
                </ul>
              ) : null}
            </DataState>
          )}
        </Section>

        <Section title={t("logStreams.sent.title")} description={t("logStreams.sent.description")}>
          <dl className="account-details">
            <Detail label={t("logStreams.sent.events")}>{t("logStreams.sent.eventsValue")}</Detail>
            <Detail label={t("logStreams.sent.delivery")} hint={t("logStreams.sent.deliveryHint")}>
              {t("logStreams.sent.deliveryValue")}
            </Detail>
            <Detail label={t("logStreams.sent.format")} hint={t("logStreams.sent.formatHint")}>
              {t("logStreams.sent.formatValue")}
            </Detail>
          </dl>
          <CodeBlock language="json" title={t("logStreams.sent.sample")} code={SAMPLE} />
        </Section>
      </PageContent>
    </PageTabs>
  );
}

/** One destination: what it is, whether events are reaching it, and pause, resume or remove. */
function Destination({ sink, canWrite }: { sink: LogSink; canWrite: boolean }) {
  const { t } = useTranslation("security");
  const runSensitive = useSensitiveAction();
  const toggle = useToggleLogSink();
  const remove = useDeleteLogSink();
  const Icon = TYPE_ICON[sink.type] ?? CodeXmlIcon;
  const failing = !!sink.last_error && sink.enabled;
  const name = TYPES.includes(sink.type) ? t(`logStreams.type.${sink.type}.name`) : sink.type;

  const setEnabled = (enabled: boolean) =>
    runSensitive({
      capability: "audit.write",
      actionLabel: enabled ? t("logStreams.resume.action") : t("logStreams.pause.action"),
      run: () => toggle.mutateAsync({ id: sink.id, enabled }),
    }).catch(settleSensitiveAction);

  const onRemove = () =>
    runSensitive({
      capability: "audit.write",
      confirm: {
        title: t("logStreams.remove.title", { host: host(sink.endpoint) }),
        description: t("logStreams.remove.description", { host: host(sink.endpoint) }),
        confirmLabel: t("logStreams.remove.confirm"),
        tone: "destructive",
      },
      actionLabel: t("logStreams.remove.action"),
      run: () => remove.mutateAsync(sink.id),
    }).catch(settleSensitiveAction);

  const badge = !sink.enabled ? (
    <Badge size="sm">{t("logStreams.status.paused")}</Badge>
  ) : failing ? (
    <Badge size="sm" tone="danger">
      {t("logStreams.status.failing")}
    </Badge>
  ) : sink.last_forwarded_at ? (
    <Badge size="sm" tone="success">
      {t("logStreams.status.delivering")}
    </Badge>
  ) : (
    <Badge size="sm">{t("logStreams.status.waiting")}</Badge>
  );

  return (
    <>
      <Item
        icon={<Icon />}
        name={name}
        badge={badge}
        line={
          <>
            <span className="sec-mono">{sink.endpoint}</span>
            {" · "}
            {sink.last_forwarded_at ? (
              <>
                {t("logStreams.lastDelivered")} <When at={sink.last_forwarded_at} />
              </>
            ) : (
              <>
                {t("logStreams.added")} <When at={sink.created_at} />
              </>
            )}
          </>
        }
        actions={
          canWrite ? (
            <>
              <Button
                variant="ghost"
                disabled={toggle.isPending}
                onClick={() => void setEnabled(!sink.enabled)}
              >
                {sink.enabled ? t("logStreams.pause.button") : t("logStreams.resume.button")}
              </Button>
              <Button
                variant="ghost"
                tone="danger"
                disabled={remove.isPending}
                aria-label={t("logStreams.remove.label", { host: host(sink.endpoint) })}
                onClick={() => void onRemove()}
              >
                {t("logStreams.remove.button")}
              </Button>
            </>
          ) : undefined
        }
      />
      {failing ? (
        <li className="sec-sink-failure">
          <Alert tone="danger" title={t("logStreams.failing.title", { host: host(sink.endpoint) })}>
            {sink.last_forwarded_at
              ? t("logStreams.failing.since", { when: whenText(sink.last_forwarded_at) })
              : t("logStreams.failing.never")}{" "}
            {t("logStreams.failing.retry")}
            <span className="sec-raw">{sink.last_error}</span>
          </Alert>
        </li>
      ) : !sink.enabled ? (
        <li className="sec-sink-note">{t("logStreams.pausedNote")}</li>
      ) : null}
    </>
  );
}

/**
 * Add a destination, under its section's head: where to send (each kind with how its token is
 * sent), the endpoint (HTTPS, a public address) and the token, which is stored encrypted and never
 * shown again.
 */
function AddDestination({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation("security");
  const runSensitive = useSensitiveAction();
  const create = useCreateLogSink();
  const [type, setType] = useState<SinkType>("splunk_hec");
  const [endpoint, setEndpoint] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const submit = () => {
    const url = endpoint.trim();
    let valid = false;
    try {
      valid = new URL(url).protocol === "https:";
    } catch {
      valid = false;
    }
    if (!valid) return setError(t("logStreams.add.endpointInvalid"));
    setError(null);
    setFailure(null);
    runSensitive({
      capability: "audit.write",
      actionLabel: t("logStreams.add.action"),
      run: () => create.mutateAsync({ type, endpoint: url, token: token.trim() }),
    })
      .then((sink) => sink && onDone())
      .catch((err: unknown) => {
        if (!(err instanceof SensitiveActionCancelled)) setFailure(errorMessage(err));
        settleSensitiveAction(err);
      });
  };

  return (
    <Panel title={t("logStreams.add.title")} description={t("logStreams.add.description")}>
      <form
        className="account-panel-form sec-wide-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <RadioGroup
          label={t("logStreams.add.where")}
          variant="tile"
          columns={3}
          value={type}
          onValueChange={(value) => setType(TYPES.find((x) => x === value) ?? "http")}
        >
          {TYPES.map((x) => {
            const TypeIcon = TYPE_ICON[x];
            return (
              <Radio
                key={x}
                value={x}
                icon={TypeIcon}
                label={t(`logStreams.type.${x}.name`)}
                description={t(`logStreams.type.${x}.line`)}
              />
            );
          })}
        </RadioGroup>
        <div className="sec-add-form">
          <TextField
            label={t("logStreams.add.endpoint")}
            type="url"
            placeholder={t(`logStreams.type.${type}.placeholder`)}
            value={endpoint}
            onValueChange={(value) => {
              setEndpoint(value);
              setError(null);
            }}
            error={error ?? undefined}
            description={t("logStreams.add.endpointHint")}
            autoComplete="off"
            spellCheck={false}
          />
          <Field
            label={t(`logStreams.type.${type}.token`)}
            optional={type === "http"}
            description={t("logStreams.add.tokenHint")}
          >
            <PasswordInput
              autoComplete="off"
              value={token}
              onChange={(event) => setToken(event.target.value)}
            />
          </Field>
        </div>
        {failure ? <Failure>{failure}</Failure> : null}
        <div className="account-panel-actions">
          <Button variant="ghost" onClick={onDone}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" loading={create.isPending}>
            {t("logStreams.add.button")}
          </Button>
        </div>
      </form>
    </Panel>
  );
}
