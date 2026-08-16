// The six "Security posture" tiles at the top of the Overview tab.

import { cn, Skeleton, TimeSince } from "@qeetrix/ui";
import {
  GaugeIcon,
  KeyRoundIcon,
  LockIcon,
  type LucideIcon,
  MailIcon,
  MonitorSmartphoneIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
} from "lucide-react";

import type { SecuritySummary } from "./api/user360";
import type { UserRisk } from "./user-risk";

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
  icon: LucideIcon;
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

function mfaFactorsLabel(s: SecuritySummary): string {
  const parts: string[] = [];
  if (s.totp_enabled) parts.push("Authenticator");
  if (s.otp_factors > 0) parts.push(`${s.otp_factors} OTP`);
  if (s.push_devices > 0) parts.push(`${s.push_devices} push`);
  if (parts.length === 0) return s.mfa_required ? "Required — not enrolled" : "No MFA configured";
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
  const riskTone: Tone =
    risk?.level === "high" ? "danger" : risk?.level === "medium" ? "warning" : "success";
  const riskLabel = risk ? risk.level.charAt(0).toUpperCase() + risk.level.slice(1) : "—";

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      <PostureTile
        icon={MailIcon}
        label="Email"
        tone={emailVerified ? "success" : "warning"}
        value={emailVerified ? "Verified" : "Unverified"}
        sub={email}
      />
      <PostureTile
        icon={security?.mfa_enabled ? ShieldCheckIcon : ShieldAlertIcon}
        label="MFA"
        loading={securityLoading}
        tone={security?.mfa_enabled ? "success" : "warning"}
        value={security?.mfa_enabled ? "Enabled" : "Disabled"}
        sub={security ? mfaFactorsLabel(security) : undefined}
      />
      <PostureTile
        icon={KeyRoundIcon}
        label="Passkeys"
        loading={securityLoading}
        tone={security && security.passkeys > 0 ? "success" : "neutral"}
        value={
          security
            ? security.passkeys === 1
              ? "1 registered"
              : `${security.passkeys} registered`
            : undefined
        }
        sub={
          security?.passkey_last_used_at ? (
            <>
              Last used <TimeSince value={security.passkey_last_used_at} />
            </>
          ) : security && security.passkeys > 0 ? (
            "Never used"
          ) : (
            "None registered"
          )
        }
      />
      <PostureTile
        icon={LockIcon}
        label="Password"
        loading={securityLoading}
        tone={security?.password_set ? "neutral" : "warning"}
        value={security?.password_set ? "Enabled" : "Not set"}
        sub={
          security?.password_changed_at ? (
            <>
              Last changed <TimeSince value={security.password_changed_at} />
            </>
          ) : security?.password_set ? (
            "Change date unknown"
          ) : (
            "Password login not set up"
          )
        }
      />
      <PostureTile
        icon={MonitorSmartphoneIcon}
        label="Sessions"
        loading={securityLoading}
        tone="neutral"
        value={
          security
            ? security.active_sessions === 1
              ? "1 active"
              : `${security.active_sessions} active`
            : undefined
        }
        sub={
          security
            ? `Across ${security.distinct_devices} device${security.distinct_devices === 1 ? "" : "s"}`
            : undefined
        }
      />
      <PostureTile
        icon={GaugeIcon}
        label="Risk level"
        loading={riskLoading}
        tone={riskTone}
        value={riskLabel}
        sub={
          risk && risk.openCount > 0
            ? `${risk.openCount} open signal${risk.openCount === 1 ? "" : "s"}`
            : "No suspicious activity"
        }
      />
    </div>
  );
}
