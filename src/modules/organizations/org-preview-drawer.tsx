// Row-preview slide-over for an organization — a quick look sourced from the
// (enriched) caller-scoped list. Deeper per-org data lives behind "Open Org 360"
// / switching, since the server locks detail surfaces to the active org.

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Button,
  buttonVariants,
  Callout,
  cn,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  StatusPill,
} from "@qeetrix/ui";
import { Link } from "@tanstack/react-router";
import { ArrowRightIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { CopyId } from "@/modules/users";
import { initials } from "@/modules/users";
import { switchToTenant } from "@/modules/authentication";
import type { Org } from "./api/orgs";

function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function OrgPreviewDrawer({
  org,
  isCurrent,
  onClose,
}: {
  org: Org | null;
  isCurrent: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation("organizations");

  return (
    <Sheet open={!!org} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-sm">
        {org ? (
          <>
            <SheetHeader className="gap-3">
              <div className="flex items-center gap-3">
                <Avatar className="size-11 rounded-lg">
                  {org.logo_url ? <AvatarImage src={org.logo_url} alt={org.name} /> : null}
                  <AvatarFallback className="rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
                    {initials(org.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <SheetTitle className="flex items-center gap-2 truncate text-base">
                    <span className="truncate">{org.name}</span>
                    <StatusPill status={org.status} dot />
                  </SheetTitle>
                  <SheetDescription className="truncate font-mono text-xs">
                    {org.slug}
                  </SheetDescription>
                </div>
              </div>
              <CopyId value={org.id} label={t("preview.copyId")} />
            </SheetHeader>

            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              <div className="divide-y divide-border/50">
                <PreviewRow
                  label={t("preview.plan")}
                  value={<Badge variant="muted">{org.plan}</Badge>}
                />
                <PreviewRow label={t("preview.region")} value={org.region || "—"} />
                <PreviewRow label={t("preview.members")} value={String(org.member_count ?? "—")} />
                <PreviewRow
                  label={t("preview.mfaMembers")}
                  value={String(org.mfa_enabled_count ?? "—")}
                />
                <PreviewRow label={t("preview.created")} value={formatDate(org.created_at)} />
              </div>

              {!isCurrent ? (
                <Callout>{t("preview.switchHint")}</Callout>
              ) : (
                <Badge variant="success">{t("tenants.table.current")}</Badge>
              )}
            </div>

            <div className="flex items-center gap-2 border-t p-4">
              <Link
                to="/organizations/$orgId"
                params={{ orgId: org.id }}
                className={cn(buttonVariants({ size: "sm" }), "flex-1")}
              >
                {t("preview.open")}
                <ArrowRightIcon className="size-4" aria-hidden="true" />
              </Link>
              {!isCurrent ? (
                <Button variant="outline" size="sm" onClick={() => void switchToTenant(org.id)}>
                  {t("tenants.table.switch")}
                </Button>
              ) : null}
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function PreviewRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
