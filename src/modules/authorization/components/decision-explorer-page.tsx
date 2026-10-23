import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
} from "@qeetrix/ui";
import { Link } from "@tanstack/react-router";
import { SearchCodeIcon, TrashIcon } from "@qeetrix/icons";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { PageHeader } from "@/platform/components/page-header";
import { DecisionExplain } from "./explain/decision-explain";
import { DecisionBadge, ENGINE_LABELS } from "./shared/decision-badge";
import { clearHistory, useDecisionHistory } from "../store/authz-store";

/** Renders the decisions made in this browser session, each explained. */
export function DecisionExplorerPage() {
  const { t } = useTranslation("rbac");
  const history = useDecisionHistory();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Default-select the newest decision as it arrives.
  useEffect(() => {
    const newest = history[0];
    if (newest && !history.some((r) => r.id === selectedId)) {
      setSelectedId(newest.id);
    }
  }, [history, selectedId]);

  const selected = history.find((r) => r.id === selectedId) ?? null;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader
        description={t("decisionExplorerPage.inspectAuthorizationDecisionsLike")}
        actions={
          history.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => clearHistory()}>
              <TrashIcon /> {t("decisionExplorerPage.clearHistory")}
            </Button>
          )
        }
      />

      {history.length === 0 ? (
        <Card>
          <CardContent className="py-6">
            <EmptyState
              icon={SearchCodeIcon}
              title={t("decisionExplorerPage.noDecisionsCapturedYet")}
              description={t("decisionExplorerPage.runACheckFrom")}
              action={
                <Button
                  nativeButton={false}
                  render={<Link to="/authorization/simulator" />}
                  size="sm"
                >
                  {t("decisionExplorerPage.openSimulator")}
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
          <Card className="min-w-0">
            <CardHeader>
              <CardTitle className="text-base">
                {t("decisionExplorerPage.recentDecisions")}
              </CardTitle>
              <CardDescription>
                {t("decisionExplorerPage.capturedCount", { count: history.length })}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y">
                {history.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(r.id)}
                      aria-current={r.id === selectedId ? "true" : undefined}
                      className={`flex w-full items-center gap-2 p-3 text-left hover:bg-muted/40 ${r.id === selectedId ? "bg-muted/60" : ""}`}
                    >
                      <DecisionBadge allowed={r.allowed} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-medium">{ENGINE_LABELS[r.engine]}</span>
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {new Date(r.at).toLocaleTimeString()} ·{" "}
                          {t("simulator.batch.ms", { count: r.durationMs })}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="min-w-0">
            <CardHeader>
              <CardTitle className="text-base">
                {t("decisionExplorerPage.decisionDetail")}
              </CardTitle>
              <CardDescription>{t("decisionExplorerPage.fullEvaluationBreakdown")}</CardDescription>
            </CardHeader>
            <CardContent>{selected && <DecisionExplain record={selected} />}</CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
