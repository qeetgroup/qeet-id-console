import { Badge, Button } from "@qeetrix/react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import type { AuthPolicy } from "@/modules/authentication/api/auth-policy";
import { settleSensitiveAction } from "@/platform/security/sensitive-action-provider";
import { Failure, Section } from "./methods-parts";
import { isLastMethod, useSavePolicy } from "./use-policy";

/** The policy's on/off switches that have a section of their own. */
export type MethodKey =
  | "password_enabled"
  | "passkey_enabled"
  | "magic_link_enabled"
  | "remember_device_enabled";

/**
 * One way in, as a section: its name with On or Off, what it is (and how much it's used), and
 * Turn off or Turn on at the end of its title. Turning off is confirmed with what happens to
 * people; turning on needs only the step-up. The last first-factor method can't be turned off
 * (the server refuses it), so its section says why instead.
 */
export function MethodSection({
  policy,
  method,
  canWrite,
  title,
  description,
  turnOff,
  children,
}: {
  policy: AuthPolicy;
  method: MethodKey;
  canWrite: boolean;
  title: string;
  description: ReactNode;
  /** The confirm before turning it off: what happens to people. */
  turnOff: { title: string; description: string };
  children?: ReactNode;
}) {
  const { t } = useTranslation("authentication");
  const save = useSavePolicy(policy);
  const on = policy[method];
  const last = method !== "remember_device_enabled" && isLastMethod(policy, method);

  const toggle = () =>
    save
      .run(
        { [method]: !on },
        on
          ? {
              title: turnOff.title,
              description: turnOff.description,
              confirmLabel: t("methods.turnOff"),
              tone: "destructive",
            }
          : undefined,
      )
      .catch(settleSensitiveAction);

  return (
    <Section
      title={title}
      status={
        <Badge tone={on ? "success" : "neutral"} size="sm">
          {on ? t("methods.on") : t("methods.off")}
        </Badge>
      }
      description={description}
      action={
        canWrite && (
          <Button
            variant="ghost"
            className="am-head-action"
            loading={save.pending}
            disabled={last}
            aria-label={t(on ? "methods.turnOffNamed" : "methods.turnOnNamed", { name: title })}
            onClick={() => void toggle()}
          >
            {on ? t("methods.turnOff") : t("methods.turnOn")}
          </Button>
        )
      }
    >
      {canWrite && last && <p className="account-note">{t("methods.lastMethod")}</p>}
      <Failure error={save.error} />
      {children}
    </Section>
  );
}
