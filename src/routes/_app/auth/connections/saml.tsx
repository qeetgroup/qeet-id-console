import {
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  cn,
  DataState,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  StatusPill,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TimeSince,
} from "@qeetrix/ui";
import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowRightIcon,
  ArrowUpDownIcon,
  BookOpenIcon,
  CheckCircle2Icon,
  ClockIcon,
  DatabaseIcon,
  DownloadIcon,
  ExternalLinkIcon,
  FileTextIcon,
  Loader2Icon,
  PlusIcon,
  SearchIcon,
  ShieldCheckIcon,
  Trash2Icon,
  UsersRoundIcon,
  XCircleIcon,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useEntitlements } from "@/modules/billing/api/billing";
import { FeatureGate } from "@/modules/billing/components/upgrade-gate";
import {
  type SamlConnection,
  samlLoginUrl,
  samlMetadataUrl,
  useDeleteSamlConnection,
  useSamlConnections,
  useTestSamlConnection,
  useUpdateSamlConnection,
} from "@/modules/authentication/api/saml";
import { SamlConnectionSheet } from "@/modules/authentication/components/saml-connection-sheet";
import {
  SAML_IDP_VENDOR_LABELS,
  type SamlIdpVendor,
  samlIdpVendor,
} from "@/modules/authentication/saml-vendors";
import { PageHeader } from "@/platform/components/page-header";
import { DOCS_URL } from "@/platform/config/site-urls";
import { errorMessage } from "@/platform/errors/user-message";
import { useConfirmDialog } from "@/shared/components/confirm-dialog";

export const Route = createFileRoute("/_app/auth/connections/saml")({
  component: SamlPage,
});

const SAML_GUIDE_URL = `${DOCS_URL}/docs/authentication/enterprise-sso`;
const SETUP_GUIDE_URL = `${DOCS_URL}/docs/guides/add-enterprise-sso`;

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

function SamlPage() {
  const { t } = useTranslation("auth");
  const [confirmDialog, openConfirm] = useConfirmDialog();
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
      {confirmDialog}
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
        title="Enterprise SSO (SAML) is a paid feature"
        description="Let your team sign in through your own identity provider (Okta, Entra ID, Google Workspace…). Upgrade to Pro to configure SAML connections."
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
                        updateM.mutate({
                          id: c.id,
                          status: c.status === "active" ? "disabled" : "active",
                        })
                      }
                      onDelete={() =>
                        openConfirm({
                          title: t("samlSp.confirm.title", { name: c.name }),
                          variant: "destructive",
                          confirmLabel: t("samlSp.confirm.label"),
                          onConfirm: () => deleteM.mutate(c.id),
                        })
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

const STAT_TONES = {
  success: "bg-success/12 text-success",
  neutral: "bg-muted text-foreground/75",
  warning: "bg-warning/15 text-warning",
  violet: "bg-violet-500/12 text-violet-600 dark:text-violet-400",
} as const;

function StatTile({
  icon: Icon,
  tone,
  label,
  value,
}: {
  icon: typeof ClockIcon;
  tone: keyof typeof STAT_TONES;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl border bg-card p-4">
      <span
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-xl",
          STAT_TONES[tone],
        )}
      >
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{label}</p>
        <p className="mt-1 font-heading text-2xl font-semibold leading-none">{value}</p>
      </div>
    </div>
  );
}

/** Zero state for the table — first-run, or "nothing matched the filters". */
function ConnectionsEmptyState({
  filtered,
  onCreate,
}: {
  filtered: boolean;
  onCreate: () => void;
}) {
  const { t } = useTranslation("auth");
  return (
    <div className="m-4 flex flex-col items-center gap-4 rounded-xl border border-dashed p-10 text-center">
      <span className="relative">
        <span className="flex h-16 w-24 flex-col gap-1.5 rounded-lg border bg-muted/40 p-2">
          <span className="flex gap-1">
            <span className="size-1.5 rounded-full bg-muted-foreground/30" />
            <span className="size-1.5 rounded-full bg-muted-foreground/30" />
            <span className="size-1.5 rounded-full bg-muted-foreground/30" />
          </span>
          <span className="h-1.5 w-3/4 rounded bg-muted-foreground/20" />
          <span className="h-1.5 w-1/2 rounded bg-muted-foreground/20" />
        </span>
        <span className="absolute -inset-e-2 -bottom-2 flex size-8 items-center justify-center rounded-full border-2 border-card bg-primary/10 text-primary">
          <PlusIcon className="size-4" />
        </span>
      </span>
      <div className="space-y-1">
        <p className="font-heading text-base font-semibold">
          {filtered ? t("samlSp.list.noMatchTitle") : t("samlSp.list.emptyTitle")}
        </p>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">
          {filtered ? t("samlSp.list.noMatchDescription") : t("samlSp.list.emptyDescription")}
        </p>
      </div>
      {!filtered && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button size="sm" onClick={onCreate}>
            <PlusIcon /> {t("samlSp.newButton")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            render={<a href={SETUP_GUIDE_URL} target="_blank" rel="noopener noreferrer" />}
          >
            <BookOpenIcon /> {t("samlSp.list.setupGuideBtn")}
          </Button>
        </div>
      )}
    </div>
  );
}

function ConnectionRow({
  connection,
  busy,
  onToggle,
  onDelete,
}: {
  connection: SamlConnection;
  busy: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation("auth");
  const vendor = samlIdpVendor(connection);

  return (
    <TableRow>
      <TableCell className="font-medium">{connection.name}</TableCell>
      <TableCell className="max-w-65 truncate font-mono text-xs text-muted-foreground">
        {connection.idp_entity_id}
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {vendor === "other" ? t("samlSp.filters.vendorOther") : SAML_IDP_VENDOR_LABELS[vendor]}
      </TableCell>
      <TableCell>
        <StatusPill status={connection.status} />
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {connection.last_login_at ? <TimeSince value={connection.last_login_at} /> : "—"}
      </TableCell>
      <TableCell className="text-right whitespace-nowrap">
        <ValidateConnection id={connection.id} />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => window.open(samlLoginUrl(connection.id), "_blank", "noopener")}
          disabled={connection.status === "disabled"}
          title={t("samlSp.testSsoTitle")}
        >
          <ExternalLinkIcon /> {t("samlSp.testSso")}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => window.open(samlMetadataUrl(connection.id), "_blank", "noopener")}
          title={t("samlSp.metadataTitle")}
        >
          <DownloadIcon /> {t("samlSp.metadata")}
        </Button>
        <Button variant="ghost" size="sm" onClick={onToggle} disabled={busy}>
          {connection.status === "active" ? t("samlSp.disable") : t("samlSp.enable")}
        </Button>
        <Button variant="ghost" size="sm" onClick={onDelete} disabled={busy}>
          <Trash2Icon /> {t("samlSp.deleteBtn")}
        </Button>
      </TableCell>
    </TableRow>
  );
}

// ValidateConnection runs an offline config preflight (POST .../saml/{id}/test)
// and shows the per-check results in a side panel — complementary to "Test SSO"
// (a live IdP round-trip), this catches config errors before any login.
function ValidateConnection({ id }: { id: string }) {
  const { t } = useTranslation("auth");
  const testM = useTestSamlConnection();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        disabled={testM.isPending}
        onClick={() => {
          setOpen(true);
          testM.mutate(id);
        }}
        title={t("samlSp.validate.buttonTitle")}
      >
        {testM.isPending ? <Loader2Icon className="animate-spin" /> : <ShieldCheckIcon />}{" "}
        {t("samlSp.validate.button")}
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md!">
          <div className="flex h-full flex-col">
            <SheetHeader>
              <SheetTitle>{t("samlSp.validate.sheetTitle")}</SheetTitle>
              <SheetDescription>{t("samlSp.validate.sheetDescription")}</SheetDescription>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto p-4">
              {testM.isPending && (
                <p className="text-sm text-muted-foreground">{t("samlSp.validate.running")}</p>
              )}
              {testM.error && (
                <p className="text-sm text-destructive">{errorMessage(testM.error)}</p>
              )}
              {testM.data && (
                <ul className="flex flex-col gap-3">
                  {testM.data.checks.map((c) => (
                    <li key={c.name} className="flex items-start gap-2">
                      {c.ok ? (
                        <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-success" />
                      ) : (
                        <XCircleIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{c.name}</p>
                        {c.detail && <p className="text-xs text-muted-foreground">{c.detail}</p>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
