import { CheckIcon, OctagonPauseIcon, ShieldCheckIcon } from "@qeetrix/icons";
import { Button, Table } from "@qeetrix/react";
import { useTranslation } from "react-i18next";

import { type ShadowAICandidate, useReviewShadowAIClient } from "@/modules/authentication";
import { NameCell, useNumbers, When } from "../parts";

/**
 * OAuth clients with a token-exchange grant (how an AI client acts for a person) that nobody has
 * registered as an agent or reviewed: the server lists them; marking one reviewed takes it off.
 */
export function UnmanagedClients({
  clients,
  now,
  canReview,
}: {
  clients: readonly ShadowAICandidate[];
  now: number;
  canReview: boolean;
}) {
  const { t } = useTranslation("developer");
  const { n } = useNumbers();
  const reviewM = useReviewShadowAIClient();
  return (
    <section
      className="dev-section"
      aria-labelledby="unmanaged-clients-title"
      id="unmanaged-clients"
    >
      <div className="dev-section-head">
        <h2 id="unmanaged-clients-title" className="dev-section-title">
          {t("unmanaged.title")}
        </h2>
      </div>
      <p className="dev-section-note">{t("unmanaged.note")}</p>
      {clients.length ? (
        <Table<ShadowAICandidate>
          label={t("unmanaged.title")}
          rows={clients}
          rowId={(c) => c.id}
          rowLabel={(c) => c.name}
          columns={[
            {
              id: "name",
              header: t("unmanaged.columns.client"),
              primary: true,
              cell: (c) => <NameCell name={c.name} ident={c.client_id} />,
            },
            {
              id: "grants",
              header: t("unmanaged.columns.grants"),
              numeric: true,
              width: 160,
              cell: (c) => t("unmanaged.grants", { count: c.live_grants, n: n(c.live_grants) }),
            },
            {
              id: "created",
              header: t("unmanaged.columns.created"),
              width: 140,
              cell: (c) => <When at={c.created_at} now={now} />,
            },
            ...(canReview
              ? [
                  {
                    id: "review",
                    header: <span className="dev-hidden">{t("unmanaged.columns.review")}</span>,
                    width: 170,
                    align: "end" as const,
                    cell: (c: ShadowAICandidate) => (
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={CheckIcon}
                        loading={reviewM.isPending && reviewM.variables === c.id}
                        onClick={() => reviewM.mutate(c.id)}
                      >
                        {t("unmanaged.review")}
                      </Button>
                    ),
                  },
                ]
              : []),
          ]}
        />
      ) : (
        <p className="dev-quiet">
          <ShieldCheckIcon size={16} aria-hidden="true" />
          {t("unmanaged.none")}
        </p>
      )}
    </section>
  );
}

/** For an agent misbehaving when nobody knows which: every active agent stops at once. */
export function SuspendAll({
  active,
  pending,
  onSuspendAll,
}: {
  active: number;
  pending: boolean;
  onSuspendAll: () => void;
}) {
  const { t } = useTranslation("developer");
  const { n } = useNumbers();
  return (
    <section className="dev-section" aria-labelledby="suspend-all">
      <div className="dev-section-head">
        <h2 id="suspend-all" className="dev-section-title">
          {t("suspendAll.title")}
        </h2>
        <Button
          variant="soft"
          tone="danger"
          size="sm"
          icon={OctagonPauseIcon}
          disabled={!active}
          loading={pending}
          onClick={onSuspendAll}
        >
          {t("suspendAll.button")}
        </Button>
      </div>
      <p className="dev-section-note">
        {active
          ? t("suspendAll.note", { count: active, n: n(active) })
          : t("suspendAll.noneActive")}
      </p>
    </section>
  );
}
