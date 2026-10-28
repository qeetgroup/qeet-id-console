import { SearchIcon, UserMinusIcon, UserPlusIcon } from "@qeetrix/icons";
import {
  Badge,
  Button,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerFooter,
  Field,
  formatNumber,
  IconButton,
  Link,
} from "@qeetrix/react";
import {
  Alert,
  AvatarItem,
  Combobox,
  DataState,
  EmptyState,
  SearchField,
} from "@qeetrix/react/experimental";
import { Link as RouterLink } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { formatLocale } from "@/i18n";
import { type Group, useAddGroupMember, useGroupMembers } from "@/modules/groups/api/groups";
import { useRemoveMember } from "@/modules/groups/use-remove-member";
import "./group-members-drawer.css";

/** Over this many members, a search sits above the list. */
const SEARCH_OVER = 8;
const AT_ONCE = 5;

export type MemberPerson = {
  id: string;
  email: string;
  display_name?: string | null;
  status?: string;
};

export type GroupMembersDrawerProps = {
  /** The group; the drawer is open while there is one. */
  group: Group | null;
  onClose: () => void;
  /** Where it sits, outermost first, with its own name last. */
  path: string[];
  /** The roles it grants, by name; undefined when they can't be read. */
  grants?: readonly string[];
  /** Everyone, to add from (no user.read: an empty list, so nothing to add). */
  people: readonly MemberPerson[];
};

/**
 * Members of a group: who's in it, add people, remove someone. People are chosen as pills and added
 * together, five calls at a time, with one toast. The roles the group grants are said plainly: they
 * reach its own members only (the server's rule). Removing someone goes through the console's
 * confirm, which says what they lose.
 */
export function GroupMembersDrawer({
  group,
  onClose,
  path,
  grants,
  people,
}: GroupMembersDrawerProps) {
  const { t } = useTranslation("groups");
  const n = (value: number) => formatNumber(value, formatLocale());
  const membersQ = useGroupMembers(group?.id ?? "");
  const addM = useAddGroupMember({ silent: true });

  const [chosen, setChosen] = useState<string[]>([]);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [failed, setFailed] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const groupId = group?.id;
  useEffect(() => {
    if (!groupId) return;
    setChosen([]);
    setAdded(new Set());
    setFailed([]);
    setQuery("");
  }, [groupId]);

  const byId = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const nameOf = (p: { display_name?: string | null; email: string }) =>
    p.display_name?.trim() || p.email;
  const members = membersQ.data?.items ?? [];
  const isMember = new Set(members.map((m) => m.user_id));
  // The people just added first, marked, then the rest by name.
  const rows = [...members].sort(
    (a, b) =>
      Number(added.has(b.user_id)) - Number(added.has(a.user_id)) ||
      nameOf(a).localeCompare(nameOf(b)),
  );
  const q = query.trim().toLowerCase();
  const shown = q
    ? rows.filter((m) => `${m.display_name ?? ""} ${m.email}`.toLowerCase().includes(q))
    : rows;
  const candidates = people
    .filter((p) => !isMember.has(p.id))
    .map((p) => ({ value: p.id, label: nameOf(p), description: p.email }));
  const roles = grants?.join(", ");
  const name = group?.name ?? "";

  async function addChosen() {
    if (!group || !chosen.length) return;
    setAdding(true);
    setFailed([]);
    const ok: string[] = [];
    const bad: string[] = [];
    for (let i = 0; i < chosen.length; i += AT_ONCE) {
      const batch = chosen.slice(i, i + AT_ONCE);
      const results = await Promise.allSettled(
        batch.map((userId) => addM.mutateAsync({ groupId: group.id, userId })),
      );
      results.forEach((r, j) => {
        (r.status === "fulfilled" ? ok : bad).push(batch[j] as string);
      });
    }
    setAdding(false);
    setAdded((prev) => new Set([...prev, ...ok]));
    setChosen(bad);
    setFailed(bad);
    if (ok.length)
      toast.success(t("membersDrawer.addedToast", { count: ok.length, n: n(ok.length), name }));
  }

  const remove = useRemoveMember(group, grants);

  const reach =
    grants === undefined
      ? ""
      : grants.length
        ? t("membersDrawer.grants", { roles })
        : t("membersDrawer.grantsNone");

  return (
    <Drawer open={!!group} onOpenChange={(next) => !next && !adding && onClose()}>
      <DrawerContent
        title={t("membersDrawer.title", { name })}
        description={`${[path.join(" › "), reach].filter(Boolean).join(". ")}.`}
        size="md"
      >
        <DrawerBody>
          <form
            id="group-members"
            className="sub-form"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              if (!adding) void addChosen();
            }}
          >
            {failed.length ? (
              <Alert
                tone="danger"
                title={t("membersDrawer.addFailed", {
                  count: failed.length,
                  names: failed
                    .map((id) => byId.get(id))
                    .filter(Boolean)
                    .map((p) => nameOf(p as MemberPerson))
                    .join(", "),
                })}
              >
                {t("membersDrawer.addFailedHint")}
              </Alert>
            ) : null}
            <Field
              label={t("membersDrawer.add")}
              description={
                chosen.length
                  ? grants?.length
                    ? t("membersDrawer.chosenGet", {
                        count: chosen.length,
                        n: n(chosen.length),
                        roles,
                        name,
                      })
                    : t("membersDrawer.chosen", { count: chosen.length, n: n(chosen.length) })
                  : t("membersDrawer.addHelp")
              }
            >
              <Combobox
                multiple
                items={candidates}
                value={chosen}
                onValueChange={(values) => setChosen((values ?? []).map(String))}
                icon={SearchIcon}
                placeholder={t("membersDrawer.addPlaceholder")}
                disabled={adding}
              />
            </Field>

            <section className="grp-mem" aria-labelledby="grp-mem-head">
              <div className="grp-mem-head">
                <h3 id="grp-mem-head" className="grp-mem-title">
                  {members.length
                    ? t("membersDrawer.count", { count: members.length, n: n(members.length) })
                    : t("membersDrawer.members")}
                </h3>
                {members.length > SEARCH_OVER ? (
                  <SearchField
                    aria-label={t("membersDrawer.search")}
                    placeholder={t("membersDrawer.search")}
                    value={query}
                    onValueChange={setQuery}
                  />
                ) : null}
              </div>
              <DataState
                loading={membersQ.isLoading}
                error={membersQ.isError ? membersQ.error : undefined}
                onRetry={() => membersQ.refetch()}
              >
                {members.length ? (
                  <ul className="grp-mem-list">
                    {shown.map((m) => {
                      const status = byId.get(m.user_id)?.status;
                      return (
                        <li key={m.user_id} className="grp-mem-row">
                          <AvatarItem name={nameOf(m)} description={m.email} />
                          <span className="grp-mem-tags">
                            {added.has(m.user_id) ? (
                              <Badge tone="brand" size="sm">
                                {t("membersDrawer.added")}
                              </Badge>
                            ) : null}
                            {status === "suspended" ? (
                              <Badge tone="warning" size="sm">
                                {t("membersDrawer.suspended")}
                              </Badge>
                            ) : null}
                          </span>
                          <IconButton
                            icon={UserMinusIcon}
                            aria-label={t("membersDrawer.removeLabel", {
                              name: nameOf(m),
                              group: name,
                            })}
                            tooltip={t("membersDrawer.removeTooltip", { group: name })}
                            variant="ghost"
                            tone="neutral"
                            size="sm"
                            onClick={() => remove(m)}
                          />
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <EmptyState
                    size="section"
                    icon={UserPlusIcon}
                    title={t("membersDrawer.emptyTitle", { name })}
                    description={
                      grants?.length
                        ? t("membersDrawer.emptyGrants", { count: grants.length, roles })
                        : t("membersDrawer.emptyHelp")
                    }
                  />
                )}
              </DataState>
            </section>
          </form>
        </DrawerBody>
        <DrawerFooter>
          {group ? (
            // A start slot for the footer is QTRX-23; the Users drawer's class places it.
            <Link
              className="add-import"
              render={<RouterLink to="/groups/$groupId" params={{ groupId: group.id }} />}
            >
              {t("membersDrawer.openPage")}
            </Link>
          ) : null}
          <Button variant="ghost" onClick={onClose} disabled={adding}>
            {t("membersDrawer.close")}
          </Button>
          <Button
            type="submit"
            form="group-members"
            icon={UserPlusIcon}
            loading={adding}
            disabled={!chosen.length}
          >
            {chosen.length
              ? t("membersDrawer.addN", { count: chosen.length, n: n(chosen.length) })
              : t("membersDrawer.addPeople")}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
