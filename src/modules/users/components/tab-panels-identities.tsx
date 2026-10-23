// The User 360 Identities and Developer tabs: how the person signs in, and their identifiers.

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  JSONTree,
  StatusPill,
  TimeSince,
} from "@qeetrix/ui";
import {
  FingerprintPatternIcon,
  KeyRoundIcon,
  LinkIcon,
  LockIcon,
  TriangleAlertIcon,
} from "@qeetrix/icons";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { DataState } from "@/platform/components/data-state";
import { type UserDetail, useUserSocialIdentities } from "../api/user360";
import { CopyId, InfoRow } from "./user-detail-fields";

export function IdentitiesTab({ userId, passwordSet }: { userId: string; passwordSet?: boolean }) {
  const { t } = useTranslation("users");
  const identitiesQ = useUserSocialIdentities(userId);
  const social = identitiesQ.data?.items ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("detail.identitiesTitle")}</CardTitle>
        <CardDescription>{t("detail.identitiesDesc")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {passwordSet ? (
          <IdentityRow
            icon={<LockIcon className="size-4" aria-hidden="true" />}
            title={t("detail.password")}
            subtitle={t("detail.passwordIdentity")}
          />
        ) : null}
        <DataState
          isLoading={identitiesQ.isLoading}
          isError={identitiesQ.isError}
          error={identitiesQ.error}
          isEmpty={social.length === 0 && !passwordSet}
          emptyIcon={LinkIcon}
          emptyTitle={t("detail.identitiesEmpty")}
          skeletonRows={2}
        >
          {social.map((i) => (
            <IdentityRow
              key={i.id}
              icon={<FingerprintPatternIcon className="size-4" aria-hidden="true" />}
              title={i.provider}
              subtitle={i.email ?? i.subject}
              trailing={
                <span className="text-xs text-muted-foreground">
                  <TimeSince value={i.linked_at} />
                </span>
              }
            />
          ))}
        </DataState>
      </CardContent>
    </Card>
  );
}

function IdentityRow({
  icon,
  title,
  subtitle,
  trailing,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string | null;
  trailing?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium capitalize">{title}</div>
        {subtitle ? <div className="truncate text-xs text-muted-foreground">{subtitle}</div> : null}
      </div>
      {trailing}
    </div>
  );
}

export function DeveloperTab({ user }: { user: UserDetail }) {
  const { t } = useTranslation("users");
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRoundIcon className="size-4 text-muted-foreground" aria-hidden="true" />
            {t("detail.identifiers")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-border/50">
            <InfoRow label={t("detail.fieldUserId")}>
              <CopyId value={user.id} truncate={false} />
            </InfoRow>
            <InfoRow label={t("detail.fieldTenant")}>
              <CopyId value={user.tenant_id} truncate={false} />
            </InfoRow>
            <InfoRow label={t("detail.userStatus")}>
              <StatusPill status={user.status} dot />
            </InfoRow>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("detail.metadata")}</CardTitle>
          <CardDescription>{t("detail.metadataDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          {user.metadata && Object.keys(user.metadata).length > 0 ? (
            <JSONTree value={user.metadata} rootLabel="metadata" initialOpenDepth={1} />
          ) : (
            <EmptyState icon={TriangleAlertIcon} title={t("detail.metadataEmpty")} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
