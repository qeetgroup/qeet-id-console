import {
  Badge,
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
} from "@qeetrix/ui";
import { DataState } from "@/platform/components/data-state";
import { InfoIcon, KeyRoundIcon } from "@qeetrix/icons";
import { Trans, useTranslation } from "react-i18next";

import { PageHeader } from "@/platform/components/page-header";
import { StatusPill } from "@/platform/components/status-pill";
import { useSigningKeys } from "../api/signing-keys";

// Signing keys rotate by deployment only, never from the console.
const ROTATION_DOCS = "https://docs.id.qeet.in/docs/security/encryption-and-keys";

/** Renders the deployment's token signing keys and how they rotate. */
export function SigningKeysPage() {
  const { t } = useTranslation("signing-keys");
  const keysQ = useSigningKeys();
  const keys = keysQ.data?.keys ?? [];

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader title={t("page.title")} description={t("page.description")} />

      <Card className="border-blue-500/30 bg-blue-50/40 dark:bg-blue-950/20">
        <CardContent className="flex items-start gap-3 py-4">
          <InfoIcon className="mt-0.5 size-4 shrink-0 text-blue-600 dark:text-blue-400" />
          <p className="text-sm text-muted-foreground">
            <Trans
              t={t}
              i18nKey="notice"
              components={{
                activeState: <span className="font-medium text-foreground" />,
                retiredState: <span className="font-medium text-foreground" />,
                procedure: (
                  // biome-ignore lint/a11y/useAnchorContent: Trans fills in the link text.
                  <a
                    href={ROTATION_DOCS}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-foreground underline underline-offset-4"
                  />
                ),
              }}
            />
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("list.title")}</CardTitle>
          <CardDescription>{t("list.count", { count: keys.length })}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <DataState
            isLoading={keysQ.isLoading}
            isError={keysQ.isError}
            error={keysQ.error}
            isEmpty={keys.length === 0}
            emptyIcon={KeyRoundIcon}
            emptyTitle={t("list.emptyTitle")}
            skeletonRows={2}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("table.kid")}</TableHead>
                  <TableHead>{t("table.algorithm")}</TableHead>
                  <TableHead>{t("table.use")}</TableHead>
                  <TableHead>{t("table.status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((k) => (
                  <TableRow key={k.kid}>
                    <TableCell className="font-mono text-xs">{k.kid}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{k.alg}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{k.use}</TableCell>
                    <TableCell>
                      <StatusPill
                        status={k.status}
                        kind={k.status === "active" ? "success" : "muted"}
                      />
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
