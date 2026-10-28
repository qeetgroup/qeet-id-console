import { PlusIcon, SaveIcon, SlidersHorizontalIcon, TrashIcon } from "@qeetrix/icons";
import { Button, Text } from "@qeetrix/react";
import { DataState, EmptyState, SearchField } from "@qeetrix/react/experimental";
import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { FeatureGate, useEntitlements } from "@/modules/billing";
import {
  type AbacPolicy,
  useAbacPolicies,
  useCreateAbacPolicy,
  useDeleteAbacPolicy,
  useUpdateAbacPolicy,
} from "@/modules/authorization/api/abac";
import { policyProblemMessage } from "@/modules/authorization/components/condition-builder/condition-problem";
import {
  Main,
  Pane,
  When,
  Workspace,
} from "@/modules/authorization/components/workspace/workspace";
import { authzStore, setBuilderDoc } from "@/modules/authorization/store/authz-store";
import { ERROR_CODES } from "@/platform/errors/error-codes";
import { normalizeError } from "@/platform/errors/normalize-error";
import { useCapabilities } from "@/platform/security/capability-provider";
import {
  SensitiveActionCancelled,
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import { UnsavedChangesGuard } from "@/shared/components/unsaved-changes-guard";
import {
  addNode,
  blankGroup,
  blankLeaf,
  type Draft,
  draftFromDoc,
  draftFromPolicy,
  draftProblem,
  findNode,
  newDraft,
  toInput,
  updateNode,
} from "./policy-draft";
import { conditionAttributes, matchesSearch, PolicyList } from "./policy-list";
import { PolicyNotices, PolicyOutput } from "./policy-output";
import { RuleFlow, type Selection } from "./rule-flow";
import { type FieldErrors, PartEditor, PolicyFields } from "./rule-inspector";
import "./abac.css";

// What makes a draft differ from what it was opened as; a template's blocks always count.
const fingerprint = (d: Draft) => JSON.stringify([toInput(d), d.requireRole, d.relation]);

function firstLeafId(d: Draft): Selection {
  let node = d.condition;
  while (node && node.kind !== "leaf")
    node = node.kind === "not" ? node.child : (node.children[0] ?? null);
  return node?.id ?? "target";
}

export type AbacPageProps = {
  /** The policy open, from the address: an id, `new`, or none for the first in order. */
  policyId?: string;
  onPolicyChange: (policyId: string | undefined) => void;
};

/**
 * Models › ABAC: the attribute policies in the order the engine checks them, the open one drawn as
 * its statement, its fields in the inspector, and a test of the saved policies under it. New
 * policy, and a template from Policies › Templates, open here (the Builder became this).
 */
export function AbacPage({ policyId, onPolicyChange }: AbacPageProps) {
  const { t } = useTranslation("authorization");
  const canWrite = useCapabilities().can("policy.write");
  const locked = useEntitlements().data?.features.abac === false;
  const policiesQ = useAbacPolicies();
  const policies = policiesQ.data?.items;
  const runSensitive = useSensitiveAction();
  const createM = useCreateAbacPolicy();
  const deleteM = useDeleteAbacPolicy();

  const [search, setSearch] = useState("");
  const [loaded, setLoaded] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [baseline, setBaseline] = useState("");
  const [selected, setSelected] = useState<Selection | null>("target");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);
  // Where to go once the draft no longer differs from what's saved (so nothing asks to discard).
  const [goTo, setGoTo] = useState<{ to?: string } | null>(null);
  const updateM = useUpdateAbacPolicy(draft?.id ?? "");

  const saved = draft?.id ? policies?.find((p) => p.id === draft.id) : undefined;
  const dirty = !!draft && fingerprint(draft) !== baseline;
  const readOnly = !canWrite || locked;

  function open(key: string, next: Draft | null, isTemplate = false) {
    setLoaded(key);
    setDraft(next);
    setBaseline(next && !isTemplate ? fingerprint(next) : "");
    setSelected(next && !next.id ? firstLeafId(next) : null);
    setErrors({});
    setFailure(null);
  }

  // Open what the address names, once the policies are in.
  // biome-ignore lint/correctness/useExhaustiveDependencies: opens on a new address or list only
  useEffect(() => {
    if (!policies) return;
    const wanted = policyId ?? policies[0]?.id ?? null;
    if (wanted === loaded) return;
    if (wanted === "new") {
      // A template hands its policy over through the store, once.
      const doc = authzStore.state.builderDoc;
      if (doc) setBuilderDoc(null);
      open("new", doc ? draftFromDoc(doc) : newDraft(), !!doc);
      return;
    }
    const p = wanted ? policies.find((x) => x.id === wanted) : undefined;
    open(wanted ?? "", p ? draftFromPolicy(p) : null);
  }, [policyId, policies]);

  useEffect(() => {
    if (goTo && !dirty) {
      setGoTo(null);
      onPolicyChange(goTo.to);
    }
  }, [goTo, dirty, onPolicyChange]);

  // Leaves the draft as it is, without asking, then opens `to` (none: the first in order).
  function leave(to?: string) {
    setBaseline(draft ? fingerprint(draft) : "");
    setLoaded(null);
    setGoTo({ to });
  }

  const attributes = useMemo(
    () => [...new Set((policies ?? []).flatMap((p) => conditionAttributes(p.condition)))].sort(),
    [policies],
  );
  const shown = useMemo(
    () => (policies ?? []).filter((p) => matchesSearch(p, search)),
    [policies, search],
  );
  const problem = draft ? draftProblem(draft) : null;

  function change(next: Draft, select?: Selection | null) {
    setDraft(next);
    if (select !== undefined) setSelected(select);
    if (errors.name && next.name.trim()) setErrors((e) => ({ ...e, name: undefined }));
  }

  function fail(err: unknown) {
    const code = normalizeError(err).code;
    if (code === ERROR_CODES.ABAC_POLICY_NAME_EXISTS)
      setErrors({ name: t("abac.errors.nameTaken") });
    else if (code === ERROR_CODES.ABAC_NAME_REQUIRED) setErrors({ name: t("abac.errors.name") });
    else if (code === ERROR_CODES.ABAC_RESOURCE_TYPE_REQUIRED)
      setErrors({ resourceType: t("abac.errors.target") });
    else if (code === ERROR_CODES.ABAC_ACTION_REQUIRED)
      setErrors({ action: t("abac.errors.target") });
    else setFailure(err);
    if (code === ERROR_CODES.ABAC_POLICY_NAME_EXISTS || code === ERROR_CODES.ABAC_NAME_REQUIRED)
      setSelected("target");
  }

  async function save() {
    if (!draft || saving) return;
    if (!draft.name.trim()) return setErrors({ name: t("abac.errors.name") });
    if (problem) return;
    setErrors({});
    setFailure(null);
    setSaving(true);
    const input = toInput(draft);
    try {
      const result = await runSensitive({
        actionLabel: t(draft.id ? "abac.updateAction" : "abac.createAction"),
        run: () => (draft.id ? updateM.mutateAsync(input) : createM.mutateAsync(input)),
      });
      if (result) {
        const next = draftFromPolicy(result);
        setDraft(next);
        setBaseline(fingerprint(next));
        setLoaded(result.id);
        if (result.id !== policyId) setGoTo({ to: result.id });
      }
    } catch (err) {
      if (!(err instanceof SensitiveActionCancelled)) fail(err);
    } finally {
      setSaving(false);
    }
  }

  function remove(p: AbacPolicy) {
    runSensitive({
      confirm: {
        title: t("abac.deleteTitle"),
        description:
          p.effect === "deny"
            ? t("abac.deleteDescriptionDeny", { name: p.name })
            : t("abac.deleteDescriptionAllow", { name: p.name }),
        confirmLabel: t("abac.deleteLabel"),
        tone: "destructive",
      },
      actionLabel: t("abac.deleteAction"),
      run: () => deleteM.mutateAsync(p.id),
    })
      .then(() => leave())
      // A failed delete is toasted by the query client; a cancel is nothing to report.
      .catch(settleSensitiveAction);
  }

  const header = {
    title: t("abac.title"),
    description: t("abac.description"),
    toolbarLabel: t("abac.toolbar"),
  };

  if (locked)
    return (
      <Workspace {...header} layout="main">
        <Main label={t("abac.title")}>
          <FeatureGate feature="abac" title={t("abac.locked")} description={t("abac.lockedHint")}>
            {null}
          </FeatureGate>
        </Main>
      </Workspace>
    );

  const edit = readOnly
    ? undefined
    : {
        onAdd: (kind: "condition" | "group") => {
          if (!draft) return;
          const node = kind === "condition" ? blankLeaf() : blankGroup();
          change({ ...draft, condition: addNode(draft.condition, node) }, node.id);
        },
        onCombinator: (id: string, combinator: "all" | "any") => {
          if (!draft?.condition) return;
          change({
            ...draft,
            condition: updateNode(draft.condition, id, (n) =>
              n.kind === "group" ? { ...n, combinator } : n,
            ),
          });
        },
      };

  return (
    <Workspace
      {...header}
      start={
        <SearchField
          aria-label={t("abac.search")}
          placeholder={t("abac.searchPlaceholder")}
          value={search}
          onValueChange={setSearch}
          className="ws-search"
        />
      }
      end={
        (dirty || (draft && !draft.id)) && !readOnly ? (
          <>
            {problem && problem.code !== "mixedEngines" ? (
              <Text size="sm" tone="subtle" className="ws-hide-phone">
                {problem.code === "needsAttribute"
                  ? t("abac.needsAttribute")
                  : policyProblemMessage(problem)}
              </Text>
            ) : null}
            <Button
              variant="ghost"
              tone="neutral"
              onClick={() => {
                if (draft?.id && saved) open(saved.id, draftFromPolicy(saved));
                else leave();
              }}
            >
              {t("abac.discard")}
            </Button>
            <Button
              icon={SaveIcon}
              onClick={() => void save()}
              loading={saving}
              disabled={!!problem}
            >
              {draft?.id ? t("abac.saveChanges") : t("abac.createPolicy")}
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" tone="neutral" render={<Link to="/authorization/versions" />}>
              {t("abac.versions")}
            </Button>
            {readOnly ? null : (
              <Button icon={PlusIcon} onClick={() => onPolicyChange("new")}>
                {t("abac.newPolicy")}
              </Button>
            )}
          </>
        )
      }
    >
      <Pane
        side="list"
        label={t("abac.order")}
        meta={policies ? t("abac.policyCount", { count: policies.length }) : undefined}
      >
        <DataState
          loading={policiesQ.isPending}
          error={policiesQ.error}
          onRetry={() => void policiesQ.refetch()}
          empty={!!policies && shown.length === 0 && !(draft && !draft.id)}
          emptyState={
            <EmptyState
              size="section"
              title={search ? t("abac.noMatches") : t("abac.empty")}
              description={search ? undefined : t("abac.emptyHint")}
            />
          }
        >
          <PolicyList
            policies={shown}
            draft={draft}
            currentId={loaded}
            onOpen={(id) => onPolicyChange(id === "new" ? "new" : id)}
          />
        </DataState>
      </Pane>
      <Main
        label={t("abac.canvas")}
        output={draft ? <PolicyOutput key={loaded ?? ""} draft={draft} dirty={dirty} /> : undefined}
      >
        <PolicyNotices
          draft={draft}
          failure={failure}
          onRemoveBlocks={
            readOnly || !draft
              ? undefined
              : () => change({ ...draft, requireRole: null, relation: null }, "target")
          }
        />
        {draft ? (
          <RuleFlow draft={draft} selected={selected} onSelect={setSelected} edit={edit} />
        ) : policies && policies.length === 0 ? (
          <EmptyState
            icon={SlidersHorizontalIcon}
            title={t("abac.empty")}
            description={t("abac.emptyHint")}
            actions={
              readOnly ? undefined : (
                <Button icon={PlusIcon} onClick={() => onPolicyChange("new")}>
                  {t("abac.newPolicy")}
                </Button>
              )
            }
          />
        ) : policies && loaded ? (
          <EmptyState title={t("abac.notFound")} description={t("abac.notFoundHint")} />
        ) : null}
      </Main>
      <Pane
        side="inspector"
        label={t("inspector.label")}
        footer={
          saved ? (
            <div className="ws-foot-row">
              <Text size="sm" tone="subtle">
                {t("abac.changed")} <When at={saved.updated_at} />
              </Text>
              {readOnly ? null : (
                <Button
                  variant="ghost"
                  tone="danger"
                  size="sm"
                  icon={TrashIcon}
                  aria-label={t("abac.deleteNamed", { name: saved.name })}
                  onClick={() => remove(saved)}
                >
                  {t("abac.delete")}
                </Button>
              )}
            </div>
          ) : undefined
        }
      >
        {draft ? (
          <>
            <PartEditor
              draft={draft}
              selected={selected}
              onChange={change}
              readOnly={readOnly}
              attributes={attributes}
            />
            <PolicyFields
              draft={draft}
              onChange={change}
              readOnly={readOnly}
              errors={errors}
              labelled={
                selected === "role"
                  ? draft.requireRole != null
                  : selected === "relation"
                    ? !!draft.relation
                    : !!selected && !!findNode(draft.condition, selected)
              }
            />
          </>
        ) : null}
      </Pane>
      <UnsavedChangesGuard
        when={dirty && !readOnly}
        title={t("abac.unsaved.title")}
        description={t("abac.unsaved.description")}
        stayLabel={t("abac.unsaved.stay")}
        leaveLabel={t("abac.unsaved.leave")}
      />
    </Workspace>
  );
}
