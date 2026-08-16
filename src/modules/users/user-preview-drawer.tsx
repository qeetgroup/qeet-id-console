// Row-preview slide-over — a condensed User 360 so an admin can investigate a
// user without leaving the table. Overview matches the mockup's right panel
// (Profile / Security / Access summary); the Access / Security / Activity tabs
// show focused real data. Reuses the User 360 endpoints.

import {
  Avatar,
  AvatarFallback,
  Badge,
  buttonVariants,
  cn,
  DataState,
  Separator,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  StatusPill,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  TimeSince,
} from "@qeetrix/ui";
import { Link } from "@tanstack/react-router";
import { ArrowRightIcon, CheckCircle2Icon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { CopyId } from "./user-detail-fields";
import { parseUserAgent } from "./user-agent";
import { deriveUserRisk } from "./user-risk";
import { useAnomalies } from "@/modules/security";
import {
  useUserAccess,
  useUserRecentActivity,
  useUserSecurity,
  useUserSessions,
} from "./api/user360";
import type { User } from "./api/users";
import { initials, primaryRole } from "./user-display";

function formatDateTime(iso?: string | null): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
      new Date(iso),
    );
  } catch {
    return iso;
  }
}

export function UserPreviewDrawer({ user, onClose }: { user: User | null; onClose: () => void }) {
  const { t } = useTranslation("users");
  const id = user?.id ?? "";
  const enabled = !!user;
  const securityQ = useUserSecurity(id, enabled);
  const accessQ = useUserAccess(id);
  const sessionsQ = useUserSessions(id, enabled);
  const anomaliesQ = useAnomalies();

  const sec = enabled ? securityQ.data : undefined;
  const acc = enabled ? accessQ.data : undefined;
  const latestSession = sessionsQ.data?.items?.[0];
  const device = latestSession ? parseUserAgent(latestSession.user_agent).label : undefined;
  const ip = user?.last_seen_ip ?? latestSession?.ip ?? undefined;
  const risk = user ? deriveUserRisk(anomaliesQ.data?.items ?? [], user.id) : undefined;
  const riskLabel = risk ? risk.level.charAt(0).toUpperCase() + risk.level.slice(1) : "—";
  const name = user?.display_name || user?.email || "";
  const role = primaryRole(user?.roles);

  return (
    <Sheet open={!!user} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        {user ? (
          <>
            <SheetHeader className="gap-3 border-b p-4">
              <div className="flex items-center gap-3">
                <Avatar className="size-10 rounded-lg">
                  <AvatarFallback className="rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
                    {initials(name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <SheetTitle className="flex items-center gap-2 truncate text-base">
                    <span className="truncate">{name}</span>
                    <StatusPill status={user.status} dot />
                  </SheetTitle>
                  <SheetDescription className="truncate">{user.email}</SheetDescription>
                </div>
              </div>
              <CopyId value={user.id} label={t("detail.copyUserId")} />
            </SheetHeader>

            <Tabs defaultValue="overview" className="flex min-h-0 flex-1 flex-col">
              <TabsList className="mx-4 mt-3 w-[calc(100%-2rem)] justify-start overflow-x-auto">
                <TabsTrigger value="overview">{t("detail.tabs.overview")}</TabsTrigger>
                <TabsTrigger value="access">{t("detail.tabs.access")}</TabsTrigger>
                <TabsTrigger value="security">{t("detail.tabs.security")}</TabsTrigger>
                <TabsTrigger value="activity">{t("detail.tabs.activity")}</TabsTrigger>
              </TabsList>

              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                {/* Overview */}
                <TabsContent value="overview" className="mt-0 space-y-5">
                  <Section title={t("preview.profile")}>
                    <Row label={t("detail.fullName")} value={name} />
                    <Row
                      label={t("preview.email")}
                      value={
                        <span className="inline-flex items-center gap-1.5">
                          <span className="truncate">{user.email}</span>
                          {user.email_verified_at ? <VerifiedBadge t={t} /> : null}
                        </span>
                      }
                    />
                    <Row
                      label={t("detail.phone")}
                      value={
                        user.phone ? (
                          <span className="inline-flex items-center gap-1.5">
                            {user.phone}
                            {user.phone_verified_at ? <VerifiedBadge t={t} /> : null}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">{t("detail.notConfigured")}</span>
                        )
                      }
                    />
                    <Row label={t("detail.fieldCreated")} value={formatDateTime(user.created_at)} />
                    <Row
                      label={t("preview.lastSeen")}
                      value={
                        user.last_seen_at ? (
                          <TimeSince value={user.last_seen_at} />
                        ) : (
                          <span className="text-muted-foreground">{t("preview.never")}</span>
                        )
                      }
                    />
                    <Row label={t("preview.device")} value={device ?? "—"} />
                    <Row
                      label={t("preview.ip")}
                      value={ip ? <span className="font-mono text-xs">{ip}</span> : "—"}
                    />
                  </Section>

                  <Separator />

                  <Section title={t("preview.security")}>
                    <Row
                      label={t("preview.emailVerification")}
                      value={<StateValue ok={!!user.email_verified_at} t={t} />}
                    />
                    <Row
                      label={t("preview.mfa")}
                      value={<StateValue ok={!!(user.mfa_enabled ?? sec?.mfa_enabled)} t={t} />}
                    />
                    <Row
                      label={t("detail.passkeysLabel")}
                      value={sec ? t("preview.configured", { n: sec.passkeys }) : "—"}
                    />
                    <Row
                      label={t("detail.sessionsTitle")}
                      value={sec ? String(sec.active_sessions) : "—"}
                    />
                    <Row
                      label={t("preview.risk")}
                      value={
                        <Badge
                          variant={
                            risk?.level === "high"
                              ? "destructive"
                              : risk?.level === "medium"
                                ? "warning"
                                : "success"
                          }
                        >
                          {riskLabel}
                        </Badge>
                      }
                    />
                  </Section>

                  <Separator />

                  <Section title={t("detail.accessTitle")}>
                    <Row label={t("detail.roles")} value={String(user.roles?.length ?? 0)} />
                    <Row label={t("detail.groups")} value={String(user.groups_count ?? 0)} />
                    <Row
                      label={t("preview.directPermissions")}
                      value={acc ? String(acc.permissions_direct) : "—"}
                    />
                    <Row
                      label={t("preview.inheritedPermissions")}
                      value={acc ? String(acc.permissions_inherited) : "—"}
                    />
                  </Section>
                </TabsContent>

                {/* Access */}
                <TabsContent value="access" className="mt-0 space-y-4">
                  <DataState isLoading={accessQ.isLoading} isEmpty={false} skeletonRows={4}>
                    <Section title={t("table.role")}>
                      {role ? <div className="text-sm font-medium capitalize">{role}</div> : null}
                      <div className="flex flex-wrap gap-1.5">
                        {(acc?.roles ?? []).map((r) => (
                          <Badge key={r.id} variant="secondary">
                            {r.name}
                          </Badge>
                        ))}
                      </div>
                    </Section>
                    <Section title={t("detail.groups")}>
                      {(acc?.groups ?? []).length === 0 ? (
                        <span className="text-sm text-muted-foreground">
                          {t("detail.noGroups")}
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {(acc?.groups ?? []).map((g) => (
                            <Badge key={g.id} variant="outline">
                              {g.name}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </Section>
                    <Section title={t("detail.permissions")}>
                      <Row
                        label={t("detail.permissionsSub")}
                        value={acc ? String(acc.permissions_total) : "—"}
                      />
                      <Row
                        label={t("preview.directPermissions")}
                        value={acc ? String(acc.permissions_direct) : "—"}
                      />
                      <Row
                        label={t("preview.inheritedPermissions")}
                        value={acc ? String(acc.permissions_inherited) : "—"}
                      />
                    </Section>
                  </DataState>
                </TabsContent>

                {/* Security */}
                <TabsContent value="security" className="mt-0 space-y-4">
                  <DataState isLoading={securityQ.isLoading} isEmpty={false} skeletonRows={5}>
                    <Section title={t("detail.authMethodsTitle")}>
                      <Row
                        label={t("detail.password")}
                        value={sec?.password_set ? t("detail.enabled") : t("detail.notSet")}
                      />
                      <Row
                        label={t("detail.authenticatorApp")}
                        value={sec?.totp_enabled ? t("detail.enabled") : t("detail.notSet")}
                      />
                      <Row label={t("detail.passkeysLabel")} value={String(sec?.passkeys ?? 0)} />
                      <Row label={t("detail.otpFactors")} value={String(sec?.otp_factors ?? 0)} />
                      <Row label={t("detail.pushDevices")} value={String(sec?.push_devices ?? 0)} />
                      <Row
                        label={t("detail.recoveryCodes")}
                        value={String(sec?.recovery_codes_remaining ?? 0)}
                      />
                      <Row
                        label={t("detail.mfaRequired")}
                        value={sec?.mfa_required ? t("detail.yes") : t("detail.no")}
                      />
                    </Section>
                  </DataState>
                </TabsContent>

                {/* Activity */}
                <TabsContent value="activity" className="mt-0">
                  <PreviewActivity userId={user.id} />
                </TabsContent>
              </div>
            </Tabs>

            <div className="flex items-center gap-2 border-t p-4">
              <Link
                to="/users/$userId"
                params={{ userId: user.id }}
                className={cn(buttonVariants({ size: "sm" }), "flex-1")}
              >
                {t("preview.openFull")}
                <ArrowRightIcon className="size-4" aria-hidden="true" />
              </Link>
              <Link
                to="/users/$userId/timeline"
                params={{ userId: user.id }}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                {t("preview.viewActivity")}
              </Link>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function PreviewActivity({ userId }: { userId: string }) {
  const { t } = useTranslation("users");
  const recentQ = useUserRecentActivity(userId, 8);
  const events = recentQ.data?.events ?? [];
  return (
    <DataState
      isLoading={recentQ.isLoading}
      isError={recentQ.isError}
      isEmpty={events.length === 0}
      emptyTitle={t("detail.activityEmpty")}
      skeletonRows={4}
    >
      <ol className="space-y-3">
        {events.map((e) => (
          <li key={e.id} className="flex items-start gap-2.5">
            <span
              className="mt-1.5 size-2 shrink-0 rounded-full bg-muted-foreground"
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{e.title}</div>
              <div className="truncate text-xs text-muted-foreground">
                {[e.device || e.browser, e.location, e.ip ? `IP ${e.ip}` : null]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            </div>
            <TimeSince value={e.at} className="shrink-0 text-xs text-muted-foreground" />
          </li>
        ))}
      </ol>
    </DataState>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <div className="space-y-1.5">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-right font-medium">{value}</span>
    </div>
  );
}

function VerifiedBadge({ t }: { t: (k: string) => string }) {
  return (
    <Badge variant="success" className="gap-1">
      <CheckCircle2Icon className="size-3" aria-hidden="true" />
      {t("detail.verified")}
    </Badge>
  );
}

function StateValue({ ok, t }: { ok: boolean; t: (k: string) => string }) {
  return ok ? (
    <span className="inline-flex items-center gap-1 text-success">
      <CheckCircle2Icon className="size-3.5" aria-hidden="true" />
      {t("detail.enabled")}
    </span>
  ) : (
    <span className="text-warning">{t("detail.notSet")}</span>
  );
}
