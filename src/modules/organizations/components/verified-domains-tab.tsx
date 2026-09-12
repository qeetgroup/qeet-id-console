import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Field,
  FieldError,
  Input,
} from "@qeetrix/ui";
import {
  AlertTriangleIcon,
  BookOpenIcon,
  CheckCircle2Icon,
  ClockIcon,
  GlobeIcon,
  Loader2Icon,
  MoreHorizontalIcon,
  PackageIcon,
  SearchIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { errorMessage } from "@/platform/errors/user-message";
import {
  type TenantDomain,
  useAddDomain,
  useDomains,
  useRemoveDomain,
  useUpdateDomainSettings,
  useVerifyDomain,
} from "../api/domains";

const DOCS = "https://docs.qeet.in/qeet-id/domains";

export function VerifiedDomainsTab() {
  const { t } = useTranslation("settings");
  const domainsQ = useDomains();
  const addM = useAddDomain();
  const verifyM = useVerifyDomain();
  const removeM = useRemoveDomain();
  const settingsM = useUpdateDomainSettings();
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");

  const items = useMemo(() => domainsQ.data?.items ?? [], [domainsQ.data?.items]);
  const rows = useMemo(
    () =>
      search.trim()
        ? items.filter((d) => d.domain.toLowerCase().includes(search.trim().toLowerCase()))
        : items,
    [items, search],
  );

  const verified = items.filter((d) => d.status === "verified").length;
  const pending = items.filter((d) => d.status === "pending").length;
  const attention = items.filter((d) => d.status === "attention").length;
  const defaults = items.filter((d) => d.is_default).length;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DomainKpi
          icon={<GlobeIcon />}
          tone="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          label={t("workspace.domains.kpis.verified")}
          value={verified}
          hint={t("workspace.domains.kpis.verifiedHint")}
        />
        <DomainKpi
          icon={<ClockIcon />}
          tone="bg-amber-500/10 text-amber-600 dark:text-amber-400"
          label={t("workspace.domains.kpis.pending")}
          value={pending}
          hint={t("workspace.domains.kpis.pendingHint")}
        />
        <DomainKpi
          icon={<AlertTriangleIcon />}
          tone="bg-destructive/10 text-destructive"
          label={t("workspace.domains.kpis.attention")}
          value={attention}
          hint={t("workspace.domains.kpis.attentionHint")}
        />
        <DomainKpi
          icon={<PackageIcon />}
          tone="bg-muted text-muted-foreground"
          label={t("workspace.domains.kpis.default")}
          value={defaults}
          hint={t("workspace.domains.kpis.defaultHint")}
        />
      </div>

      <Card>
        <CardHeader className="flex-row items-start gap-3 space-y-0">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <GlobeIcon className="size-5" />
          </span>
          <div className="min-w-0">
            <CardTitle className="text-base">{t("workspace.domains.add.title")}</CardTitle>
            <CardDescription>{t("workspace.domains.add.detail")}</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              const value = draft.trim();
              if (value) addM.mutate(value, { onSuccess: () => setDraft("") });
            }}
          >
            <Input
              className="flex-1"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={t("workspace.domains.add.placeholder")}
              aria-label={t("workspace.domains.add.title")}
              required
            />
            <Button type="submit" disabled={addM.isPending || !draft.trim()}>
              {addM.isPending ? <Loader2Icon className="animate-spin" /> : null}
              {addM.isPending
                ? t("workspace.domains.add.submitting")
                : t("workspace.domains.add.submit")}
            </Button>
          </form>
          {addM.error ? (
            <Field className="mt-2">
              <FieldError>{errorMessage(addM.error)}</FieldError>
            </Field>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
          <div className="min-w-0">
            <CardTitle className="text-base">
              {t("workspace.domains.table.title")}{" "}
              <span className="text-muted-foreground">({items.length})</span>
            </CardTitle>
            <CardDescription>{t("workspace.domains.table.subtitle")}</CardDescription>
          </div>
          <div className="relative w-full shrink-0 sm:w-56">
            <SearchIcon className="pointer-events-none absolute inset-s-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="ps-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("workspace.domains.table.search")}
              aria-label={t("workspace.domains.table.search")}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-muted-foreground">
              {t("workspace.domains.table.empty")}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-y bg-muted/40 text-xs text-muted-foreground">
                    <th className="px-4 py-2.5 text-start font-medium">
                      {t("workspace.domains.table.domain")}
                    </th>
                    <th className="px-4 py-2.5 text-start font-medium">
                      {t("workspace.domains.table.status")}
                    </th>
                    <th className="px-4 py-2.5 text-start font-medium">
                      {t("workspace.domains.table.sso")}
                    </th>
                    <th className="px-4 py-2.5 text-start font-medium">
                      {t("workspace.domains.table.jit")}
                    </th>
                    <th className="px-4 py-2.5 text-start font-medium">
                      {t("workspace.domains.table.lastChecked")}
                    </th>
                    <th className="px-4 py-2.5 text-end font-medium">
                      {t("workspace.domains.table.actions")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((d) => (
                    <tr key={d.id} className="border-b align-middle last:border-0">
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-2">
                          <span className="font-medium">{d.domain}</span>
                          {d.is_default ? (
                            <Badge variant="muted">{t("workspace.domains.table.default")}</Badge>
                          ) : null}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill status={d.status} />
                      </td>
                      <td className="px-4 py-3">
                        <YesNo on={d.sso_enabled} />
                      </td>
                      <td className="px-4 py-3">
                        <YesNo on={d.jit_enabled} />
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        <span className="flex items-center gap-2">
                          <span
                            className={cn(
                              "size-1.5 rounded-full",
                              d.status === "verified" ? "bg-emerald-500" : "bg-muted-foreground/40",
                            )}
                          />
                          {d.last_checked_at
                            ? new Date(d.last_checked_at).toLocaleString(undefined, {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                                hour: "numeric",
                                minute: "2-digit",
                              })
                            : t("workspace.domains.table.never")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-end">
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={t("workspace.domains.table.actions")}
                              />
                            }
                          >
                            <MoreHorizontalIcon className="size-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {d.status !== "verified" ? (
                              <DropdownMenuItem onClick={() => verifyM.mutate(d.id)}>
                                {t("workspace.domains.table.verify")}
                              </DropdownMenuItem>
                            ) : null}
                            <DropdownMenuItem
                              onClick={() =>
                                settingsM.mutate({ id: d.id, sso_enabled: !d.sso_enabled })
                              }
                            >
                              {t("workspace.domains.table.toggleSso")}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                settingsM.mutate({ id: d.id, jit_enabled: !d.jit_enabled })
                              }
                            >
                              {t("workspace.domains.table.toggleJit")}
                            </DropdownMenuItem>
                            {!d.is_default ? (
                              <DropdownMenuItem
                                onClick={() => settingsM.mutate({ id: d.id, is_default: true })}
                              >
                                {t("workspace.domains.table.makeDefault")}
                              </DropdownMenuItem>
                            ) : null}
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => removeM.mutate(d.id)}
                            >
                              {t("workspace.domains.table.remove")}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col items-start gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400">
              <BookOpenIcon className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="font-heading text-sm font-semibold">
                {t("workspace.domains.how.title")}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("workspace.domains.how.detail")}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            render={<a href={DOCS} target="_blank" rel="noreferrer" />}
          >
            {t("workspace.domains.how.cta")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function DomainKpi({
  icon,
  tone,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  tone: string;
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border bg-card p-4">
      <span
        className={cn("grid size-10 shrink-0 place-items-center rounded-lg [&_svg]:size-5", tone)}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-0.5 font-heading text-2xl font-semibold tabular-nums">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: TenantDomain["status"] }) {
  const { t } = useTranslation("settings");
  if (status === "verified") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
        <CheckCircle2Icon className="size-3.5" />
        {t("workspace.domains.table.statusVerified")}
      </span>
    );
  }
  if (status === "attention") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive">
        <AlertTriangleIcon className="size-3.5" />
        {t("workspace.domains.table.statusAttention")}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-600 dark:text-amber-400">
      <ClockIcon className="size-3.5" />
      {t("workspace.domains.table.statusPending")}
    </span>
  );
}

function YesNo({ on }: { on: boolean }) {
  const { t } = useTranslation("settings");
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-xs font-medium",
        on
          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : "bg-destructive/10 text-destructive",
      )}
    >
      {on ? t("workspace.domains.table.yes") : t("workspace.domains.table.no")}
    </span>
  );
}
