import {
  Button,
  cn,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  TableCell,
  TableRow,
  TimeSince,
} from "@qeetrix/ui";
import {
  BookOpenIcon,
  CircleCheckIcon,
  CircleXIcon,
  DownloadIcon,
  ExternalLinkIcon,
  type IconProps,
  LoaderCircleIcon,
  PlusIcon,
  ShieldCheckIcon,
  TrashIcon,
} from "@qeetrix/icons";
import { type ComponentType, useState } from "react";
import { useTranslation } from "react-i18next";

import { DOCS_URL } from "@/platform/config/site-urls";

import {
  type SamlConnection,
  samlLoginUrl,
  samlMetadataUrl,
  useTestSamlConnection,
} from "../api/saml";
import { SAML_IDP_VENDOR_LABELS, samlIdpVendor } from "../saml-vendors";
import { ErrorText } from "@/platform/components/error-reference";
import { StatusPill } from "@/platform/components/status-pill";

const SETUP_GUIDE_URL = `${DOCS_URL}/docs/guides/add-enterprise-sso`;

const STAT_TONES = {
  success: "bg-success/12 text-success",
  neutral: "bg-muted text-foreground/75",
  warning: "bg-warning/15 text-warning",
  violet: "bg-violet-500/12 text-violet-600 dark:text-violet-400",
} as const;

export function StatTile({
  icon: Icon,
  tone,
  label,
  value,
}: {
  icon: ComponentType<IconProps<"outline">>;
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
export function ConnectionsEmptyState({
  filtered,
  onCreate,
}: {
  filtered: boolean;
  onCreate: () => void;
}) {
  const { t } = useTranslation("authentication");
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

export function ConnectionRow({
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
  const { t } = useTranslation("authentication");
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
          <TrashIcon /> {t("samlSp.deleteBtn")}
        </Button>
      </TableCell>
    </TableRow>
  );
}

// An offline config preflight with per-check results, catching errors before any sign-in;
// "Test SSO" is the live IdP round trip.
function ValidateConnection({ id }: { id: string }) {
  const { t } = useTranslation("authentication");
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
        {testM.isPending ? <LoaderCircleIcon className="animate-spin" /> : <ShieldCheckIcon />}{" "}
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
                <p className="text-sm text-destructive">
                  <ErrorText error={testM.error} />
                </p>
              )}
              {testM.data && (
                <ul className="flex flex-col gap-3">
                  {testM.data.checks.map((c) => (
                    <li key={c.name} className="flex items-start gap-2">
                      {c.ok ? (
                        <CircleCheckIcon className="mt-0.5 size-4 shrink-0 text-success" />
                      ) : (
                        <CircleXIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
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
