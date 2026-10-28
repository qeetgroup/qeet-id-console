import { ArrowDownIcon, ArrowRightIcon, CircleCheckIcon, CircleXIcon } from "@qeetrix/icons";
import { Avatar, Badge, formatNumber, Link, Table } from "@qeetrix/react";
import {
  DescriptionItem,
  DescriptionList,
  Timeline,
  TimelineItem,
} from "@qeetrix/react/experimental";
import { Link as RouterLink } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import { usePersonAccess } from "@/modules/authorization/api/people";
import type { RbacExplainPath, RebacPathStep } from "@/modules/authorization/api/simulate";
import type { TraceStep } from "@/modules/authorization/components/explain/decision-trace";
import { nameOf, usePeople, userIdOf } from "@/modules/authorization/components/shared/use-people";

/**
 * The answer to a check: allowed or denied, in words, and why. `compact` puts the verdict on one
 * line with the reason under it, for an output panel. The result is announced politely: no toast.
 */
export function Answer({
  allowed,
  question,
  reason,
  meta,
  compact,
}: {
  allowed: boolean;
  question?: ReactNode;
  reason: ReactNode;
  meta?: ReactNode;
  compact?: boolean;
}) {
  const { t } = useTranslation("authorization");
  const Icon = allowed ? CircleCheckIcon : CircleXIcon;
  const verdict = (
    <Badge tone={allowed ? "success" : "danger"} variant="solid">
      {allowed ? t("answer.allowed") : t("answer.denied")}
    </Badge>
  );
  if (compact)
    return (
      <div className="ws-answer" data-allowed={allowed} data-compact="" aria-live="polite">
        <p className="ws-answer-line">
          <span className="ws-answer-icon" aria-hidden="true">
            <Icon size={20} />
          </span>
          {verdict}
          {meta ? <span className="ws-answer-meta">{meta}</span> : null}
        </p>
        <p className="ws-answer-reason">{reason}</p>
      </div>
    );
  return (
    <div className="ws-answer" data-allowed={allowed} aria-live="polite">
      <span className="ws-answer-icon" aria-hidden="true">
        <Icon size={20} />
      </span>
      <div className="ws-answer-text">
        {question ? <p className="ws-answer-q">{question}</p> : null}
        <p className="ws-answer-title">
          {verdict}
          <span>{reason}</span>
        </p>
      </div>
      {meta ? <div className="ws-answer-meta">{meta}</div> : null}
    </div>
  );
}

/** A trace in the order it was checked: where, what, and what it came to. */
export function TraceList({ steps }: { steps: readonly TraceStep[] }) {
  const { t } = useTranslation("authorization");
  if (steps.length === 0) return <p className="ws-note">{t("trace.none")}</p>;
  return (
    <Timeline variant="compact" className="ws-trace">
      {steps.map((step, i) => (
        <TimelineItem
          // biome-ignore lint/suspicious/noArrayIndexKey: steps keep their order, and can repeat
          key={i}
          tone={step.tone}
          title={step.title}
          description={step.where || undefined}
          time={step.outcome || undefined}
        />
      ))}
    </Timeline>
  );
}

/** The roles behind an allowed permission: each, directly or through a group, grants it alone. */
export function GrantPaths({ paths }: { paths: readonly RbacExplainPath[] }) {
  const { t } = useTranslation("authorization");
  return (
    <Table<RbacExplainPath>
      label={t("grants.label")}
      rows={paths}
      rowId={(p) => `${p.role_id}-${p.group_id ?? p.via}`}
      rowLabel={(p) => p.granted_by.replace(/^role:/, "")}
      columns={[
        {
          id: "role",
          header: t("grants.role"),
          primary: true,
          cell: (p) => p.granted_by.replace(/^role:/, ""),
        },
        {
          id: "via",
          header: t("grants.through"),
          cell: (p) =>
            p.via.startsWith("group:") && p.group_id ? (
              <Link
                href={`/groups/${p.group_id}`}
                render={<RouterLink to="/groups/$groupId" params={{ groupId: p.group_id }} />}
              >
                {t("grants.group", { group: p.via.slice("group:".length) })}
              </Link>
            ) : (
              t("grants.direct")
            ),
        },
        {
          id: "id",
          header: t("grants.roleId"),
          width: 112,
          cell: (p) => <code className="ws-code ws-subtle">{p.role_id.slice(0, 8)}</code>,
        },
      ]}
    />
  );
}

/** A relationship path: each hop an object and its relation, down to the subject. */
export function Hops({
  path,
  column,
}: {
  path: readonly Pick<RebacPathStep, "object" | "relation" | "subject">[];
  column?: boolean;
}) {
  const { t } = useTranslation("authorization");
  const people = usePeople();
  const Arrow = column ? ArrowDownIcon : ArrowRightIcon;
  const last = path.at(-1);
  if (!last) return null;
  const userId = userIdOf(last.subject);
  return (
    <ol
      className="ws-hops"
      data-direction={column ? "column" : undefined}
      aria-label={t("hops.label")}
    >
      {path.map((hop) => (
        <li key={`${hop.object}#${hop.relation}`} className="ws-hop">
          <code className="ws-code">
            {hop.object}
            <span className="ws-subtle">#{hop.relation}</span>
          </code>
          <Arrow size={16} aria-hidden="true" />
        </li>
      ))}
      <li className="ws-hop">
        <strong>{(userId && people.name(userId)) || last.subject}</strong>
      </li>
    </ol>
  );
}

/**
 * Who a check is about: their roles, groups and permission counts (GET /v1/users/{id}/access),
 * and what the organisation records about them.
 */
export function PersonFacts({ userId }: { userId: string }) {
  const { t } = useTranslation("authorization");
  const people = usePeople();
  const access = usePersonAccess(userId, people.canRead);
  const user = people.byId.get(userId);
  const locale = formatLocale();
  if (!people.canRead) return <p className="ws-note ws-pad">{t("person.noUserRead")}</p>;
  if (!user && !people.loading)
    return <p className="ws-note ws-pad">{t("person.notFound", { id: userId })}</p>;
  if (!user) return null;
  const meta = (user.metadata ?? {}) as Record<string, unknown>;
  const text = (v: unknown) => (typeof v === "string" && v.trim() ? v : undefined);
  const a = access.data;
  return (
    <div className="ws-person">
      <div className="ws-person-head">
        <Avatar name={nameOf(user)} src={user.avatar_url ?? undefined} size="md" decorative />
        <span className="ws-person-name">
          <strong>{nameOf(user)}</strong>
          <small>{user.email}</small>
        </span>
        {user.status === "suspended" ? (
          <Badge tone="warning" size="sm">
            {t("person.suspended")}
          </Badge>
        ) : null}
      </div>
      <DescriptionList layout="rows">
        <DescriptionItem term={t("person.roles")}>
          {a?.roles.length ? (
            <span className="ws-tags">
              {a.roles.map((r) => (
                <Badge key={r.id} size="sm">
                  {r.name}
                </Badge>
              ))}
            </span>
          ) : a ? (
            t("person.noRoles")
          ) : null}
        </DescriptionItem>
        <DescriptionItem term={t("person.groups")}>
          {a ? a.groups.map((g) => g.name).join(", ") || t("person.noGroups") : null}
        </DescriptionItem>
        <DescriptionItem term={t("person.permissions")}>
          {a
            ? t("person.permissionCount", {
                count: a.permissions_total,
                total: formatNumber(a.permissions_total, locale),
                inherited: formatNumber(a.permissions_inherited, locale),
              })
            : null}
        </DescriptionItem>
        <DescriptionItem term={t("person.department")}>{text(meta.department)}</DescriptionItem>
        <DescriptionItem term={t("person.title")}>{text(meta.title)}</DescriptionItem>
      </DescriptionList>
    </div>
  );
}
