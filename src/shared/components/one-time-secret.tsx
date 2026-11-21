import { Button } from "@qeetrix/react";
import { Alert, CopyField } from "@qeetrix/react/experimental";
import { type ReactNode, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import "./one-time-secret.css";

type OneTimeSecretProps = {
  title: ReactNode;
  description: ReactNode; // must say the value is shown only once
  values: { label?: string; value: string }[]; // e.g. a client id beside its secret ("client_id=")
  dismissLabel: string;
  onDismiss: () => void;
  children?: ReactNode; // further guidance, such as a quickstart
};

/**
 * Renders a credential the backend returns only once, until dismissed: the warning, then each
 * value in full in a CopyField (selected whole by one click), whose Copy button takes focus when it
 * appears. Keep the value in
 * component state only, never the query cache or browser storage, and give the mutation that
 * returns it `gcTime: 0`.
 */
export function OneTimeSecret({
  title,
  description,
  values,
  dismissLabel,
  onDismiss,
  children,
}: OneTimeSecretProps) {
  const { t } = useTranslation("common");
  const ref = useRef<HTMLDivElement>(null);

  // It appears after the action that made the value, so the first Copy is where to go next.
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>("[data-slot='copy-field'] button")?.focus();
  }, []);

  return (
    <div ref={ref} className="one-time-secret" data-slot="one-time-secret">
      <Alert tone="warning" title={title} announce="polite">
        {description}
      </Alert>
      {values.map(({ label, value }) => (
        <CopyField
          key={label ?? value}
          // An env-file name ("client_secret=") names the value without its "=".
          label={label?.replace(/=\s*$/, "").trim() || t("oneTimeSecret.secret")}
          value={value}
          messages={{ copy: `${t("actions.copy")} {label}`, copyPlain: t("actions.copy") }}
        />
      ))}
      {children}
      <div className="one-time-secret-actions">
        <Button variant="soft" onClick={onDismiss}>
          {dismissLabel}
        </Button>
      </div>
    </div>
  );
}
