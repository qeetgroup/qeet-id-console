import { DownloadIcon, PlayIcon, TrashIcon } from "@qeetrix/icons";
import { Button } from "@qeetrix/react";
import { Alert, CodeBlock } from "@qeetrix/react/experimental";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { type DecisionRecord, useAbacSimulate } from "@/modules/authorization/api/simulate";
import { Output } from "@/modules/authorization/components/workspace/workspace";
import { pushDecision } from "@/modules/authorization/store/authz-store";
import { toDsl, toJson } from "@/modules/authorization/utils/policy-codegen";
import { ErrorReference } from "@/platform/components/error-reference";
import { ERROR_CODES } from "@/platform/errors/error-codes";
import { normalizeError } from "@/platform/errors/normalize-error";
import { errorMessage } from "@/platform/errors/user-message";
import { downloadBlob } from "@/shared/utils/data-export";
import { type Draft, toDoc } from "./policy-draft";
import { parseRequest, PolicyTest, sampleRequest } from "./policy-test";

type View = "test" | "dsl" | "json";

/**
 * Docked under the policy: a test of the saved policies, and the policy as the console's policy
 * language and as JSON. Keyed by the policy open, so a new one starts with its own request.
 */
export function PolicyOutput({ draft, dirty }: { draft: Draft; dirty: boolean }) {
  const { t } = useTranslation("authorization");
  const [view, setView] = useState<View>("test");
  const [request, setRequest] = useState(() => sampleRequest(draft));
  const [invalid, setInvalid] = useState(false);
  const [record, setRecord] = useState<DecisionRecord | null>(null);
  const testM = useAbacSimulate();
  const doc = toDoc(draft);

  function runTest() {
    const parsed = parseRequest(request);
    setInvalid(!parsed);
    if (!parsed) return;
    testM.mutate(
      {
        subject: parsed.subject ?? {},
        resource: parsed.resource ?? { type: draft.resourceType || "*", id: "example" },
        action: parsed.action ?? (draft.action || "*"),
        context: parsed.context ?? {},
      },
      {
        onSuccess: (rec) => {
          setRecord(rec);
          pushDecision(rec);
        },
        onError: () => setRecord(null),
      },
    );
  }

  return (
    <Output<View>
      label={t("abac.output")}
      value={view}
      onValueChange={setView}
      tabs={[
        { value: "test", label: t("abac.test") },
        { value: "dsl", label: t("abac.policyLanguage") },
        { value: "json", label: "JSON" },
      ]}
      end={
        view === "test" ? (
          <Button
            variant="soft"
            size="sm"
            icon={PlayIcon}
            loading={testM.isPending}
            onClick={runTest}
          >
            {t("abac.runTest")}
          </Button>
        ) : view === "json" ? (
          <Button
            variant="ghost"
            tone="neutral"
            size="sm"
            icon={DownloadIcon}
            onClick={() =>
              downloadBlob(toJson(doc), "application/json", `${doc.name || "policy"}.json`)
            }
          >
            {t("abac.export")}
          </Button>
        ) : null
      }
    >
      {view === "test" ? (
        <PolicyTest
          request={request}
          onRequestChange={(raw) => {
            setRequest(raw);
            if (invalid) setInvalid(false);
          }}
          invalid={invalid}
          record={record}
          error={testM.error}
          unsaved={dirty}
        />
      ) : view === "dsl" ? (
        <CodeBlock code={toDsl(doc)} title={t("abac.policyLanguage")} />
      ) : (
        <CodeBlock code={toJson(doc)} language="json" title="JSON" />
      )}
    </Output>
  );
}

/** Above the policy: why the last save failed, and a template's block that can't be saved. */
export function PolicyNotices({
  draft,
  failure,
  onRemoveBlocks,
}: {
  draft: Draft | null;
  failure: unknown;
  onRemoveBlocks?: () => void;
}) {
  const { t } = useTranslation("authorization");
  const locksOut = !!failure && normalizeError(failure).code === ERROR_CODES.ABAC_POLICY_LOCKS_OUT;
  const role = draft?.requireRole != null;
  return (
    <>
      {failure ? (
        <Alert tone="danger" title={locksOut ? t("abac.errors.locksOut") : errorMessage(failure)}>
          {locksOut ? t("abac.errors.locksOutHint") : <ErrorReference error={failure} />}
        </Alert>
      ) : null}
      {draft && (role || draft.relation) ? (
        <Alert
          tone="warning"
          title={role ? t("abac.roleBlockTitle") : t("abac.relationBlockTitle")}
          actions={
            onRemoveBlocks ? (
              <Button variant="ghost" size="sm" icon={TrashIcon} onClick={onRemoveBlocks}>
                {role ? t("abac.removeRoleBlock") : t("abac.removeRelationBlock")}
              </Button>
            ) : undefined
          }
        >
          {t("abac.blockHint")}
        </Alert>
      ) : null}
    </>
  );
}
