import { BoxIcon, FileTextIcon, FolderIcon, UserRoundIcon, UsersIcon } from "@qeetrix/icons";
import { Avatar, Badge, Button, Link, MenuItem, Table } from "@qeetrix/react";
import { type TreeNode, TreeView } from "@qeetrix/react/experimental";
import { Link as RouterLink } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { type RelationTuple, useSubjectTuples } from "@/modules/authorization/api/relationships";
import { nameOf, usePeople, userIdOf } from "@/modules/authorization/components/shared/use-people";
import { Hops } from "@/modules/authorization/components/workspace/decision-parts";
import { Section } from "@/modules/authorization/components/workspace/workspace";
import { type GraphModel, type Hop, usersetRelation } from "./graph-model";

const TYPE_ICON = { document: FileTextIcon, folder: FolderIcon, group: UsersIcon };
const TYPE_PREFIX = "@type/";

/**
 * The objects you've opened, and the ones they reach, by type. The server can't list every object
 * yet (a server gap), so this is what this tab has seen; open any other by name in the toolbar.
 */
export function ObjectsTree({
  objects,
  current,
  counts,
  onOpen,
}: {
  objects: readonly string[];
  current: string;
  counts: ReadonlyMap<string, number>;
  onOpen: (object: string) => void;
}) {
  const { t } = useTranslation("authorization");
  const byType = new Map<string, string[]>();
  for (const o of objects) {
    const type = o.slice(0, o.indexOf(":"));
    byType.set(type, [...(byType.get(type) ?? []), o]);
  }
  const items: TreeNode[] = [...byType.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([type, list]) => ({
      id: `${TYPE_PREFIX}${type}`,
      label: type,
      icon: TYPE_ICON[type as keyof typeof TYPE_ICON] ?? BoxIcon,
      meta: String(list.length),
      children: list
        .sort((a, b) => a.localeCompare(b))
        .map((o) => {
          const n = counts.get(o);
          return {
            id: o,
            label: o.slice(o.indexOf(":") + 1),
            meta: n === undefined ? undefined : String(n),
          };
        }),
    }));
  if (items.length === 0) return <p className="ws-note ws-pad">{t("rebac.objectsEmpty")}</p>;
  return (
    <TreeView
      label={t("rebac.objects")}
      items={items}
      defaultExpanded={items.map((i) => i.id)}
      selected={current || null}
      onSelectedChange={(id) => {
        if (!id.startsWith(TYPE_PREFIX)) onOpen(id);
      }}
    />
  );
}

/** The relationships stored on the object: one row per tuple. */
export function TuplesTable({
  object,
  tuples,
  loading,
  onOpen,
  onDelete,
}: {
  object: string;
  tuples: readonly RelationTuple[];
  loading: boolean;
  onOpen: (object: string, relation?: string) => void;
  onDelete?: (tuple: RelationTuple) => void;
}) {
  const { t } = useTranslation("authorization");
  const people = usePeople();
  return (
    <Table<RelationTuple>
      label={t("rebac.tuplesOn", { object })}
      rows={tuples}
      loading={loading}
      loadingRows={3}
      rowId={(r) => r.id}
      rowLabel={(r) => `${r.relation} ${people.name(userIdOf(r.subject)) ?? r.subject}`}
      empty={<p className="ws-note">{t("rebac.noTuples")}</p>}
      columns={[
        {
          id: "relation",
          header: t("rebac.relation"),
          width: 128,
          cell: (r) => <code className="ws-code">#{r.relation}</code>,
        },
        {
          id: "subject",
          header: t("rebac.subject"),
          primary: true,
          cell: (r) => {
            const name = people.name(userIdOf(r.subject));
            return name ? (
              <span className="rb-cell-person">
                <strong>{name}</strong>
                <code className="ws-code ws-subtle">{r.subject.slice(0, 17)}…</code>
              </span>
            ) : (
              <code className="ws-code">{r.subject}</code>
            );
          },
        },
      ]}
      rowActions={(r) => {
        const userId = userIdOf(r.subject);
        const [target, relation] = r.subject.split("#");
        return (
          <>
            {userId ? (
              <MenuItem render={<RouterLink to="/users/$userId" params={{ userId }} />}>
                {t("rebac.openProfile")}
              </MenuItem>
            ) : target ? (
              <MenuItem onClick={() => onOpen(target, relation)}>
                {t("rebac.openSubject", { object: target })}
              </MenuItem>
            ) : null}
            {onDelete ? (
              <MenuItem tone="danger" onClick={() => onDelete(r)}>
                {t("rebac.deleteRelationship")}
              </MenuItem>
            ) : null}
          </>
        );
      }}
    />
  );
}

type Reached = { id: string; hops: Hop[] };

/** Everyone who reaches the object through the relation, and their first way in. */
export function PeopleTable({ model, relation }: { model: GraphModel; relation: string }) {
  const { t } = useTranslation("authorization");
  const people = usePeople();
  const rows: Reached[] = [...model.people.entries()]
    .map(([id, hops]) => ({ id, hops }))
    .sort((a, b) =>
      (people.name(a.id.slice(5)) ?? a.id).localeCompare(people.name(b.id.slice(5)) ?? b.id),
    );
  // The group or object that names them; the whole way in is on the node, in the graph.
  const way = (hops: Hop[]) => {
    const by = hops.at(-1)?.object;
    return hops.length > 1 && by ? t("rebac.through", { path: by }) : t("rebac.directly");
  };
  return (
    <Table<Reached>
      label={t("rebac.peopleWho", { relation, object: model.root })}
      rows={rows}
      rowId={(r) => r.id}
      rowLabel={(r) => people.name(r.id.slice(5)) ?? r.id}
      empty={<p className="ws-note">{t("rebac.noPeople")}</p>}
      renderRowLink={(r) => <RouterLink to="/users/$userId" params={{ userId: r.id.slice(5) }} />}
      columns={[
        {
          id: "name",
          header: t("rebac.person"),
          primary: true,
          cell: (r) => people.name(r.id.slice(5)) ?? <code className="ws-code">{r.id}</code>,
        },
        { id: "way", header: t("rebac.wayIn"), cell: (r) => way(r.hops) },
        {
          id: "status",
          header: t("rebac.status"),
          width: 112,
          cell: (r) =>
            people.byId.get(r.id.slice(5))?.status === "suspended" ? (
              <Badge tone="warning" size="sm">
                {t("person.suspended")}
              </Badge>
            ) : null,
        },
      ]}
    />
  );
}

/** What's selected on the graph: what it is, how it reaches the object, and who it brings. */
export function SelectedNode({
  model,
  id,
  tupleCount,
  relation,
  onOpen,
}: {
  model: GraphModel;
  id: string;
  tupleCount: number;
  relation: string;
  onOpen: (object: string, relation?: string) => void;
}) {
  const { t } = useTranslation("authorization");
  const people = usePeople();
  const node = model.nodes.get(id);
  const isRoot = id === model.root;
  const userId = node?.kind === "user" ? node.label : null;
  const also = useSubjectTuples(node?.kind === "object" && !isRoot ? id : "");
  if (!node) return null;
  const Icon =
    node.kind === "user"
      ? UserRoundIcon
      : node.kind === "people"
        ? UsersIcon
        : (TYPE_ICON[node.type as keyof typeof TYPE_ICON] ?? BoxIcon);
  const user = userId ? people.byId.get(userId) : undefined;
  const path = node.kind === "people" ? [] : model.pathTo(id);
  const members = node.people;
  const others = model.alsoFrom(id);
  return (
    <>
      <div className="rb-selected">
        <span className="rb-selected-icon" aria-hidden="true">
          <Icon size={16} />
        </span>
        <span className="rb-selected-text">
          <strong>
            {user
              ? nameOf(user)
              : node.kind === "people"
                ? t("graph.morePeople", { count: members.length })
                : node.label}
          </strong>
          <code className="ws-code ws-subtle">{node.kind === "people" ? model.root : id}</code>
        </span>
      </div>
      {isRoot ? (
        <Section label={t("rebac.thisObject")}>
          <p className="ws-note">
            {t("rebac.rootFacts", { tuples: tupleCount, people: model.people.size, relation })}
          </p>
          <p className="ws-note">{t("rebac.noImplication")}</p>
        </Section>
      ) : path.length ? (
        <Section label={t("rebac.howItReaches", { object: model.root })}>
          <Hops path={path} column />
          {others.length ? (
            <p className="ws-note">{t("rebac.alsoThrough", { objects: others.join(", ") })}</p>
          ) : null}
        </Section>
      ) : null}
      {user ? (
        <Section label={t("rebac.person")}>
          <p className="ws-note">{user.email}</p>
          <Link
            href={`/users/${user.id}`}
            render={<RouterLink to="/users/$userId" params={{ userId: user.id }} />}
          >
            {t("rebac.openProfile")}
          </Link>
        </Section>
      ) : null}
      {members.length ? (
        <Section label={t("rebac.membersCount", { count: members.length })}>
          <ul className="ws-list rb-people">
            {members.map((m) => {
              const p = people.byId.get(m.slice(5));
              const title =
                p?.metadata && typeof p.metadata.title === "string" ? p.metadata.title : undefined;
              return (
                <li key={m} className="rb-person-row">
                  <Avatar name={p ? nameOf(p) : m} size="sm" decorative />
                  <span className="ws-row-text">
                    <strong>{p ? nameOf(p) : m.slice(5, 13)}</strong>
                    {title || p?.email ? <small>{title ?? p?.email}</small> : null}
                  </span>
                  {p?.status === "suspended" ? (
                    <Badge tone="warning" size="sm">
                      {t("person.suspended")}
                    </Badge>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </Section>
      ) : null}
      {node.kind === "object" && !isRoot ? (
        <Section label={t("rebac.namedOn")}>
          {also.data?.items.length ? (
            <ul className="ws-list">
              {also.data.items.map((tu) => (
                <li key={tu.id} className="rb-named">
                  <code className="ws-code">{tu.object}</code>{" "}
                  <span className="ws-subtle">
                    {t("rebac.asRelation", { relation: tu.relation })}
                  </span>
                </li>
              ))}
            </ul>
          ) : also.isPending ? null : (
            <p className="ws-note">{t("rebac.namedNowhereElse")}</p>
          )}
          <div className="ws-form-end ws-start">
            <Button variant="soft" size="sm" onClick={() => onOpen(id, usersetRelation(model, id))}>
              {t("rebac.openIt", { object: id })}
            </Button>
          </div>
        </Section>
      ) : null}
    </>
  );
}
