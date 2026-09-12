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
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  BarChart3Icon,
  BookOpenIcon,
  CircleIcon,
  CopyIcon,
  ExternalLinkIcon,
  GlobeIcon,
  HelpCircleIcon,
  InfoIcon,
  LinkIcon,
  Loader2Icon,
  RefreshCwIcon,
  ServerIcon,
  ShieldCheckIcon,
  UsersRoundIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";
import { useLoginDomain } from "../api/domains";

const GUIDE = "https://docs.qeet.in/qeet-id/custom-login-domain";

type Branding = { custom_domain?: string | null };

export function CustomLoginDomainTab() {
  const { t } = useTranslation("settings");
  const tenantId = useTenantId();
  const qc = useQueryClient();
  const statusQ = useLoginDomain();

  const brandingQ = useQuery({
    queryKey: ["branding", tenantId],
    enabled: !!tenantId,
    queryFn: () => api<Branding>(`/v1/tenants/${tenantId}/branding`),
  });

  const [host, setHost] = useState("");
  useEffect(() => {
    if (brandingQ.data) setHost(brandingQ.data.custom_domain ?? "");
  }, [brandingQ.data]);

  const saved = brandingQ.data?.custom_domain ?? "";
  const dirty = host.trim() !== saved;
  const [saving, setSaving] = useState(false);

  const status = statusQ.data;
  const records = status?.records ?? [];

  const save = async () => {
    setSaving(true);
    try {
      // Full-replace PUT: merge onto the current branding so saving a domain
      // here can't blank the colours and logo set on the Branding screen.
      await api(`/v1/tenants/${tenantId}/branding`, {
        method: "PUT",
        body: { ...(brandingQ.data ?? {}), custom_domain: host.trim() || null },
      });
      toast.success("Login domain saved");
      await qc.invalidateQueries({ queryKey: ["branding", tenantId] });
      await qc.invalidateQueries({ queryKey: ["domains"] });
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
                {t("workspace.domains.custom.bannerTitle")}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("workspace.domains.custom.bannerDetail")}{" "}
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                  https://{saved || t("workspace.domains.custom.placeholder")}
                </code>
                .
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-start gap-2 lg:w-72 lg:self-stretch lg:justify-center lg:border-s lg:ps-5">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-600 dark:text-amber-400">
              <CircleIcon className="size-3" />
              {status?.status === "active"
                ? t("workspace.domains.custom.bannerActive")
                : saved
                  ? t("workspace.domains.custom.bannerPending")
                  : t("workspace.domains.custom.bannerNone")}
            </span>
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">
                {t("workspace.domains.custom.bannerSub")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("workspace.domains.custom.bannerNote")}
              </p>
            </div>
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
                <SectionIcon icon={<BarChart3Icon />} />
                <CardTitle className="text-base">
                  {t("workspace.domains.custom.provisioning.title")}
                </CardTitle>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                <CircleIcon className="size-3" />
                {t("workspace.domains.custom.provisioning.inProgress")}
              </span>
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
                  status?.tls_state === "pending"
                    ? t("workspace.domains.custom.provisioning.tlsPending")
                    : t("workspace.domains.custom.provisioning.tlsNotStarted")
                }
                detail={status?.tls_detail ?? ""}
              />
              <StageRow
                label={t("workspace.domains.custom.provisioning.endpoint")}
                done={status?.endpoint_state === "live"}
                state={t("workspace.domains.custom.provisioning.endpointNone")}
                detail={t("workspace.domains.custom.provisioning.endpointNoneDetail")}
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
                  { id: "q1", icon: <HelpCircleIcon /> },
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

      {/* In-flow, not `fixed inset-x-0`: a viewport-pinned bar spanned the whole
          window including under the sidebar, so it never lined up with the
          content column it belongs to. */}
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
          {/* A docs link shouldn't compete with Save for emphasis, so it's a
              quiet link rather than a third solid button. */}
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
            {saving ? <Loader2Icon className="animate-spin" /> : null}
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

/**
 * Rows in the provisioning panel share one grid so every value starts at the
 * same x position. `justify-between` pushed each value to the right edge, which
 * left the column ragged because the labels differ in width.
 */
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
