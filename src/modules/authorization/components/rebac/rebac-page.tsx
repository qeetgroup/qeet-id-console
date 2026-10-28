import { NetworkIcon, PlusIcon } from "@qeetrix/icons";
import { Button, formatNumber, Select, Text, TextField } from "@qeetrix/react";
import { DataState, EmptyState } from "@qeetrix/react/experimental";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import {
  type RelationTuple,
  useDeleteTuple,
  useRelationGraph,
  useRelationTuples,
} from "@/modules/authorization/api/relationships";
import { usePeople, userIdOf } from "@/modules/authorization/components/shared/use-people";
import {
  Main,
  Output,
  Pane,
  Workspace,
} from "@/modules/authorization/components/workspace/workspace";
import { rememberObjects, useKnownObjects } from "@/modules/authorization/store/authz-store";
import { useCapabilities } from "@/platform/security/capability-provider";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import { AddRelationshipDrawer } from "./add-relationship-drawer";
import { graphModel } from "./graph-model";
import { ObjectsTree, PeopleTable, SelectedNode, TuplesTable } from "./rebac-panes";
import { RelationGraph } from "./relation-graph";
import "./rebac.css";

const OBJECT = /^[^:\s]+:\S+$/;
const NO_TUPLES: RelationTuple[] = [];

export type RebacPageProps = {
  /** The object open ("type:id") and the relation expanded, from the address. */
  object?: string;
  relation?: string;
  onOpen: (object: string | undefined, relation?: string) => void;
};

/**
 * Models › ReBAC: who reaches an object through its relationships, and the groups and folders in
 * between. The graph of one object and relation (GET /relation-tuples/graph), the object's tuples
 * and everyone it reaches under it, and the selected node in the inspector.
 */
export function RebacPage({ object = "", relation, onOpen }: RebacPageProps) {
  const { t } = useTranslation("authorization");
  const canWrite = useCapabilities().can("role.write");
  const people = usePeople();
  const runSensitive = useSensitiveAction();
  const deleteM = useDeleteTuple();
  const known = useKnownObjects();
  const [typed, setTyped] = useState(object);
  const [typedError, setTypedError] = useState<string>();
  const [selected, setSelected] = useState(object);
  const [view, setView] = useState<"tuples" | "people">("tuples");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    setTyped(object);
    setSelected(object);
    setTypedError(undefined);
  }, [object]);

  const tuplesQ = useRelationTuples(object);
  const tuples = tuplesQ.data?.items ?? NO_TUPLES;
  const relations = useMemo(() => [...new Set(tuples.map((tu) => tu.relation))].sort(), [tuples]);
  const rel = relation || (relations.includes("viewer") ? "viewer" : (relations[0] ?? ""));
  const graphQ = useRelationGraph(object, rel);
  const model = useMemo(
    () => (graphQ.data ? graphModel(graphQ.data, object) : null),
    [graphQ.data, object],
  );

  // What this tab has seen: the object opened, and every object its graph reaches.
  useEffect(() => {
    if (!object || !tuplesQ.data) return;
    const reached = model
      ? [...model.nodes.values()].filter((n) => n.kind === "object").map((n) => n.id)
      : [];
    rememberObjects([object, ...reached]);
  }, [object, tuplesQ.data, model]);

  const counts = useMemo(() => new Map(object ? [[object, tuples.length]] : []), [object, tuples]);
  const locale = formatLocale();

  function openTyped() {
    const value = typed.trim();
    if (!OBJECT.test(value)) return setTypedError(t("rebac.objectFormat"));
    setTypedError(undefined);
    onOpen(value);
  }

  function remove(tuple: RelationTuple) {
    const name = people.name(userIdOf(tuple.subject)) ?? tuple.subject;
    runSensitive({
      confirm: {
        title: t("rebac.deleteTitle"),
        description: t("rebac.deleteDescription", {
          subject: name,
          relation: tuple.relation,
          object: tuple.object,
        }),
        confirmLabel: t("rebac.deleteRelationship"),
        tone: "destructive",
      },
      actionLabel: t("rebac.deleteAction"),
      run: () => deleteM.mutateAsync(tuple.id),
    }).catch(settleSensitiveAction);
  }

  const relationSelect =
    relations.length > 0 ? (
      <Select<string>
        aria-label={t("rebac.relation")}
        items={(relations.includes(rel) ? relations : [rel, ...relations]).map((r) => ({
          value: r,
          label: r,
        }))}
        value={rel}
        onValueChange={(v) => v && onOpen(object, v)}
        className="rb-relation"
      />
    ) : null;

  return (
    <Workspace
      title={t("rebac.title")}
      description={t("rebac.description")}
      toolbarLabel={t("rebac.toolbar")}
      className="ws-rebac"
      start={
        <>
          <form
            className="rb-open"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              openTyped();
            }}
          >
            <TextField
              label={t("rebac.object")}
              hideLabel
              value={typed}
              onValueChange={(v) => {
                setTyped(v);
                if (typedError) setTypedError(undefined);
              }}
              placeholder={t("rebac.objectPlaceholder")}
              error={typedError}
              invalid={!!typedError}
              spellCheck={false}
              autoComplete="off"
              className="rb-object"
            />
            <Button type="submit" variant="ghost" tone="neutral">
              {t("rebac.open")}
            </Button>
          </form>
          {relationSelect}
          {model ? (
            <Text size="sm" tone="subtle" className="ws-hide-phone">
              {t("rebac.size", {
                count: model.people.size,
                people: formatNumber(model.people.size, locale),
                nodes: formatNumber(graphQ.data?.nodes.length ?? 0, locale),
              })}
            </Text>
          ) : null}
        </>
      }
      end={
        canWrite ? (
          <Button icon={PlusIcon} onClick={() => setAdding(true)}>
            {t("rebac.add")}
          </Button>
        ) : null
      }
    >
      <Pane
        side="list"
        label={t("rebac.objects")}
        className="ws-hide-phone"
        footer={<p className="ws-note ws-pad">{t("rebac.objectsNote")}</p>}
      >
        <ObjectsTree objects={known} current={object} counts={counts} onOpen={(o) => onOpen(o)} />
      </Pane>
      <Main
        label={t("rebac.graph")}
        output={
          object ? (
            <Output<"tuples" | "people">
              label={t("rebac.output", { object })}
              value={view}
              onValueChange={setView}
              tabs={[
                {
                  value: "tuples",
                  label: t("rebac.tuples"),
                  badge: tuplesQ.data ? tuples.length : undefined,
                },
                {
                  value: "people",
                  label: t("rebac.people"),
                  badge: model ? model.people.size : undefined,
                },
              ]}
            >
              {view === "tuples" ? (
                <TuplesTable
                  object={object}
                  tuples={tuples}
                  loading={tuplesQ.isPending}
                  onOpen={(o, r) => onOpen(o, r)}
                  onDelete={canWrite ? remove : undefined}
                />
              ) : model ? (
                <PeopleTable model={model} relation={rel} />
              ) : (
                <p className="ws-note">{t("rebac.noPeople")}</p>
              )}
            </Output>
          ) : undefined
        }
      >
        {!object ? (
          <EmptyState
            icon={NetworkIcon}
            title={t("rebac.openTitle")}
            description={t("rebac.openHint")}
          />
        ) : (
          <DataState
            loading={tuplesQ.isPending || (!!rel && graphQ.isPending)}
            error={tuplesQ.error ?? graphQ.error}
            onRetry={() => void (tuplesQ.error ? tuplesQ.refetch() : graphQ.refetch())}
            empty={tuples.length === 0}
            emptyState={
              <EmptyState
                icon={NetworkIcon}
                title={t("rebac.emptyTitle", { object })}
                description={t("rebac.emptyHint")}
              />
            }
          >
            {model ? (
              <>
                <div className="ws-hide-phone">
                  <RelationGraph
                    model={model}
                    selected={selected}
                    onSelect={setSelected}
                    label={t("rebac.graphLabel", { relation: rel, object })}
                  />
                </div>
                <p className="ws-note ws-phone-only">
                  {t("rebac.phoneNote", { count: model.people.size, relation: rel, object })}
                </p>
              </>
            ) : null}
          </DataState>
        )}
      </Main>
      <Pane
        side="inspector"
        label={t("rebac.selected")}
        meta={model?.nodes.get(selected)?.type}
        className="ws-hide-phone"
      >
        {model ? (
          <SelectedNode
            model={model}
            id={model.nodes.has(selected) ? selected : object}
            tupleCount={tuples.length}
            relation={rel}
            onOpen={(o, r) => onOpen(o, r)}
          />
        ) : (
          <p className="ws-note ws-pad">{t("rebac.selectHint")}</p>
        )}
      </Pane>
      <AddRelationshipDrawer
        open={adding}
        onOpenChange={setAdding}
        object={object}
        relation={rel}
        onAdded={(o, r) => {
          if (o !== object || r !== rel) onOpen(o, r);
        }}
      />
    </Workspace>
  );
}
