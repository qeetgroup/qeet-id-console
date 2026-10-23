import { cn, Skeleton, TimeSince } from "@qeetrix/ui";
import {
  GaugeIcon,
  type IconProps,
  KeyRoundIcon,
  LockIcon,
  MailIcon,
  MonitorSmartphoneIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
} from "@qeetrix/icons";
import type { ComponentType } from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";

import type { SecuritySummary } from "../api/user360";
import type { UserRisk } from "../user-risk";

type Tone = "success" | "warning" | "danger" | "neutral";

const TONES: Record<Tone, { wrap: string; icon: string }> = {
  success: { wrap: "border-success/25 bg-success/5", icon: "text-success" },
  warning: { wrap: "border-warning/30 bg-warning/5", icon: "text-warning" },
  danger: { wrap: "border-destructive/30 bg-destructive/5", icon: "text-destructive" },
  neutral: { wrap: "border-border bg-card", icon: "text-muted-foreground" },
};

function PostureTile({
  icon: Icon,
  label,
  value,
  sub,
  tone = "neutral",
  loading,
}: {
  icon: ComponentType<IconProps<"outline">>;
  label: string;
  value?: React.ReactNode;
  sub?: React.ReactNode;
  tone?: Tone;
  loading?: boolean;
}) {
  const t = TONES[tone];
  return (
    <div className={cn("flex flex-col gap-2 rounded-xl border p-4", t.wrap)}>
      <div className="flex items-center gap-2">
        <Icon className={cn("size-4 shrink-0", t.icon)} aria-hidden="true" />
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
      </div>
      {loading ? (
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-3 w-28" />
        </div>
      ) : (
        <div className="flex flex-col gap-0.5">
          <span className="text-base font-semibold leading-tight">{value ?? "—"}</span>
          {sub ? <span className="truncate text-xs text-muted-foreground">{sub}</span> : null}
        </div>
      )}
    </div>
  );
}

function mfaFactorsLabel(s: SecuritySummary, t: TFunction): string {
  const parts: string[] = [];
  if (s.totp_enabled) parts.push(t("postureTiles.mfa.authenticator"));
  if (s.otp_factors > 0) parts.push(t("postureTiles.mfa.otp", { count: s.otp_factors }));
  if (s.push_devices > 0) parts.push(t("postureTiles.mfa.push", { count: s.push_devices }));
  if (parts.length === 0) {
    return t(s.mfa_required ? "postureTiles.mfa.requiredNotEnrolled" : "postureTiles.mfa.none");
  }
  return parts.join(" · ");
}

export function SecurityPosture({
  email,
  emailVerified,
  security,
  securityLoading,
  risk,
  riskLoading,
}: {
  email: string;
  emailVerified: boolean;
  security?: SecuritySummary;
  securityLoading: boolean;
  risk?: UserRisk;
  riskLoading: boolean;
}) {
  const { t } = useTranslation("users");
  const riskTone: Tone =
    risk?.level === "high" ? "danger" : risk?.level === "medium" ? "warning" : "success";
  const riskLabel = risk ? t(`postureTiles.risk.${risk.level}`) : "—";

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      <PostureTile
        icon={MailIcon}
        label={t("common:labels.email")}
        tone={emailVerified ? "success" : "warning"}
        value={t(emailVerified ? "postureTiles.verified" : "postureTiles.unverified")}
        sub={email}
      />
      <PostureTile
        icon={security?.mfa_enabled ? ShieldCheckIcon : ShieldAlertIcon}
        label={t("postureTiles.mfa.label")}
        loading={securityLoading}
        tone={security?.mfa_enabled ? "success" : "warning"}
        value={t(security?.mfa_enabled ? "postureTiles.enabled" : "postureTiles.disabled")}
        sub={security ? mfaFactorsLabel(security, t) : undefined}
      />
      <PostureTile
        icon={KeyRoundIcon}
        label={t("postureTiles.passkeys")}
        loading={securityLoading}
        tone={security && security.passkeys > 0 ? "success" : "neutral"}
        value={security ? t("postureTiles.registered", { count: security.passkeys }) : undefined}
        sub={
          security?.passkey_last_used_at ? (
            <>
              {t("postureTiles.lastUsed")} <TimeSince value={security.passkey_last_used_at} />
            </>
          ) : security && security.passkeys > 0 ? (
            t("postureTiles.neverUsed")
          ) : (
            t("postureTiles.noneRegistered")
          )
        }
      />
      <PostureTile
        icon={LockIcon}
        label={t("postureTiles.password")}
        loading={securityLoading}
        tone={security?.password_set ? "neutral" : "warning"}
        value={t(security?.password_set ? "postureTiles.enabled" : "postureTiles.notSet")}
        sub={
          security?.password_changed_at ? (
            <>
              {t("postureTiles.lastChanged")} <TimeSince value={security.password_changed_at} />
            </>
          ) : security?.password_set ? (
            t("postureTiles.changeDateUnknown")
          ) : (
            t("postureTiles.passwordNotSetUp")
          )
        }
      />
      <PostureTile
        icon={MonitorSmartphoneIcon}
        label={t("postureTiles.sessions")}
        loading={securityLoading}
        tone="neutral"
        value={security ? t("postureTiles.active", { count: security.active_sessions }) : undefined}
        sub={
          security
            ? t("postureTiles.acrossDevices", { count: security.distinct_devices })
            : undefined
        }
      />
      <PostureTile
        icon={GaugeIcon}
        label={t("postureTiles.riskLevel")}
        loading={riskLoading}
        tone={riskTone}
        value={riskLabel}
        sub={
          risk && risk.openCount > 0
            ? t("postureTiles.openSignals", { count: risk.openCount })
            : t("postureTiles.noSuspiciousActivity")
        }
      />
    </div>
  );
}
