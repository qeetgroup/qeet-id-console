import {
  Button,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerFooter,
  Field,
  TextField,
  Toggle,
  ToggleGroup,
} from "@qeetrix/react";
import { Alert, Combobox } from "@qeetrix/react/experimental";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useWriteTuple } from "@/modules/authorization/api/relationships";
import { usePeople } from "@/modules/authorization/components/shared/use-people";
import { ErrorReference } from "@/platform/components/error-reference";
import { ERROR_CODES } from "@/platform/errors/error-codes";
import { normalizeError } from "@/platform/errors/normalize-error";
import { errorMessage } from "@/platform/errors/user-message";
import {
  SensitiveActionCancelled,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";

type Errors = { object?: string; relation?: string; subject?: string };
const OBJECT = /^[^:\s]+:\S+$/;
const USERSET = /^[^:\s#]+:[^\s#]+(#[^\s#]+)?$/;

/**
 * Adds one relationship: a subject holds a relation on an object (POST /relation-tuples, with a
 * step-up). The subject is a person, or everyone holding a relation on another object
 * (group:eng#member), which the engine expands when access is checked.
 */
export function AddRelationshipDrawer({
  open,
  onOpenChange,
  object: startObject,
  relation: startRelation,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  object: string;
  relation: string;
  onAdded: (object: string, relation: string) => void;
}) {
  const { t } = useTranslation("authorization");
  const people = usePeople();
  const writeM = useWriteTuple();
  const runSensitive = useSensitiveAction();
  const [object, setObject] = useState("");
  const [relation, setRelation] = useState("");
  const [kind, setKind] = useState<"person" | "userset">("person");
  const [person, setPerson] = useState<string | null>(null);
  const [userset, setUserset] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [failure, setFailure] = useState<unknown>(null);

  useEffect(() => {
    if (!open) return;
    setObject(startObject);
    setRelation(startRelation);
    setKind(people.canRead ? "person" : "userset");
    setPerson(null);
    setUserset("");
    setErrors({});
    setFailure(null);
  }, [open, startObject, startRelation, people.canRead]);

  const subject = kind === "person" ? (person ? `user:${person}` : "") : userset.trim();
  const bare =
    kind === "userset" &&
    USERSET.test(subject) &&
    !subject.includes("#") &&
    !subject.startsWith("user:");

  async function submit() {
    const next: Errors = {};
    if (!OBJECT.test(object.trim())) next.object = t("addRelationship.errors.object");
    if (!relation.trim() || /\s|#/.test(relation.trim()))
      next.relation = t("addRelationship.errors.relation");
    if (!subject || (kind === "userset" && !USERSET.test(subject)))
      next.subject =
        kind === "person"
          ? t("addRelationship.errors.person")
          : t("addRelationship.errors.subject");
    setErrors(next);
    setFailure(null);
    if (Object.keys(next).length) return;
    const body = { object: object.trim(), relation: relation.trim(), subject };
    try {
      const written = await runSensitive({
        actionLabel: t("addRelationship.action"),
        run: () => writeM.mutateAsync(body),
      });
      if (written) {
        onAdded(body.object, body.relation);
        onOpenChange(false);
      }
    } catch (err) {
      if (err instanceof SensitiveActionCancelled) return;
      const code = normalizeError(err).code;
      if (code === ERROR_CODES.REBAC_OBJECT_INVALID)
        setErrors({ object: t("addRelationship.errors.object") });
      else if (code === ERROR_CODES.REBAC_SUBJECT_INVALID)
        setErrors({ subject: t("addRelationship.errors.subject") });
      else if (code === ERROR_CODES.REBAC_RELATION_REQUIRED)
        setErrors({ relation: t("addRelationship.errors.relation") });
      else setFailure(err);
    }
  }

  return (
    <Drawer open={open} onOpenChange={(next) => (!writeM.isPending || next) && onOpenChange(next)}>
      <DrawerContent
        title={t("addRelationship.title")}
        description={t("addRelationship.description")}
        size="md"
      >
        <DrawerBody>
          <form
            id="add-relationship"
            className="ws-drawer-form"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              if (!writeM.isPending) void submit();
            }}
          >
            {failure ? (
              <Alert tone="danger" title={errorMessage(failure)}>
                <ErrorReference error={failure} />
              </Alert>
            ) : null}
            <TextField
              label={t("addRelationship.object")}
              description={t("addRelationship.objectHint")}
              value={object}
              onValueChange={setObject}
              placeholder="document:readme"
              error={errors.object}
              invalid={!!errors.object}
              spellCheck={false}
              autoComplete="off"
            />
            <TextField
              label={t("addRelationship.relation")}
              description={t("addRelationship.relationHint")}
              value={relation}
              onValueChange={setRelation}
              placeholder="viewer"
              error={errors.relation}
              invalid={!!errors.relation}
              spellCheck={false}
              autoComplete="off"
            />
            <Field label={t("addRelationship.subjectKind")}>
              <ToggleGroup
                value={[kind]}
                onValueChange={(v) => {
                  if (v[0] === "person" || v[0] === "userset") setKind(v[0]);
                }}
                aria-label={t("addRelationship.subjectKind")}
              >
                <Toggle value="person" disabled={!people.canRead}>
                  {t("addRelationship.aPerson")}
                </Toggle>
                <Toggle value="userset">{t("addRelationship.aGroup")}</Toggle>
              </ToggleGroup>
            </Field>
            {kind === "person" ? (
              <Field
                label={t("addRelationship.person")}
                error={errors.subject}
                invalid={!!errors.subject}
              >
                <Combobox<string>
                  items={people.items}
                  value={person}
                  onValueChange={(v) => setPerson(v ?? null)}
                  placeholder={t("addRelationship.personPlaceholder")}
                />
              </Field>
            ) : (
              <TextField
                label={t("addRelationship.subject")}
                description={
                  bare ? t("addRelationship.bareHint") : t("addRelationship.subjectHint")
                }
                value={userset}
                onValueChange={setUserset}
                placeholder="group:engineering#member"
                error={errors.subject}
                invalid={!!errors.subject}
                spellCheck={false}
                autoComplete="off"
              />
            )}
          </form>
        </DrawerBody>
        <DrawerFooter>
          <Button variant="ghost" tone="neutral" onClick={() => onOpenChange(false)}>
            {t("addRelationship.cancel")}
          </Button>
          <Button type="submit" form="add-relationship" loading={writeM.isPending}>
            {t("addRelationship.add")}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
