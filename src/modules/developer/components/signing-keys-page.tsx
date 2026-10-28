import { ArrowRightIcon, FileKeyIcon } from "@qeetrix/icons";
import { Badge, type BadgeTone, formatDate, Table, type TableColumn } from "@qeetrix/react";
import {
  CopyButton,
  DataState,
  EmptyState,
  PageContent,
  PageHeader,
} from "@qeetrix/react/experimental";
import { useTranslation } from "react-i18next";

import { PageBreadcrumb } from "@/modules/dashboard";
import { getApiBaseUrl } from "@/platform/config/api-base-url";
import { type SigningKey, useSigningKeys } from "../api/signing-keys";
import { DevSection, NameCell, useNumbers, When } from "./parts";
import "./developer.css";

// A key's life, in order: published first, then signing, then only verifying.
const STAGES = ["candidate", "active", "retired"] as const;
const TONE: Record<SigningKey["status"], BadgeTone> = {
  candidate: "info",
  active: "success",
  retired: "neutral",
};

/**
 * Developer › Signing keys: the deployment's key set, shared by every organisation. The stages are
 * the picture (next, signing, retired, each with its keys and what it does), then the keys. They
 * rotate in the deployment: the console only shows them.
 */
export function SigningKeysPage() {
  const { t } = useTranslation("developer");
  const { locale } = useNumbers();
  const keysQ = useSigningKeys();
  const keys = keysQ.data?.keys ?? [];
  const now = keysQ.dataUpdatedAt || Date.now();
  const jwks = `${new URL(getApiBaseUrl()).origin}/.well-known/jwks.json`;
  const order = (k: SigningKey) => STAGES.indexOf(k.status);
  const sorted = [...keys].sort((a, b) => order(a) - order(b));

  const columns: TableColumn<SigningKey>[] = [
    {
      id: "kid",
      header: t("signingKeys.columns.key"),
      primary: true,
      cell: (k) => (
        <NameCell
          name={t(`signingKeys.role.${k.status}`)}
          ident={k.kid}
          copy={t("signingKeys.copyKid")}
        />
      ),
    },
    {
      id: "alg",
      header: t("signingKeys.columns.alg"),
      width: 140,
      cell: (k) => <code className="dev-code">{k.alg}</code>,
    },
    {
      id: "stage",
      header: t("signingKeys.columns.stage"),
      width: 130,
      cell: (k) => (
        <Badge tone={TONE[k.status]} size="sm">
          {t(`signingKeys.stage.${k.status}`)}
        </Badge>
      ),
    },
    {
      id: "until",
      header: t("signingKeys.columns.until"),
      width: 170,
      cell: (k) =>
        k.status === "retired" && k.retire_at ? (
          <When at={k.retire_at} now={now} />
        ) : (
          <span className="dev-subtle">{t("signingKeys.whileInUse")}</span>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        breadcrumb={<PageBreadcrumb />}
        title={t("signingKeys.title")}
        count={keysQ.data ? keys.length : undefined}
        description={t("signingKeys.description")}
        actions={
          <CopyButton value={jwks} variant="ghost">
            {t("signingKeys.copyJwks")}
          </CopyButton>
        }
      />
      <PageContent>
        <div className="dev-page">
          <DataState
            loading={keysQ.isLoading}
            error={keysQ.isError ? keysQ.error : undefined}
            onRetry={() => void keysQ.refetch()}
            empty={!keys.length}
            emptyState={
              <EmptyState
                size="section"
                icon={FileKeyIcon}
                title={t("signingKeys.empty.title")}
                description={t("signingKeys.empty.description")}
              />
            }
          >
            <DevSection
              id="key-stages"
              title={t("signingKeys.stagesTitle")}
              note={t("signingKeys.stagesNote")}
            >
              <ol className="dev-stages">
                {STAGES.map((stage, i) => {
                  const here = sorted.filter((k) => k.status === stage);
                  return (
                    <li key={stage} className={here.length ? "dev-stage" : "dev-stage is-empty"}>
                      <div className="dev-stage-head">
                        <Badge tone={TONE[stage]} size="sm">
                          {t(`signingKeys.stage.${stage}`)}
                        </Badge>
                        {i < STAGES.length - 1 ? (
                          <ArrowRightIcon
                            size={16}
                            className="dev-stage-arrow"
                            aria-hidden="true"
                          />
                        ) : null}
                      </div>
                      <p className="dev-stage-what">{t(`signingKeys.does.${stage}`)}</p>
                      {here.length ? (
                        <ul className="dev-stage-keys">
                          {here.map((k) => (
                            <li key={k.kid}>
                              <code title={k.kid}>
                                {k.kid.length > 14 ? `${k.kid.slice(0, 10)}…` : k.kid}
                              </code>
                              {k.status === "retired" && k.retire_at ? (
                                <small>
                                  {t("signingKeys.publishedUntil", {
                                    date: formatDate(k.retire_at, locale, { dateStyle: "medium" }),
                                  })}
                                </small>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="dev-stage-none">{t(`signingKeys.none.${stage}`)}</p>
                      )}
                    </li>
                  );
                })}
              </ol>
            </DevSection>
            <DevSection
              id="key-set"
              title={t("signingKeys.setTitle")}
              note={t("signingKeys.setNote")}
            >
              <Table<SigningKey>
                label={t("signingKeys.setTitle")}
                rows={sorted}
                rowId={(k) => k.kid}
                rowLabel={(k) => k.kid}
                columns={columns}
              />
            </DevSection>
          </DataState>
        </div>
      </PageContent>
    </>
  );
}
