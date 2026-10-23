import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  FieldDescription,
  FieldLabel,
  Input,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TimeSince,
} from "@qeetrix/ui";
import { DataState } from "@/platform/components/data-state";
import { CheckIcon, CopyIcon, KeyRoundIcon, RefreshCwIcon, UsersIcon } from "@qeetrix/icons";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { OneTimeSecret } from "@/shared/components/one-time-secret";
import { PageHeader } from "@/platform/components/page-header";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import { FeatureGate, useEntitlements } from "@/modules/billing";
import {
  scimBaseUrl,
  useRevokeScimToken,
  useRotateScimToken,
  useScimConfig,
  useScimProvisionedUsers,
} from "../api/scim";
import { AuthStatusPill } from "./auth-status-pill";

/** Renders SCIM provisioning: the endpoint and its bearer token, sync stats and provisioned users. */
export function ScimPage() {
  const { t } = useTranslation("auth");
  const runSensitive = useSensitiveAction();
  const cfgQ = useScimConfig();
  const usersQ = useScimProvisionedUsers();
  const rotateM = useRotateScimToken();
  const revokeM = useRevokeScimToken();
  const [freshToken, setFreshToken] = useState<string | null>(null);

  const config = cfgQ.data;
  const enabled = config?.token_set ?? false;
  const busy = rotateM.isPending || revokeM.isPending || cfgQ.isLoading;

  const [copied, setCopied] = useState<string | null>(null);
  const copy = (label: string, value: string) => {
    void navigator.clipboard?.writeText(value);
    setCopied(label);
    window.setTimeout(() => setCopied((c) => (c === label ? null : c)), 1500);
  };

  // A first token replaces nothing; rotating revokes the token the IdP holds, so it confirms first.
  const issueToken = () =>
    runSensitive({
      confirm: enabled
        ? {
            title: t("scim.rotateConfirm.title"),
            description: t("scim.rotateConfirm.description"),
            confirmLabel: t("scim.rotateConfirm.label"),
            tone: "destructive",
          }
        : undefined,
      actionLabel: enabled ? t("scim.stepUp.rotate") : t("scim.stepUp.generate"),
      run: () => rotateM.mutateAsync(),
    })
      .then((res) => {
        if (res) setFreshToken(res.token);
      })
      .catch(settleSensitiveAction);

  const toggle = (next: boolean) => {
    if (next) {
      if (!enabled) issueToken();
      return;
    }
    runSensitive({
      confirm: {
        title: t("scim.disable.title"),
        description: t("scim.disable.description"),
        confirmLabel: t("scim.disable.label"),
        tone: "destructive",
      },
      actionLabel: t("scim.stepUp.disable"),
      run: () => revokeM.mutateAsync(),
    })
      .then(() => setFreshToken(null))
      .catch(settleSensitiveAction);
  };

  const users = usersQ.data?.items ?? [];
  const scimLocked = useEntitlements().data?.features.scim === false;

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PageHeader
        description={t("scim.description")}
        actions={
          scimLocked ? undefined : (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{t("scim.endpointEnabled")}</span>
              <Switch
                checked={enabled}
                onCheckedChange={toggle}
                disabled={busy}
                aria-label={t("scim.endpointEnabled")}
              />
            </div>
          )
        }
      />

      <FeatureGate
        feature="scim"
        title={t("scim.gate.title")}
        description={t("scim.gate.description")}
      >
        {/* A failed load must not read as "not set up". */}
        <DataState
          isLoading={cfgQ.isLoading}
          isError={cfgQ.isError}
          error={cfgQ.error}
          isEmpty={false}
          skeletonRows={1}
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardDescription>{t("scim.stats.provisioned")}</CardDescription>
                <UsersIcon className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold tracking-tight">
                  {config?.provisioned_count ?? "—"}
                </div>
                <p className="text-xs text-muted-foreground">{t("scim.stats.provisionedHelp")}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardDescription>{t("scim.stats.status")}</CardDescription>
                <KeyRoundIcon className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <AuthStatusPill status={enabled ? "active" : "disabled"} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>{t("scim.stats.lastSync")}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold tracking-tight">
                  {config?.last_used_at ? (
                    <TimeSince value={config.last_used_at} />
                  ) : (
                    t("scim.stats.never")
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </DataState>

        {freshToken && (
          <OneTimeSecret
            title={t("scim.token.title")}
            description={t("scim.token.description")}
            values={[{ value: freshToken }]}
            dismissLabel={t("scim.token.saved")}
            onDismiss={() => {
              setFreshToken(null);
              rotateM.reset();
            }}
          />
        )}

        <Card>
          <CardHeader>
            <CardTitle>{t("scim.endpoint.title")}</CardTitle>
            <CardDescription>{t("scim.endpoint.description")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Field>
              <FieldLabel>{t("scim.endpoint.baseUrlLabel")}</FieldLabel>
              <div className="flex gap-2">
                <Input value={scimBaseUrl()} readOnly className="font-mono text-xs" />
                <Button
                  variant="outline"
                  size="icon"
                  aria-label={t("scim.endpoint.copyBaseUrl")}
                  onClick={() => copy("url", scimBaseUrl())}
                >
                  {copied === "url" ? (
                    <CheckIcon className="size-4" />
                  ) : (
                    <CopyIcon className="size-4" />
                  )}
                </Button>
              </div>
              <FieldDescription>{t("scim.endpoint.baseUrlHelp")}</FieldDescription>
            </Field>

            <Field>
              <FieldLabel>{t("scim.endpoint.bearerLabel")}</FieldLabel>
              <div className="flex gap-2">
                <Input
                  value={
                    enabled
                      ? `${config?.token_prefix ?? "qf_scim_"}••••••••••••••••••••••••`
                      : t("scim.endpoint.noToken")
                  }
                  readOnly
                  className="font-mono text-xs"
                />
                <Button variant="outline" onClick={issueToken} disabled={busy}>
                  <RefreshCwIcon
                    className={rotateM.isPending ? "mr-2 size-4 animate-spin" : "mr-2 size-4"}
                  />
                  {enabled ? t("scim.endpoint.rotate") : t("scim.endpoint.generate")}
                </Button>
              </div>
              <FieldDescription>
                {enabled ? t("scim.endpoint.rotateHelp") : t("scim.endpoint.generateHelp")}
              </FieldDescription>
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("scim.users.title")}</CardTitle>
            <CardDescription>{t("scim.users.description")}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <DataState
              isLoading={usersQ.isLoading}
              isError={usersQ.isError}
              error={usersQ.error}
              isEmpty={users.length === 0}
              emptyIcon={UsersIcon}
              emptyTitle={t("scim.users.empty")}
              skeletonRows={3}
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("scim.columns.user")}</TableHead>
                    <TableHead>{t("scim.columns.externalId")}</TableHead>
                    <TableHead>{t("scim.columns.status")}</TableHead>
                    <TableHead>{t("scim.columns.created")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div className="font-medium">{u.display_name || u.email}</div>
                        {u.display_name && (
                          <div className="text-xs text-muted-foreground">{u.email}</div>
                        )}
                      </TableCell>
                      <TableCell className="max-w-55 truncate font-mono text-xs text-muted-foreground">
                        {u.external_id || "—"}
                      </TableCell>
                      <TableCell>
                        <AuthStatusPill status={u.status} />
                      </TableCell>
                      <TableCell>
                        <TimeSince value={u.created_at} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </DataState>
          </CardContent>
        </Card>
      </FeatureGate>
    </div>
  );
}
