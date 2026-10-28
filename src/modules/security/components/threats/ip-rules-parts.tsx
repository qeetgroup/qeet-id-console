import { Badge, Button, Radio, RadioGroup, Text, TextField } from "@qeetrix/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import {
  type IpAction,
  type IpRule,
  useAddIpRule,
  useCheckIp,
} from "@/modules/security/api/ip-allowlist";
import { decide, parsePrefix } from "@/modules/security/ip-model";
import { errorMessage } from "@/platform/errors/user-message";
import {
  SensitiveActionCancelled,
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import { Failure, Panel } from "../security-parts";

/**
 * Whether an address may sign in under the rules. While they're enforced the server answers;
 * while they're off it would say "allowed" for every address, so the page judges the address
 * against the stored rules itself, the server's way (ip-model.ts).
 */
export function AddressCheck({ enabled, rules }: { enabled: boolean; rules: readonly IpRule[] }) {
  const { t } = useTranslation("security");
  const check = useCheckIp();
  const [ip, setIp] = useState("");
  const [result, setResult] = useState<{
    allowed: boolean;
    reason?: string;
    cidr?: string;
    local: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    const value = ip.trim();
    setError(null);
    if (!value) {
      setError(t("ipRules.check.required"));
      return;
    }
    if (!enabled) {
      const d = decide(rules, value);
      setResult(d.allowed ? { allowed: true, local: true } : { ...d, local: true });
      return;
    }
    try {
      const res = await check.mutateAsync(value);
      const code = (res.reason_code ?? "").replace(/^ip\./, "");
      setResult({
        allowed: res.allowed,
        reason: code,
        cidr: res.reason_params?.cidr,
        local: false,
      });
    } catch (err) {
      setResult(null);
      setError(errorMessage(err));
    }
  };

  const reason = (r: NonNullable<typeof result>) => {
    if (r.allowed)
      return rules.length ? t("ipRules.check.allowedLine") : t("ipRules.check.noRules");
    if (r.reason === "deny_rule")
      return r.cidr
        ? t("ipRules.check.denyRule", { cidr: r.cidr })
        : t("ipRules.check.denyRuleUnnamed");
    if (r.reason === "not_in_allow_rules") return t("ipRules.check.notAllowed");
    if (r.reason === "address_unknown") return t("ipRules.check.unknown");
    return "";
  };

  return (
    <div className="account-detail sec-check">
      <dt>{t("ipRules.check.label")}</dt>
      <dd>
        <form
          className="sec-check-form"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void run();
          }}
        >
          <TextField
            label={t("ipRules.check.label")}
            hideLabel
            className="sec-mono-field"
            placeholder={t("ipRules.check.placeholder")}
            value={ip}
            onValueChange={(value) => {
              setIp(value);
              setResult(null);
              setError(null);
            }}
            error={error ?? undefined}
            autoComplete="off"
            spellCheck={false}
          />
          <Button type="submit" variant="soft" loading={check.isPending}>
            {t("ipRules.check.button")}
          </Button>
        </form>
        {result ? (
          <span className="sec-check-result" aria-live="polite">
            <Badge size="sm" tone={result.allowed ? "success" : "danger"}>
              {result.allowed ? t("ipRules.check.allowed") : t("ipRules.check.refused")}
            </Badge>
            <small className="sec-check-line">
              {reason(result)}
              {result.local ? ` ${t("ipRules.check.whileOff")}` : ""}
            </small>
          </span>
        ) : null}
      </dd>
      <dd className="account-detail-action" />
    </div>
  );
}

/**
 * Add a rule, in place: the range is read as the server reads it before anything is sent. While
 * the rules are enforced it applies at once, so it asks first, saying what it does.
 */
export function AddRule({
  enabled,
  rules,
  onDone,
}: {
  enabled: boolean;
  rules: readonly IpRule[];
  onDone: () => void;
}) {
  const { t } = useTranslation("security");
  const runSensitive = useSensitiveAction();
  const add = useAddIpRule();
  const [cidr, setCidr] = useState("");
  const [label, setLabel] = useState("");
  const [action, setAction] = useState<IpAction>("allow");
  const [error, setError] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const submit = () => {
    const value = cidr.trim();
    if (!value) return setError(t("ipRules.add.required"));
    if (!parsePrefix(value)) return setError(t("ipRules.add.invalid"));
    setError(null);
    setFailure(null);
    const firstAllow = action === "allow" && !rules.some((r) => r.action === "allow");
    runSensitive({
      capability: "policy.write",
      confirm: enabled
        ? {
            title: t("ipRules.add.confirmTitle", { cidr: value }),
            description:
              action === "deny"
                ? t("ipRules.add.confirmDeny", { cidr: value })
                : firstAllow
                  ? t("ipRules.add.confirmFirstAllow", { cidr: value })
                  : t("ipRules.add.confirmAllow", { cidr: value }),
            confirmLabel: t("ipRules.add.button"),
            tone: action === "deny" || firstAllow ? "destructive" : "default",
          }
        : undefined,
      actionLabel: t("ipRules.add.action"),
      run: () => add.mutateAsync({ cidr: value, label: label.trim(), action }),
    })
      .then((rule) => rule && onDone())
      .catch((err: unknown) => {
        if (err instanceof SensitiveActionCancelled) return;
        // The add hook keeps its error for this form: a rule that would lock you out says so here.
        setFailure(errorMessage(err));
        settleSensitiveAction(err);
      });
  };

  return (
    <Panel as="li" title={t("ipRules.add.title")}>
      <form
        className="account-panel-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <TextField
          label={t("ipRules.add.range")}
          className="sec-mono-field"
          placeholder={t("ipRules.add.rangePlaceholder")}
          description={t("ipRules.add.rangeHint")}
          value={cidr}
          onValueChange={(value) => {
            setCidr(value);
            setError(null);
          }}
          error={error ?? undefined}
          autoComplete="off"
          spellCheck={false}
          autoFocus
        />
        <TextField
          label={t("ipRules.add.label")}
          optional
          placeholder={t("ipRules.add.labelPlaceholder")}
          value={label}
          onValueChange={setLabel}
          maxLength={200}
        />
        <RadioGroup
          label={t("ipRules.add.effect")}
          orientation="horizontal"
          value={action}
          onValueChange={(value) => setAction(value === "deny" ? "deny" : "allow")}
        >
          <Radio value="allow" label={t("ipRules.effect.allow")} />
          <Radio value="deny" label={t("ipRules.effect.deny")} />
        </RadioGroup>
        <Text tone="subtle" size="sm">
          {action === "deny" ? t("ipRules.add.denyHint") : t("ipRules.add.allowHint")}
        </Text>
        {failure ? <Failure>{failure}</Failure> : null}
        <div className="account-panel-actions">
          <Button variant="ghost" onClick={onDone}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" loading={add.isPending}>
            {t("ipRules.add.button")}
          </Button>
        </div>
      </form>
    </Panel>
  );
}
