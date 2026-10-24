import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  FieldLabel,
  Input,
  SegmentedControl,
  SegmentedControlItem,
  Switch,
  toast,
} from "@qeetrix/ui";
import { ErrorText } from "@/platform/components/error-reference";
import { CopyIcon, DownloadIcon, LoaderCircleIcon, SaveIcon, TrashIcon } from "@qeetrix/icons";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { PageHeader } from "@/platform/components/page-header";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import { type BlockKind, PolicyCanvas } from "./canvas/policy-canvas";
import { CodePreview } from "./code-preview/code-preview";
import { policyProblemMessage } from "./condition-builder/condition-problem";
import { ConditionTree } from "./condition-builder/condition-tree";
import { ComingSoon } from "./shared/coming-soon";
import { type Effect, emptyGroup, useCreateAbacPolicy } from "../api/abac";
import {
  abacSaveBlocker,
  emptyPolicyDoc,
  type PolicyDoc,
  toAbacInput,
  toJson,
} from "../utils/policy-codegen";
import { setBuilderDoc, useBuilderDoc } from "../store/authz-store";
import { downloadBlob } from "@/shared/utils/data-export";

/** Renders the visual policy builder and its generated code. */
export function PolicyBuilderPage() {
  const { t } = useTranslation("authorization");
  const runSensitive = useSensitiveAction();
  const handoff = useBuilderDoc();
  const [doc, setDoc] = useState<PolicyDoc>(() => handoff ?? emptyPolicyDoc());
  const [selected, setSelected] = useState<BlockKind | null>("decision");

  // Consume a template hand-off from the store exactly once, on mount.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional run-once mount effect
  useEffect(() => {
    if (handoff) {
      setDoc(handoff);
      setBuilderDoc(null);
    }
  }, []);

  const createM = useCreateAbacPolicy();
  const blocker = abacSaveBlocker(doc);
  const reducible = blocker === null;

  function toggleBlock(kind: Exclude<BlockKind, "decision">) {
    setDoc((d) => {
      if (kind === "rbac") return { ...d, requireRole: d.requireRole == null ? "" : null };
      if (kind === "rebac")
        return { ...d, relation: d.relation == null ? { object: "", relation: "" } : null };
      return { ...d, condition: d.condition == null ? emptyGroup("all") : null };
    });
  }

  function saveAsAbac() {
    runSensitive({
      actionLabel: t("abac.createAction"),
      run: () => createM.mutateAsync(toAbacInput(doc)),
    }).catch(settleSensitiveAction);
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader
        description={t("policyBuilderPage.composeRbacAbacAnd")}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                // Confirm only a copy that happened; the clipboard can be missing or refuse.
                void navigator.clipboard
                  ?.writeText(toJson(doc))
                  .then(() => toast.success(t("policyBuilderPage.copiedJson")));
              }}
            >
              <CopyIcon /> {t("policyBuilderPage.copyJson")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                downloadBlob(toJson(doc), "application/json", `${doc.name || "policy"}.json`)
              }
            >
              <DownloadIcon /> {t("policyBuilderPage.export")}
            </Button>
            <Button
              size="sm"
              onClick={saveAsAbac}
              disabled={!reducible || createM.isPending || !doc.name.trim()}
            >
              {createM.isPending ? <LoaderCircleIcon className="animate-spin" /> : <SaveIcon />}
              {t("policyBuilderPage.saveAsAbac")}
            </Button>
          </>
        }
      />

      {createM.error && (
        <p className="text-destructive text-sm">
          <ErrorText error={createM.error} />
        </p>
      )}

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="text-base">{t("policyBuilderPage.blueprint")}</CardTitle>
            <CardDescription>{t("policyBuilderPage.addBlocksAndClick")}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <PolicyCanvas
              doc={doc}
              selected={selected}
              onSelect={setSelected}
              onToggleBlock={toggleBlock}
              height={480}
            />
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="text-base">{t("policyBuilderPage.inspector")}</CardTitle>
            <CardDescription>
              {selected
                ? t(`policyBuilderPage.editingBlock.${selected}`)
                : t("policyBuilderPage.selectANode")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Inspector selected={selected} doc={doc} onChange={setDoc} />
          </CardContent>
        </Card>
      </div>

      {blocker && (
        <ComingSoon
          title={t("policyBuilderPage.thisPolicyIsnT")}
          description={policyProblemMessage(blocker)}
          note={t("policyBuilderPage.abacOnlyNote")}
        />
      )}

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
          <div>
            <CardTitle className="text-base">{t("policyBuilderPage.generatedPolicy")}</CardTitle>
            <CardDescription>{t("policyBuilderPage.jsonYamlDslEvaluationTree")}</CardDescription>
          </div>
          <Badge variant={reducible ? "success" : "warning"}>
            {reducible ? t("policyBuilderPage.persistable") : t("policyBuilderPage.previewOnly")}
          </Badge>
        </CardHeader>
        <CardContent>
          <CodePreview doc={doc} height={360} />
        </CardContent>
      </Card>
    </div>
  );
}

function Inspector({
  selected,
  doc,
  onChange,
}: {
  selected: BlockKind | null;
  doc: PolicyDoc;
  onChange: (d: PolicyDoc) => void;
}) {
  const { t } = useTranslation(["authorization", "common"]);
  if (selected === "decision" || selected === null) {
    return (
      <div className="flex flex-col gap-4">
        <Field>
          <FieldLabel htmlFor="b-name">{t("common:labels.name")}</FieldLabel>
          <Input
            id="b-name"
            value={doc.name}
            onChange={(e) => onChange({ ...doc, name: e.target.value })}
            placeholder="policy_name"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="b-effect">{t("policyBuilderPage.effect")}</FieldLabel>
          <SegmentedControl
            value={doc.effect}
            onValueChange={(v) => onChange({ ...doc, effect: v as Effect })}
            aria-label={t("policyBuilderPage.effect")}
          >
            <SegmentedControlItem value="allow">
              {t("policyBuilderPage.allow")}
            </SegmentedControlItem>
            <SegmentedControlItem value="deny">{t("policyBuilderPage.deny")}</SegmentedControlItem>
          </SegmentedControl>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field>
            <FieldLabel htmlFor="b-resource">{t("policyBuilderPage.resourceType")}</FieldLabel>
            <Input
              id="b-resource"
              value={doc.resourceType}
              onChange={(e) => onChange({ ...doc, resourceType: e.target.value })}
              placeholder="*"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="b-action">{t("policyBuilderPage.action")}</FieldLabel>
            <Input
              id="b-action"
              value={doc.action}
              onChange={(e) => onChange({ ...doc, action: e.target.value })}
              placeholder="*"
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 items-end gap-3">
          <Field>
            <FieldLabel htmlFor="b-priority">{t("policyBuilderPage.priority")}</FieldLabel>
            <Input
              id="b-priority"
              type="number"
              value={doc.priority}
              onChange={(e) => onChange({ ...doc, priority: Number(e.target.value) || 0 })}
            />
          </Field>
          <div className="flex items-center gap-2 pb-2 text-sm">
            <Switch
              checked={doc.enabled}
              onCheckedChange={(c) => onChange({ ...doc, enabled: c })}
              aria-label={t("policyBuilderPage.enabled")}
            />
            {t("policyBuilderPage.enabled")}
          </div>
        </div>
      </div>
    );
  }

  if (selected === "rbac") {
    return (
      <div className="flex flex-col gap-3">
        <Field>
          <FieldLabel htmlFor="b-role">{t("policyBuilderPage.requiredRole")}</FieldLabel>
          <Input
            id="b-role"
            value={doc.requireRole ?? ""}
            onChange={(e) => onChange({ ...doc, requireRole: e.target.value })}
            placeholder="admin"
          />
        </Field>
        <Button variant="outline" size="sm" onClick={() => onChange({ ...doc, requireRole: null })}>
          <TrashIcon /> {t("policyBuilderPage.removeBlock")}
        </Button>
      </div>
    );
  }

  if (selected === "rebac") {
    return (
      <div className="flex flex-col gap-3">
        <Field>
          <FieldLabel htmlFor="b-object">{t("policyBuilderPage.object")}</FieldLabel>
          <Input
            id="b-object"
            value={doc.relation?.object ?? ""}
            onChange={(e) =>
              onChange({
                ...doc,
                relation: { object: e.target.value, relation: doc.relation?.relation ?? "" },
              })
            }
            placeholder="document:readme"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="b-relation">{t("policyBuilderPage.relation")}</FieldLabel>
          <Input
            id="b-relation"
            value={doc.relation?.relation ?? ""}
            onChange={(e) =>
              onChange({
                ...doc,
                relation: { object: doc.relation?.object ?? "", relation: e.target.value },
              })
            }
            placeholder="owner"
          />
        </Field>
        <Button variant="outline" size="sm" onClick={() => onChange({ ...doc, relation: null })}>
          <TrashIcon /> {t("policyBuilderPage.removeBlock")}
        </Button>
      </div>
    );
  }

  // abac
  return (
    <div className="flex flex-col gap-3">
      {doc.condition ? (
        <ConditionTree
          value={doc.condition}
          onChange={(condition) => onChange({ ...doc, condition })}
        />
      ) : (
        <p className="text-sm text-muted-foreground">{t("policyBuilderPage.noConditionBlock")}</p>
      )}
      {doc.condition && (
        <Button variant="outline" size="sm" onClick={() => onChange({ ...doc, condition: null })}>
          <TrashIcon /> {t("policyBuilderPage.removeBlock")}
        </Button>
      )}
    </div>
  );
}
