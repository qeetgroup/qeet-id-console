import {
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
  TimeSince,
} from "@qeetrix/ui";
import { DataState } from "@/platform/components/data-state";
import {
  ArrowRightIcon,
  ArrowUpDownIcon,
  BookOpenIcon,
  ClockIcon,
  DatabaseIcon,
  FileTextIcon,
  PlusIcon,
  SearchIcon,
  UsersRoundIcon,
} from "@qeetrix/icons";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { FeatureGate, useEntitlements } from "@/modules/billing";
import { useDeleteSamlConnection, useSamlConnections, useUpdateSamlConnection } from "../api/saml";
import { SamlConnectionSheet } from "./saml-connection-sheet";
import { SAML_IDP_VENDOR_LABELS, type SamlIdpVendor, samlIdpVendor } from "../saml-vendors";
import { PageHeader } from "@/platform/components/page-header";
import { DOCS_URL } from "@/platform/config/site-urls";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import { ConnectionRow, ConnectionsEmptyState, StatTile } from "./saml-connection-parts";

const SAML_GUIDE_URL = `${DOCS_URL}/docs/authentication/enterprise-sso`;

type StatusFilter = "all" | "active" | "draft" | "disabled";

type VendorFilter = "all" | SamlIdpVendor;

type SortOrder = "newest" | "oldest" | "name";

const STATUS_FILTERS: StatusFilter[] = ["all", "active", "draft", "disabled"];

const SORT_ORDERS: SortOrder[] = ["newest", "oldest", "name"];

const VENDOR_FILTERS: VendorFilter[] = [
  "all",
  "okta",
  "entra",
  "onelogin",
  "google",
  "pingidentity",
  "other",
];

const SETUP_STEPS = ["metadata", "certificate", "test", "jit"] as const;

/** Renders the organization's SAML connections: stats, first-run guide, filters and the list. */
export function SamlConnectionsPage() {
  const { t } = useTranslation("authentication");
  const runSensitive = useSensitiveAction();
  const listQ = useSamlConnections();
  const updateM = useUpdateSamlConnection();
  const deleteM = useDeleteSamlConnection();
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [vendor, setVendor] = useState<VendorFilter>("all");
  const [sort, setSort] = useState<SortOrder>("newest");

  const items = listQ.data?.items ?? [];
  const active = items.filter((c) => c.status === "active").length;
  const drafts = items.filter((c) => c.status === "draft").length;
  const lastLogin = items
    .map((c) => c.last_login_at)
    .filter(Boolean)
    .sort()
    .at(-1);
  const ssoLocked = useEntitlements().data?.features.sso === false;

  const needle = query.trim().toLowerCase();
  const visible = items
    .filter((c) => {
      if (status !== "all" && c.status !== status) return false;
      if (vendor !== "all" && samlIdpVendor(c) !== vendor) return false;
      if (!needle) return true;
      return (
        c.name.toLowerCase().includes(needle) ||
        c.idp_entity_id.toLowerCase().includes(needle) ||
        c.idp_sso_url.toLowerCase().includes(needle)
      );
    })
    .sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      const delta = a.created_at.localeCompare(b.created_at);
      return sort === "oldest" ? delta : -delta;
    });

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PageHeader
        description={t("samlSp.description")}
        actions={
          ssoLocked ? undefined : (
            <Button size="sm" onClick={() => setCreating(true)}>
              <PlusIcon /> {t("samlSp.newButton")}
            </Button>
          )
        }
      />

      <FeatureGate
        feature="sso"
        title={t("samlSp.gate.title")}
        description={t("samlSp.gate.description")}
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            icon={UsersRoundIcon}
            tone="success"
            label={t("samlSp.stats.active")}
            value={active}
          />
          <StatTile
            icon={DatabaseIcon}
            tone="neutral"
            label={t("samlSp.stats.total")}
            value={items.length}
          />
          <StatTile
            icon={FileTextIcon}
            tone="warning"
            label={t("samlSp.stats.draft")}
            value={drafts}
          />
          <StatTile
            icon={ClockIcon}
            tone="violet"
            label={t("samlSp.stats.lastLogin")}
            value={lastLogin ? <TimeSince value={lastLogin} /> : t("samlSp.stats.never")}
          />
        </div>

        {/* First-run guidance: retires itself once a connection exists. */}
        {!listQ.isLoading && items.length === 0 && (
          <div className="grid gap-6 rounded-xl border border-primary/15 bg-primary/4 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
            <div className="flex items-start gap-4">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <BookOpenIcon className="size-6" />
              </span>
              <div className="min-w-0">
                <p className="font-heading text-base font-semibold">
                  {t("samlSp.gettingStarted.title")}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("samlSp.gettingStarted.description")}
                </p>
              </div>
            </div>
            <ol className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 xl:divide-x xl:divide-border/70">
              {SETUP_STEPS.map((step, index) => (
                <li key={step} className="flex items-start gap-2.5 xl:not-first:ps-4">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-background text-[11px] font-semibold text-muted-foreground ring-1 ring-border">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold">
                      {t(`samlSp.gettingStarted.steps.${step}.title`)}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t(`samlSp.gettingStarted.steps.${step}.description`)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}

        <Card>
          <CardHeader className="gap-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-heading text-base font-semibold">{t("samlSp.list.title")}</p>
                <p className="mt-1 text-sm text-muted-foreground">{t("samlSp.list.description")}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-0 flex-1 sm:w-52 sm:flex-none">
                  <SearchIcon
                    className="pointer-events-none absolute inset-s-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    type="search"
                    aria-label={t("samlSp.filters.searchLabel")}
                    placeholder={t("samlSp.filters.searchPlaceholder")}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="ps-9 [&::-webkit-search-cancel-button]:appearance-none"
                  />
                </div>
                <Select value={status} onValueChange={(v) => v && setStatus(v as StatusFilter)}>
                  <SelectTrigger className="w-36" aria-label={t("samlSp.filters.statusLabel")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_FILTERS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {t(`samlSp.filters.status.${s}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={vendor} onValueChange={(v) => v && setVendor(v as VendorFilter)}>
                  <SelectTrigger className="w-40" aria-label={t("samlSp.filters.vendorLabel")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VENDOR_FILTERS.map((v) => (
                      <SelectItem key={v} value={v}>
                        {v === "all"
                          ? t("samlSp.filters.vendorAll")
                          : v === "other"
                            ? t("samlSp.filters.vendorOther")
                            : SAML_IDP_VENDOR_LABELS[v]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={sort} onValueChange={(v) => v && setSort(v as SortOrder)}>
                  <SelectTrigger className="w-40" aria-label={t("samlSp.filters.sortLabel")}>
                    <span className="flex min-w-0 items-center gap-2">
                      <ArrowUpDownIcon className="size-4 shrink-0 text-muted-foreground" />
                      <SelectValue />
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {SORT_ORDERS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {t(`samlSp.filters.sort.${s}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <DataState
              isLoading={listQ.isLoading}
              isError={listQ.isError}
              error={listQ.error}
              isEmpty={visible.length === 0}
              empty={
                <ConnectionsEmptyState
                  filtered={items.length > 0}
                  onCreate={() => setCreating(true)}
                />
              }
              skeletonRows={3}
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("samlSp.columns.name")}</TableHead>
                    <TableHead>{t("samlSp.columns.idpEntityId")}</TableHead>
                    <TableHead>{t("samlSp.columns.idpType")}</TableHead>
                    <TableHead>{t("samlSp.columns.status")}</TableHead>
                    <TableHead>{t("samlSp.columns.lastLogin")}</TableHead>
                    <TableHead className="text-right">{t("samlSp.columns.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((c) => (
                    <ConnectionRow
                      key={c.id}
                      connection={c}
                      busy={updateM.isPending || deleteM.isPending}
                      onToggle={() =>
                        runSensitive({
                          actionLabel:
                            c.status === "active"
                              ? t("samlSp.stepUp.disable")
                              : t("samlSp.stepUp.enable"),
                          run: () =>
                            updateM.mutateAsync({
                              id: c.id,
                              status: c.status === "active" ? "disabled" : "active",
                            }),
                        }).catch(settleSensitiveAction)
                      }
                      onDelete={() =>
                        runSensitive({
                          confirm: {
                            title: t("samlSp.confirm.title", { name: c.name }),
                            confirmLabel: t("samlSp.confirm.label"),
                            tone: "destructive",
                          },
                          actionLabel: t("samlSp.stepUp.delete"),
                          run: () => deleteM.mutateAsync(c.id),
                        }).catch(settleSensitiveAction)
                      }
                    />
                  ))}
                </TableBody>
              </Table>
            </DataState>
          </CardContent>
          <CardFooter className="flex-wrap justify-between gap-3">
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <BookOpenIcon className="size-4 shrink-0" aria-hidden="true" />
              <span>
                {t("samlSp.help.prefix")}{" "}
                <a
                  href={SAML_GUIDE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-primary hover:underline"
                >
                  {t("samlSp.help.guideLink")}
                </a>{" "}
                {t("samlSp.help.suffix")}
              </span>
            </p>
            <a
              href={DOCS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              {t("samlSp.help.docsLink")} <ArrowRightIcon className="size-3.5" />
            </a>
          </CardFooter>
        </Card>
      </FeatureGate>

      <SamlConnectionSheet open={creating} onOpenChange={setCreating} />
    </div>
  );
}
