import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  cn,
  Field,
  FieldLabel,
  Input,
} from "@qeetrix/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  BookOpenIcon,
  ChartColumnIcon,
  CircleIcon,
  CircleQuestionMarkIcon,
  CopyIcon,
  ExternalLinkIcon,
  GlobeIcon,
  InfoIcon,
  LinkIcon,
  LoaderCircleIcon,
  RefreshCwIcon,
  ServerIcon,
  ShieldCheckIcon,
  UsersRoundIcon,
} from "@qeetrix/icons";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { StatusPill } from "@/platform/components/status-pill";
import { toastError } from "@/platform/errors/error-toast";

import { brandingKeys, saveBranding, useBranding } from "@/modules/branding";
import { useTenantId } from "@/platform/auth/session";
import { useLoginDomain } from "../api/domains";
import { orgKeys } from "../api/keys";

const GUIDE = "https://docs.qeet.in/qeet-id/custom-login-domain";

export function CustomLoginDomainTab() {
  const { t } = useTranslation("organizations");
  const tenantId = useTenantId();
  const qc = useQueryClient();
  const statusQ = useLoginDomain();

  const brandingQ = useBranding();

  const [host, setHost] = useState("");
  useEffect(() => {
    if (brandingQ.data) setHost(brandingQ.data.custom_domain ?? "");
  }, [brandingQ.data]);

  const saved = brandingQ.data?.custom_domain ?? "";
  const dirty = host.trim() !== saved;
  const [saving, setSaving] = useState(false);

  const status = statusQ.data;
  const records = status?.records ?? [];
  // Live: DNS verified, the certificate issued and the endpoint answering over HTTPS.
  const active = status?.status === "active";

  const save = async () => {
    setSaving(true);
    try {
      if (!tenantId || !brandingQ.data) return;
      // The PUT replaces all branding: merge onto it so the colours and logo survive.
      await saveBranding(tenantId, { ...brandingQ.data, custom_domain: host.trim() || null });
      toast.success(t("customLoginDomainTab.loginDomainSaved"));
      await qc.invalidateQueries({ queryKey: brandingKeys.tenant(tenantId) });
      await qc.invalidateQueries({ queryKey: orgKeys.org(tenantId) });
    } catch (err) {
      toastError(err);
    } finally {
      setSaving(false);
    }
  };

  const copy = (value: string) => {
    void navigator.clipboard.writeText(value);
    toast.success(t("workspace.domains.custom.records.copied"));
  };

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Card className="overflow-hidden border-s-4 border-s-primary">
        <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <GlobeIcon className="size-6" />
            </span>
            <div className="min-w-0">
              <p className="font-heading text-base font-semibold">
                {active
                  ? t("workspace.domains.custom.bannerLiveTitle")
                  : t("workspace.domains.custom.bannerTitle")}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {active
                  ? t("workspace.domains.custom.bannerLiveDetail")
                  : t("workspace.domains.custom.bannerDetail")}{" "}
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                  https://{saved || t("workspace.domains.custom.placeholder")}
                </code>
                .
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-start gap-2 lg:w-72 lg:self-stretch lg:justify-center lg:border-s lg:ps-5">
            <StatusPill kind={active ? "success" : saved ? "warning" : "muted"}>
              {active
                ? t("workspace.domains.custom.bannerActive")
                : saved
                  ? t("workspace.domains.custom.bannerPending")
                  : t("workspace.domains.custom.bannerNone")}
            </StatusPill>
            {/* Only a saved domain still provisioning is waiting on anything. */}
            {saved && !active && (
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground">
                  {t("workspace.domains.custom.bannerSub")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("workspace.domains.custom.bannerNote")}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Card>
            <CardHeader className="flex-row items-start gap-3 space-y-0">
              <SectionIcon icon={<LinkIcon />} />
              <div className="min-w-0">
                <CardTitle className="text-base">{t("workspace.domains.custom.title")}</CardTitle>
                <CardDescription>{t("workspace.domains.custom.detail")}</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <Field>
                <FieldLabel htmlFor="login-domain">
                  {t("workspace.domains.custom.label")}
                </FieldLabel>
                <Input
                  id="login-domain"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  placeholder={t("workspace.domains.custom.placeholder")}
                />
              </Field>
              <p className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                <InfoIcon className="mt-0.5 size-3.5 shrink-0" />
                <span>
                  {t("workspace.domains.custom.hint")}{" "}
                  <code className="rounded bg-background px-1 py-0.5">
                    https://{host.trim() || t("workspace.domains.custom.placeholder")}
                  </code>
                  .
                </span>
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-start gap-3 space-y-0">
              <SectionIcon icon={<ServerIcon />} />
              <CardTitle className="text-base">
                {t("workspace.domains.custom.steps.title")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="grid gap-4 sm:grid-cols-4">
                {(["1", "2", "3", "4"] as const).map((n, i) => (
                  <li key={n} className="flex items-start gap-2.5">
                    <span
                      className={cn(
                        "grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold",
                        i === 0
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {n}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">
                        {t(`workspace.domains.custom.steps.${n}.title`)}
                      </span>
                      <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                        {t(`workspace.domains.custom.steps.${n}.detail`)}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
              <div className="flex items-start gap-3">
                <SectionIcon icon={<ServerIcon />} />
                <div className="min-w-0">
                  <CardTitle className="text-base">
                    {t("workspace.domains.custom.records.title")}
                  </CardTitle>
                  <CardDescription>{t("workspace.domains.custom.records.detail")}</CardDescription>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0"
                render={<a href={GUIDE} target="_blank" rel="noreferrer" />}
              >
                {t("workspace.domains.custom.records.guide")} <ExternalLinkIcon />
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {records.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("workspace.domains.custom.records.none")}
                </p>
              ) : (
                records.map((r) => (
                  <div key={r.type} className="flex items-stretch gap-2">
                    <span className="grid w-20 shrink-0 place-items-center rounded-md bg-muted text-xs font-medium">
                      {r.type}
                    </span>
                    <span className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto rounded-md border bg-muted/40 px-3 py-2 font-mono text-xs">
                      <span className="shrink-0">{r.name}</span>
                      <span className="shrink-0 text-muted-foreground">→</span>
                      <span className="shrink-0">{r.value}</span>
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      onClick={() => copy(r.value)}
                    >
                      <CopyIcon /> {t("workspace.domains.custom.records.copy")}
                    </Button>
                  </div>
                ))
              )}
              <p className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                <InfoIcon className="mt-0.5 size-3.5 shrink-0" />
                {t("workspace.domains.custom.records.note")}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
              <div className="flex min-w-0 items-center gap-3">
                <SectionIcon icon={<ChartColumnIcon />} />
                <CardTitle className="text-base">
                  {t("workspace.domains.custom.provisioning.title")}
                </CardTitle>
              </div>
              <StatusPill
                kind={active ? "success" : saved ? "warning" : "muted"}
                className="shrink-0"
              >
                {active
                  ? t("workspace.domains.custom.provisioning.complete")
                  : saved
                    ? t("workspace.domains.custom.provisioning.inProgress")
                    : t("workspace.domains.custom.provisioning.notStarted")}
              </StatusPill>
            </CardHeader>
            <CardContent className="space-y-4">
              <Row
                label={t("workspace.domains.custom.provisioning.loginDomain")}
                value={saved || "—"}
              />
              <StageRow
                label={t("workspace.domains.custom.provisioning.dns")}
                done={!!status?.dns_verified}
                state={
                  status?.dns_verified
                    ? t("workspace.domains.custom.provisioning.verified")
                    : t("workspace.domains.custom.provisioning.pending")
                }
                detail={status?.dns_detail ?? ""}
              />
              <StageRow
                label={t("workspace.domains.custom.provisioning.tls")}
                done={status?.tls_state === "issued"}
                state={
                  status?.tls_state === "issued"
                    ? t("workspace.domains.custom.provisioning.tlsIssued")
                    : status?.tls_state === "pending"
                      ? t("workspace.domains.custom.provisioning.tlsPending")
                      : t("workspace.domains.custom.provisioning.tlsNotStarted")
                }
                detail={status?.tls_detail ?? ""}
              />
              <StageRow
                label={t("workspace.domains.custom.provisioning.endpoint")}
                done={status?.endpoint_state === "live"}
                state={
                  status?.endpoint_state === "live"
                    ? t("workspace.domains.custom.provisioning.endpointLive")
                    : t("workspace.domains.custom.provisioning.endpointNone")
                }
                detail={
                  status?.endpoint_state === "live"
                    ? (status.endpoint_url ?? `https://${saved}`)
                    : t("workspace.domains.custom.provisioning.endpointNoneDetail")
                }
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-start gap-3 space-y-0">
              <SectionIcon icon={<BookOpenIcon />} />
              <CardTitle className="text-base">
                {t("workspace.domains.custom.helpful.title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {(
                [
                  { id: "q1", icon: <CircleQuestionMarkIcon /> },
                  { id: "q2", icon: <ShieldCheckIcon /> },
                  { id: "q3", icon: <UsersRoundIcon /> },
                ] as const
              ).map((q) => (
                <div key={q.id} className="flex items-start gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground [&_svg]:size-4">
                    {q.icon}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {t(`workspace.domains.custom.helpful.${q.id}.title`)}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {t(`workspace.domains.custom.helpful.${q.id}.detail`)}
                    </p>
                    {q.id === "q3" ? (
                      <a
                        href={GUIDE}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                      >
                        {t("workspace.domains.custom.helpful.q3.cta")}{" "}
                        <ExternalLinkIcon className="size-3" />
                      </a>
                    ) : null}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* In-flow rather than viewport-pinned, so the bar lines up with the content column. */}
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="min-w-0 text-xs text-muted-foreground">
          {dirty ? (
            <span className="me-1 font-medium text-foreground">
              {t("workspace.general.footer.unsaved")} ·
            </span>
          ) : null}
          {t("workspace.domains.custom.footerNote")}{" "}
          <Link to="/settings/branding" className="underline">
            {t("workspace.domains.custom.footerBranding")}
          </Link>
          .
        </p>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button
            variant="outline"
            disabled={statusQ.isFetching || !saved}
            onClick={() => statusQ.refetch()}
          >
            <RefreshCwIcon className={statusQ.isFetching ? "animate-spin" : ""} />
            {statusQ.isFetching
              ? t("workspace.domains.custom.verifying")
              : t("workspace.domains.custom.verifyDns")}
          </Button>
          {/* A quiet link, so the docs don't compete with Save for emphasis. */}
          <a
            href={GUIDE}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 px-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:underline"
          >
            {t("workspace.domains.custom.guide")}
            <ExternalLinkIcon className="size-3.5" />
          </a>
          <Button disabled={!dirty || saving} onClick={save}>
            {saving ? <LoaderCircleIcon className="animate-spin" /> : null}
            {saving ? t("workspace.domains.custom.saving") : t("workspace.domains.custom.save")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function SectionIcon({ icon }: { icon: React.ReactNode }) {
  return (
    <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary [&_svg]:size-5">
      {icon}
    </span>
  );
}

/** Renders a label/value row on a fixed-width label grid, so the panel's values align. */
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[8rem_1fr] items-start gap-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-sm font-medium">{value}</span>
    </div>
  );
}

function StageRow({
  label,
  done,
  state,
  detail,
}: {
  label: string;
  done: boolean;
  state: string;
  detail: string;
}) {
  return (
    <div className="grid grid-cols-[8rem_1fr] items-start gap-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="flex min-w-0 items-start gap-2">
        <CircleIcon
          className={cn(
            "mt-0.5 size-3.5 shrink-0",
            done ? "text-emerald-500" : "text-muted-foreground/50",
          )}
        />
        <span className="min-w-0">
          <span
            className={cn(
              "block text-sm font-medium",
              done
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-amber-600 dark:text-amber-400",
            )}
          >
            {state}
          </span>
          <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{detail}</span>
        </span>
      </span>
    </div>
  );
}
