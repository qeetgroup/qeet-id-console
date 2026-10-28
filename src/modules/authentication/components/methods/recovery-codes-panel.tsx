import { DownloadIcon } from "@qeetrix/icons";
import { Button, Checkbox } from "@qeetrix/react";
import { CopyButton } from "@qeetrix/react/experimental";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { downloadBlob } from "@/shared/utils/data-export";
import { Panel } from "./methods-parts";

/**
 * A fresh set of recovery codes, shown once, in the sign-in setup's numbered grid (its
 * `.entry-codes` styles): copy or download them, and say they're saved before closing.
 */
export function RecoveryCodesPanel({
  codes,
  onDone,
  as,
}: {
  codes: string[];
  onDone: () => void;
  as?: "div" | "li";
}) {
  const { t } = useTranslation("authentication");
  const [saved, setSaved] = useState(false);
  return (
    <Panel as={as} title={t("totp.codes.saveTitle")} description={t("totp.codes.saveDescription")}>
      <div className="account-panel-form">
        <div className="entry-codes">
          <div className="entry-codes-head">
            {t("totp.codes.count", { count: codes.length })}
            <div>
              <CopyButton size="sm" value={codes.join("\n")} label={t("totp.codes.copyLabel")}>
                {t("totp.codes.copy")}
              </CopyButton>
              <Button
                variant="ghost"
                tone="neutral"
                size="sm"
                icon={DownloadIcon}
                onClick={() =>
                  downloadBlob(`${codes.join("\n")}\n`, "text/plain", "qeet-id-recovery-codes.txt")
                }
              >
                {t("totp.codes.download")}
              </Button>
            </div>
          </div>
          <ol>
            {codes.map((code) => (
              <li key={code}>{code}</li>
            ))}
          </ol>
        </div>
        <Checkbox
          label={t("totp.codes.saved")}
          checked={saved}
          onCheckedChange={(checked) => setSaved(checked === true)}
        />
        <span className="account-panel-actions">
          <Button size="lg" disabled={!saved} onClick={onDone}>
            {t("totp.codes.done")}
          </Button>
        </span>
      </div>
    </Panel>
  );
}
