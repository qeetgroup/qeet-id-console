import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@qeetrix/ui";
import { NetworkIcon, TrashIcon } from "@qeetrix/icons";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { DataState } from "@/platform/components/data-state";
import { PageHeader } from "@/platform/components/page-header";
import { applyServerErrors, FormError, useAppForm } from "@/platform/forms/app-form";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import {
  useDeleteTuple,
  useRelationGraph,
  useRelationTuples,
  useWriteTuple,
} from "../api/relationships";
import { useRebacSimulate } from "../api/simulate";
import { pushDecision } from "../store/authz-store";
import { RelationshipGraph } from "./graph/relationship-graph";
import { DecisionBadge } from "./shared/decision-badge";

/** Renders relationship tuples: write, check, browse and the identity graph. */
export function RebacPage() {
  const { t } = useTranslation("rbac");
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader description={t("relationships.description")} />
      <div className="grid gap-4 lg:grid-cols-2">
        <WriteCard />
        <CheckCard />
      </div>
      <BrowseCard />
      <GraphCard />
    </div>
  );
}

// The fields every tuple form shares, each required.
function useTupleSchema<K extends string>(fields: Record<K, string>) {
  const { t } = useTranslation("rbac");
  return useMemo(
    () =>
      z.object(
        Object.fromEntries(
          Object.entries<string>(fields).map(([name, message]) => [
            name,
            z.string().trim().min(1, t(message)),
          ]),
        ) as Record<K, z.ZodString>,
      ),
    [fields, t],
  );
}

const WRITE_FIELDS = {
  object: "relationships.validation.object",
  relation: "relationships.validation.relation",
  subject: "relationships.validation.subject",
};

function WriteCard() {
  const { t } = useTranslation("rbac");
  const writeM = useWriteTuple();
  const runSensitive = useSensitiveAction();
  const schema = useTupleSchema(WRITE_FIELDS);
  const form = useAppForm({
    defaultValues: { object: "", relation: "", subject: "" },
    validators: { onSubmit: schema },
    onSubmit: async ({ value, formApi }) => {
      const tuple = {
        object: value.object.trim(),
        relation: value.relation.trim(),
        subject: value.subject.trim(),
      };
      await runSensitive({
        actionLabel: t("relationships.write.action").toLowerCase(),
        run: () => writeM.mutateAsync(tuple),
      })
        .then((written) => written !== undefined && formApi.reset())
        .catch((err: unknown) => {
          applyServerErrors(formApi, err);
          settleSensitiveAction(err);
        });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("relationships.write.title")}</CardTitle>
        <CardDescription>{t("relationships.write.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-col gap-3"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void form.handleSubmit();
          }}
        >
          <form.AppField name="object">
            {(field) => (
              <field.TextField
                label={t("relationships.write.objectLabel")}
                placeholder="document:readme"
                required
              />
            )}
          </form.AppField>
          <form.AppField name="relation">
            {(field) => (
              <field.TextField
                label={t("relationships.write.relationLabel")}
                placeholder="viewer"
                required
              />
            )}
          </form.AppField>
          <form.AppField name="subject">
            {(field) => (
              <field.TextField
                label={t("relationships.write.subjectLabel")}
                description={t("relationships.write.subjectHelp")}
                placeholder={t("rebacPage.userOrGroupEngMember")}
                required
              />
            )}
          </form.AppField>
          <FormError error={writeM.error} />
          <form.AppForm>
            <form.SubmitButton>{t("relationships.write.writeBtn")}</form.SubmitButton>
          </form.AppForm>
        </form>
      </CardContent>
    </Card>
  );
}

const CHECK_FIELDS = {
  object: "relationships.validation.object",
  relation: "relationships.validation.relation",
  user_id: "relationships.validation.userId",
};

function CheckCard() {
  const { t } = useTranslation("rbac");
  const checkM = useRebacSimulate();
  const schema = useTupleSchema(CHECK_FIELDS);
  const form = useAppForm({
    defaultValues: { object: "", relation: "", user_id: "" },
    validators: { onSubmit: schema },
    onSubmit: async ({ value, formApi }) => {
      await checkM
        .mutateAsync({
          object: value.object.trim(),
          relation: value.relation.trim(),
          user_id: value.user_id.trim(),
        })
        .then(pushDecision)
        .catch((err: unknown) => applyServerErrors(formApi, err));
    },
  });
  const record = checkM.data;
  const hops = record?.rebac?.path?.length ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("relationships.check.title")}</CardTitle>
        <CardDescription>{t("relationships.check.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-col gap-3"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void form.handleSubmit();
          }}
        >
          <form.AppField name="object">
            {(field) => (
              <field.TextField
                label={t("relationships.check.objectLabel")}
                placeholder="document:readme"
                required
              />
            )}
          </form.AppField>
          <form.AppField name="relation">
            {(field) => (
              <field.TextField
                label={t("relationships.check.relationLabel")}
                placeholder="viewer"
                required
              />
            )}
          </form.AppField>
          <form.AppField name="user_id">
            {(field) => (
              <field.TextField
                label={t("relationships.check.userLabel")}
                className="font-mono text-xs"
                required
              />
            )}
          </form.AppField>
          <FormError error={checkM.error} />
          <form.AppForm>
            <form.SubmitButton variant="outline">
              {t("relationships.check.checkBtn")}
            </form.SubmitButton>
          </form.AppForm>
        </form>
        {record && (
          <div className="mt-3 flex items-center gap-2">
            <DecisionBadge allowed={record.allowed} />
            {hops > 0 && (
              <span className="text-xs text-muted-foreground">
                {t("relationships.check.hops", { count: hops })}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const BROWSE_FIELDS = { object: "relationships.validation.object" };

function BrowseCard() {
  const { t } = useTranslation("rbac");
  const [object, setObject] = useState("");
  const tuplesQ = useRelationTuples(object);
  const deleteM = useDeleteTuple();
  const runSensitive = useSensitiveAction();
  const schema = useTupleSchema(BROWSE_FIELDS);
  const form = useAppForm({
    defaultValues: { object: "" },
    validators: { onSubmit: schema },
    onSubmit: ({ value }) => setObject(value.object.trim()),
  });
  const items = tuplesQ.data?.items ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("relationships.tuples.title")}</CardTitle>
        <CardDescription>{t("relationships.tuples.description")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <form
          className="flex max-w-md items-end gap-2"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void form.handleSubmit();
          }}
        >
          <div className="flex-1">
            <form.AppField name="object">
              {(field) => (
                <field.TextField
                  label={t("relationships.tuples.objectLabel")}
                  placeholder="document:readme"
                />
              )}
            </form.AppField>
          </div>
          <form.AppForm>
            <form.SubmitButton variant="outline">
              {t("relationships.tuples.showBtn")}
            </form.SubmitButton>
          </form.AppForm>
        </form>
        {object && (
          <DataState
            isLoading={tuplesQ.isLoading}
            isError={tuplesQ.isError}
            error={tuplesQ.error}
            isEmpty={items.length === 0}
            emptyIcon={NetworkIcon}
            emptyTitle={t("relationships.tuples.empty")}
            skeletonRows={2}
          >
            <ul className="divide-y">
              {items.map((tuple) => (
                <li key={tuple.id} className="flex items-center justify-between gap-4 py-2">
                  <span className="font-mono text-sm">
                    {tuple.object} <span className="text-muted-foreground">#{tuple.relation}</span>{" "}
                    {tuple.subject}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={deleteM.isPending}
                    onClick={() =>
                      runSensitive({
                        confirm: {
                          title: t("relationships.tuples.deleteTitle"),
                          description: t("relationships.tuples.deleteDescription", {
                            tuple: `${tuple.object}#${tuple.relation} ${tuple.subject}`,
                          }),
                          confirmLabel: t("relationships.tuples.deleteBtn"),
                          tone: "destructive",
                        },
                        actionLabel: t("relationships.tuples.deleteAction").toLowerCase(),
                        run: () => deleteM.mutateAsync(tuple.id),
                      }).catch(settleSensitiveAction)
                    }
                  >
                    <TrashIcon /> {t("relationships.tuples.deleteBtn")}
                  </Button>
                </li>
              ))}
            </ul>
          </DataState>
        )}
      </CardContent>
    </Card>
  );
}

const GRAPH_FIELDS = {
  object: "relationships.validation.object",
  relation: "relationships.validation.relation",
};

function GraphCard() {
  const { t } = useTranslation("rbac");
  const [query, setQuery] = useState<{ object: string; relation: string } | null>(null);
  const graphQ = useRelationGraph(query?.object ?? "", query?.relation ?? "");
  const schema = useTupleSchema(GRAPH_FIELDS);
  const form = useAppForm({
    defaultValues: { object: "", relation: "" },
    validators: { onSubmit: schema },
    onSubmit: ({ value }) =>
      setQuery({ object: value.object.trim(), relation: value.relation.trim() }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("relationships.graph.title")}</CardTitle>
        <CardDescription>{t("relationships.graph.description")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <form
          className="flex flex-wrap items-end gap-2"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void form.handleSubmit();
          }}
        >
          <div className="w-52">
            <form.AppField name="object">
              {(field) => (
                <field.TextField
                  label={t("relationships.graph.objectAriaLabel")}
                  placeholder="document:readme"
                />
              )}
            </form.AppField>
          </div>
          <div className="w-36">
            <form.AppField name="relation">
              {(field) => (
                <field.TextField
                  label={t("relationships.graph.relationAriaLabel")}
                  placeholder="viewer"
                />
              )}
            </form.AppField>
          </div>
          <form.AppForm>
            <form.SubmitButton variant="outline" disabled={graphQ.isFetching}>
              {t("relationships.graph.expandBtn")}
            </form.SubmitButton>
          </form.AppForm>
          {graphQ.data && (
            <Badge variant="muted" className="self-center">
              {t("relationships.graph.size", {
                nodes: graphQ.data.nodes.length,
                edges: graphQ.data.edges.length,
              })}
            </Badge>
          )}
        </form>
        {query && (
          <DataState
            isLoading={graphQ.isLoading}
            isError={graphQ.isError}
            error={graphQ.error}
            isEmpty={!graphQ.data || graphQ.data.nodes.length === 0}
            emptyIcon={NetworkIcon}
            emptyTitle={t("relationships.graph.empty")}
            skeletonRows={3}
          >
            {graphQ.data && (
              <RelationshipGraph graph={graphQ.data} rootId={query.object} height={480} />
            )}
          </DataState>
        )}
      </CardContent>
    </Card>
  );
}
