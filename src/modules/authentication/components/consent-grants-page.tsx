import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TimeSince,
} from "@qeetrix/ui";
import { DataState } from "@/platform/components/data-state";
import { KeyRoundIcon, RefreshCwIcon, TrashIcon } from "@qeetrix/icons";
import { useTranslation } from "react-i18next";

import { PageHeader } from "@/platform/components/page-header";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import { type OAuthGrant, useOAuthGrants, useRevokeOAuthGrant } from "../api/oauth-grants";

/** Renders the consents people gave applications, with revoke. */
export function ConsentGrantsPage() {
  const { t } = useTranslation(["consent", "common"]);
  const runSensitive = useSensitiveAction();
  const listQ = useOAuthGrants();
  const revokeM = useRevokeOAuthGrant();

  const items = listQ.data?.items ?? [];

  // Revoking ends the application's access for that person, so it confirms first.
  const revoke = (grant: OAuthGrant) =>
    runSensitive({
      confirm: {
        title: t("revoke.title"),
        description: grant.user_email
          ? t("revoke.confirmDescription", { email: grant.user_email })
          : t("revoke.descriptionFallback"),
        confirmLabel: t("common:actions.revoke"),
        tone: "destructive",
      },
      actionLabel: t("revoke.stepUp"),
      run: () => revokeM.mutateAsync(grant.id),
    }).catch(settleSensitiveAction);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader
        title={t("page.title")}
        description={t("page.description")}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => listQ.refetch()}
            disabled={listQ.isFetching}
          >
            <RefreshCwIcon className={listQ.isFetching ? "animate-spin" : ""} />
            {t("common:actions.refresh")}
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("list.title")}</CardTitle>
          <CardDescription>{t("list.count", { count: items.length })}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <DataState
            isLoading={listQ.isLoading}
            isError={listQ.isError}
            error={listQ.error}
            isEmpty={items.length === 0}
            emptyIcon={KeyRoundIcon}
            emptyTitle={t("list.emptyTitle")}
            emptyDescription={t("list.emptyDescription")}
            skeletonRows={3}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("table.application")}</TableHead>
                  <TableHead>{t("table.user")}</TableHead>
                  <TableHead>{t("table.scopes")}</TableHead>
                  <TableHead>{t("table.issued")}</TableHead>
                  <TableHead>{t("table.expires")}</TableHead>
                  <TableHead className="text-right">{t("table.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((g) => (
                  <TableRow key={g.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {g.client_id.slice(0, 16)}…
                    </TableCell>
                    <TableCell className="font-medium">{g.user_email}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {g.scopes.map((s) => (
                          <Badge key={s} variant="muted">
                            {s}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <TimeSince value={g.issued_at} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <TimeSince value={g.expires_at} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => revoke(g)}
                        disabled={revokeM.isPending}
                      >
                        <TrashIcon /> {t("common:actions.revoke")}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DataState>
        </CardContent>
      </Card>
    </div>
  );
}
