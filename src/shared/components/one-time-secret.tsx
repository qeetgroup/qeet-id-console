import { Button, VisuallyHidden } from "@qeetrix/react";
import { Alert, CopyButton } from "@qeetrix/react/experimental";
import { type ReactNode, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import "./one-time-secret.css";

type OneTimeSecretProps = {
  title: ReactNode;
  description: ReactNode; // must say the value is shown only once
  values: { label?: string; value: string }[]; // e.g. a client id beside its secret
  dismissLabel: string;
  onDismiss: () => void;
  children?: ReactNode; // further guidance, such as a quickstart
};

/**
 * Renders a credential the backend returns only once, until dismissed: the warning, then each
 * value in full with its Copy button, which takes focus when it appears. Keep the value in
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
    ref.current?.querySelector<HTMLElement>("[data-slot='one-time-secret-value'] button")?.focus();
  }, []);

  return (
    <div ref={ref} className="one-time-secret" data-slot="one-time-secret">
      <Alert tone="warning" title={title} announce="polite">
        {description}
      </Alert>
      {values.map(({ label, value }) => (
        // Library gap (new): CopyField, a read-only value with its Copy button.
        <div
          key={label ?? value}
          className="one-time-secret-value"
          data-slot="one-time-secret-value"
        >
          <code className="one-time-secret-code">
            {label}
            {value}
          </code>
          <CopyButton value={value} size="lg">
            {t("actions.copy")}{" "}
            <VisuallyHidden>{label?.trim() || t("oneTimeSecret.secret")}</VisuallyHidden>
          </CopyButton>
        </div>
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
