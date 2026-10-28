import { FlaskConicalIcon } from "@qeetrix/icons";
import {
  Badge,
  Button,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  Heading,
  Table,
  Text,
} from "@qeetrix/react";
import { DescriptionItem, DescriptionList } from "@qeetrix/react/experimental";
import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { SplitBar } from "@/modules/dashboard";
import type { AbacPolicy } from "@/modules/authorization/api/abac";
import type { Permission } from "@/modules/authorization/api/rbac";
import type { RoleAccessView } from "@/modules/authorization/api/role-access";
import { holdersByPermission, shortList } from "@/modules/authorization/role-model";
import { EffectWord, NoneCell, useCount, useResourceName } from "../lists/authz-parts";
import {
  GUARDS,
  guardOf,
  isOpenAllow,
  type ResourceFilters,
  type ResourceRow,
  SWATCH,
} from "./resources-model";

/** A resource's own policies: each its effect and name, "Off" when turned off. */
export function PolicyLines({ policies }: { policies: readonly AbacPolicy[] }) {
  const { t } = useTranslation("authorization");
  if (!policies.length) return <NoneCell />;
  return (
    <span className="authz-two">
      {policies.map((p) => (
        <span key={p.id} className="authz-inline">
          <span className="authz-clip" title={p.name}>
            <EffectWord effect={p.effect} /> {p.name}
          </span>
          {!p.enabled ? <Badge size="sm">{t("lists.common.off")}</Badge> : null}
        </span>
      ))}
    </span>
  );
}

/**
 * The resources' key numbers: how many, which guard them (roles, policies or both), and the
 * policies that need a look: turned off, and allows with no condition (they let everyone through).
 */
export function ResourcesBand({
  all,
  policies,
  canPolicies,
}: {
  all: ResourceRow[];
  policies: readonly AbacPolicy[];
  canPolicies: boolean;
}) {
  const { t } = useTranslation("authorization");
  const n = useCount();
  const to = (search: ResourceFilters) => ({ to: "/authorization/resources" as const, search });
  const qeet = all.filter((r) => r.source === "qeet").length;
  const guards = GUARDS.map((id) => ({ id, count: all.filter((r) => guardOf(r) === id).length }));
  const looks = [
    { id: "off" as const, count: policies.filter((p) => !p.enabled).length },
    { id: "open" as const, count: policies.filter(isOpenAllow).length },
  ];
  return (
    <dl className={canPolicies ? "ppl-band is-three" : "ppl-band authz-band-two"}>
      <div className="ppl-cell">
        <dt className="ppl-label">{t("lists.resources.band.resources")}</dt>
        <dd className="ppl-value">{n(all.length)}</dd>
        <dd className="ppl-note">
          {t("lists.resources.band.note", { qeet: n(qeet), policy: n(all.length - qeet) })}
        </dd>
      </div>
      <div className="ppl-cell">
        <dt className="ppl-label">{t("lists.resources.band.guarded")}</dt>
        <dd className="ppl-recency">
          <SplitBar
            label={guards
              .map((g) => `${n(g.count)} ${t(`lists.resources.band.guardedLegend.${g.id}`)}`)
              .join(", ")}
            parts={guards.map((g) => ({ value: g.count, color: `var(--ppl-${SWATCH[g.id]})` }))}
          />
        </dd>
        <dd className="ppl-recency-legend">
          <ul>
            {guards.map((g) => (
              <li key={g.id} className={g.count ? undefined : "is-zero"}>
                <Link {...to({ guard: g.id })}>
                  <span className={`ppl-swatch is-${SWATCH[g.id]}`} aria-hidden="true" />
                  <b>{n(g.count)}</b> {t(`lists.resources.band.guardedLegend.${g.id}`)}
                </Link>
              </li>
            ))}
          </ul>
        </dd>
      </div>
      {canPolicies ? (
        <div className="ppl-cell">
          <dt className="ppl-label">{t("lists.common.needsALook")}</dt>
          <dd className="ppl-looks">
            <ul>
              {looks.map((look) => (
                <li key={look.id} className={look.count ? undefined : "is-zero"}>
                  <Link {...to({ look: look.id })}>
                    <span>{t(`lists.resources.band.looks.${look.id}`)}</span>
                    <b className={look.count && look.id === "open" ? "is-warning" : undefined}>
                      {n(look.count)}
                    </b>
                  </Link>
                </li>
              ))}
            </ul>
          </dd>
        </div>
      ) : null}
    </dl>
  );
}

/** A resource opened: who can act on it (by permission), then the policies that apply to it. */
export function ResourceDrawerContent({
  row,
  view,
  everywhere,
  canPolicies,
}: {
  row: ResourceRow;
  view: RoleAccessView;
  everywhere: readonly AbacPolicy[];
  canPolicies: boolean;
}) {
  const { t } = useTranslation("authorization");
  const n = useCount();
  const resourceName = useResourceName();
  const holders = useMemo(() => holdersByPermission(view.access), [view.access]);
  const known = view.peopleKnown && view.groupsKnown;
  const everyone = view.people?.length ?? 0;
  const and = {
    and: t("lists.common.and"),
    more: (m: number) => t("lists.common.more", { n: n(m) }),
  };
  const grantedBy = (p: Permission) =>
    view.access.filter((a) => a.permissions?.has(p.key)).map((a) => a.role.name);

  return (
    <DrawerContent
      title={resourceName(row.key)}
      description={<span className="authz-mono">{row.key}</span>}
      size="md"
    >
      <DrawerBody>
        <div className="authz-drawer">
          <section className="authz-drawer-section">
            <div className="authz-drawer-head">
              <Heading level={3} size="title-sm">
                {t("lists.resources.drawer.whoCanAct")}
              </Heading>
            </div>
            <Text size="sm" tone="subtle" render={<p className="authz-drawer-note" />}>
              {row.source === "qeet"
                ? t("lists.resources.drawer.qeetNote")
                : t("lists.resources.drawer.policyNote")}
            </Text>
            {row.permissions.length ? (
              <Table<Permission>
                label={t("lists.resources.drawer.whoCanAct")}
                rows={row.permissions}
                rowId={(p) => p.id}
                rowLabel={(p) => p.key}
                columns={[
                  {
                    id: "permission",
                    header: t("lists.resources.drawer.permission"),
                    width: 150,
                    cell: (p) => <span className="authz-mono">{p.key}</span>,
                  },
                  {
                    id: "roles",
                    header: t("lists.resources.drawer.grantedBy"),
                    cell: (p) => {
                      const roles = grantedBy(p);
                      return roles.length ? shortList(roles, and) : <NoneCell />;
                    },
                  },
                  ...(known
                    ? [
                        {
                          id: "people",
                          header: t("lists.resources.drawer.people"),
                          numeric: true,
                          width: 90,
                          cell: (p: Permission) => {
                            const count = holders.get(p.key)?.size ?? 0;
                            return everyone && count >= everyone
                              ? t("lists.common.everyone")
                              : n(count);
                          },
                        },
                      ]
                    : []),
                ]}
              />
            ) : null}
          </section>

          {canPolicies ? (
            <section className="authz-drawer-section">
              <div className="authz-drawer-head">
                <Heading level={3} size="title-sm">
                  {t("lists.resources.drawer.policies")}
                </Heading>
              </div>
              <DescriptionList className="authz-facts">
                <DescriptionItem term={t("lists.resources.drawer.own")}>
                  <PolicyLines policies={row.policies} />
                </DescriptionItem>
                <DescriptionItem term={t("lists.resources.drawer.onEvery")}>
                  {everywhere.length ? (
                    <span className="authz-two">
                      {everywhere.map((p) => (
                        <span key={p.id} className="authz-inline">
                          <span>
                            <EffectWord effect={p.effect} /> {p.name}
                          </span>
                          <Text size="sm" tone="subtle">
                            {t("lists.resources.drawer.priority", { n: n(p.priority) })}
                          </Text>
                          {!p.enabled ? <Badge size="sm">{t("lists.common.off")}</Badge> : null}
                        </span>
                      ))}
                    </span>
                  ) : (
                    <NoneCell />
                  )}
                </DescriptionItem>
              </DescriptionList>
            </section>
          ) : null}
        </div>
      </DrawerBody>
      <DrawerFooter>
        <DrawerClose render={<Button variant="ghost">{t("lists.common.close")}</Button>} />
        <Button
          variant="soft"
          icon={FlaskConicalIcon}
          render={<Link to="/authorization/access-tester" />}
        >
          {t("lists.resources.drawer.testAccess")}
        </Button>
      </DrawerFooter>
    </DrawerContent>
  );
}
