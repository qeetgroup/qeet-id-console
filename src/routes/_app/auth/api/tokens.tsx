import { Key, Trash } from "@qeetrix/icons";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DataState,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TimeSince,
} from "@qeetrix/ui";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import {
  SensitiveActionCancelled,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import { PageHeader } from "@/platform/components/page-header";
import { useOAuthGrants, useRevokeOAuthGrant } from "@/modules/authentication/api/oauth-grants";

export const Route = createFileRoute("/_app/auth/api/tokens")({
  component: TokensPage,
});

function TokensPage() {
  const { t } = useTranslation("auth");
  const runSensitive = useSensitiveAction();
  const ignoreCancel = (e: unknown) => {
    if (!(e instanceof SensitiveActionCancelled)) throw e;
  };
  const listQ = useOAuthGrants();
  const revokeM = useRevokeOAuthGrant();
  const items = listQ.data?.items ?? [];

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PageHeader description={t("tokens.description")} />

      <Card>
        <CardHeader>
          <CardTitle>{t("tokens.list.title")}</CardTitle>
          <CardDescription>{t("tokens.list.count", { count: items.length })}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <DataState
            isLoading={listQ.isLoading}
            isError={listQ.isError}
            error={listQ.error}
            isEmpty={items.length === 0}
            emptyIcon={Key}
            emptyTitle={t("tokens.list.empty")}
            skeletonRows={3}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("tokens.columns.client")}</TableHead>
                  <TableHead>{t("tokens.columns.user")}</TableHead>
                  <TableHead>{t("tokens.columns.scopes")}</TableHead>
                  <TableHead>{t("tokens.columns.issued")}</TableHead>
                  <TableHead>{t("tokens.columns.expires")}</TableHead>
                  <TableHead className="text-right">{t("tokens.columns.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((g) => (
                  <TableRow key={g.id}>
                    <TableCell className="max-w-50 truncate font-mono text-xs">
                      {g.client_id}
                    </TableCell>
                    <TableCell>{g.user_email || g.user_id}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {g.scopes.map((s) => (
                          <Badge key={s} variant="muted" className="text-xs">
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
                        onClick={() =>
                          runSensitive({
                            confirm: {
                              title: t("tokens.confirm.title", {
                                user: g.user_email || t("tokens.confirm.thisUser"),
                                client: g.client_id,
                              }),
                              confirmLabel: t("tokens.confirm.label"),
                              tone: "destructive",
                            },
                            actionLabel: "revoke this authorization",
                            run: () => revokeM.mutateAsync(g.id),
                          }).catch(ignoreCancel)
                        }
                        disabled={revokeM.isPending}
                      >
                        <Trash /> {t("tokens.revoke")}
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
