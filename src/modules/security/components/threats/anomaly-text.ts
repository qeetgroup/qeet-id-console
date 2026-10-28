import { useTranslation } from "react-i18next";

import type { Anomaly } from "@/modules/security/api/anomalies";
import { anomalyFacts, isType } from "@/modules/security/anomaly-model";

/**
 * An anomaly in words: its kind (one the console doesn't know yet, as the server names it), and
 * what the lockout counted, from its metadata; the server's own sentence (English, `detail`)
 * only when the metadata doesn't say.
 */
export function useAnomalyText() {
  const { t } = useTranslation("security");
  const title = (a: Anomaly): string =>
    isType(a.type) ? t(`anomalies.type.${a.type}`) : a.type.replace(/_/g, " ");
  const line = (a: Anomaly): string => {
    const f = anomalyFacts(a);
    const minutes = f.windowMinutes;
    if (f.accounts !== undefined) {
      return minutes !== undefined
        ? t("anomalies.line.accountsIn", { count: f.accounts, minutes })
        : t("anomalies.line.accounts", { count: f.accounts });
    }
    if (f.failures !== undefined && f.counter === "account") {
      return f.networks && f.networks > 1
        ? t("anomalies.line.networks", { count: f.failures, networks: f.networks })
        : t("anomalies.line.anyNetwork", { count: f.failures });
    }
    if (f.failures !== undefined) {
      return minutes !== undefined
        ? t("anomalies.line.oneNetworkIn", { count: f.failures, minutes })
        : t("anomalies.line.oneNetwork", { count: f.failures });
    }
    return a.detail;
  };
  return { title, line };
}
