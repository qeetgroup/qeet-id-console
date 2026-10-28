import { Trans } from "react-i18next";

import { errorMessage, errorReference } from "@/platform/errors/user-message";

import "./error-reference.css";

/**
 * Renders a failed request's support reference, the id the backend logged it under, or nothing
 * when the error has none. One click selects the id for copying.
 */
export function ErrorReference({ error, className }: { error: unknown; className?: string }) {
  const requestId = errorReference(error);
  if (!requestId) return null;
  return (
    <span className={className ? `error-reference ${className}` : "error-reference"}>
      <Trans
        ns="errors"
        i18nKey="referenceLabel"
        values={{ id: requestId }}
        components={{ id: <span className="error-reference-id" /> }}
      />
    </span>
  );
}

/** Renders an error's user-safe message followed by its support reference. */
export function ErrorText({ error }: { error: unknown }) {
  return (
    <>
      {errorMessage(error)}
      <ErrorReference error={error} className="error-reference-after" />
    </>
  );
}
