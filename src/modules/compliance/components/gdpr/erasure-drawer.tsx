// File an erasure request: choose the person (deleted people included, as an erasure is often
// asked for after an account is closed), give the reason, and see what happens on which day.
// Filing needs a step-up; nothing is erased for 30 days, and the request can be withdrawn until then.

import { ArrowRightIcon, SearchIcon } from "@qeetrix/icons";
import {
  Button,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerFooter,
  Field,
  formatDate,
  Textarea,
  TextField,
} from "@qeetrix/react";
import {
  Alert,
  Combobox,
  type ComboboxItemGroup,
  DescriptionItem,
  DescriptionList,
} from "@qeetrix/react/experimental";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import { ERASURE_GRACE_DAYS, useCreateGdprPurge } from "@/modules/compliance/api/gdpr";
import { isErased } from "@/modules/compliance/gdpr-model";
import type { usePeople } from "@/modules/compliance/use-people";
import { useTenantId } from "@/platform/auth/session";
import { ErrorReference } from "@/platform/components/error-reference";
import { normalizeError } from "@/platform/errors/normalize-error";
import { errorMessage } from "@/platform/errors/user-message";
import {
  SensitiveActionCancelled,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";

const DAY = 86_400_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ErasureDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  people: ReturnType<typeof usePeople>;
  /** People with a request already waiting. */
  pending: ReadonlySet<string>;
};

export function ErasureDrawer({ open, onOpenChange, people, pending }: ErasureDrawerProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      {open ? (
        <ErasureForm people={people} pending={pending} onDone={() => onOpenChange(false)} />
      ) : null}
    </Drawer>
  );
}

function ErasureForm({
  people,
  pending,
  onDone,
}: {
  people: ReturnType<typeof usePeople>;
  pending: ReadonlySet<string>;
  onDone: () => void;
}) {
  const { t } = useTranslation("compliance");
  const locale = formatLocale();
  const tenantId = useTenantId();
  const runSensitive = useSensitiveAction();
  const create = useCreateGdprPurge();
  const [person, setPerson] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();
  const [failure, setFailure] = useState<unknown>(null);
  const [today] = useState(() => Date.now());
  const on = formatDate(today + ERASURE_GRACE_DAYS * DAY, locale, { dateStyle: "long" });

  const groups = useMemo((): ComboboxItemGroup<string>[] => {
    const note = (id: string, base: string, elsewhere: boolean) =>
      pending.has(id)
        ? t("gdpr.file.pendingNote", { base })
        : elsewhere
          ? t("gdpr.file.elsewhereNote", { base })
          : base;
    return [
      {
        label: t("gdpr.file.groupPeople"),
        items: people.active.map((u) => {
          const elsewhere = !!tenantId && u.tenant_id !== tenantId;
          return {
            value: u.id,
            label: u.display_name?.trim() || u.email,
            description: note(u.id, u.email, elsewhere),
            disabled: pending.has(u.id) || elsewhere,
          };
        }),
      },
      {
        label: t("gdpr.file.groupDeleted"),
        items: people.deleted
          .filter((u) => !isErased(u.email))
          .map((u) => ({
            value: u.id,
            label: u.display_name?.trim() || u.email,
            description: note(
              u.id,
              t("gdpr.file.deletedNote", {
                email: u.email,
                date: formatDate(u.deleted_at, locale),
              }),
              false,
            ),
            disabled: pending.has(u.id),
          })),
      },
    ].filter((g) => g.items.length > 0);
  }, [people.active, people.deleted, pending, tenantId, t, locale]);

  async function submit() {
    const id = person.trim();
    if (!id) return setError(t("gdpr.file.personRequired"));
    if (!people.canRead && !UUID.test(id)) return setError(t("gdpr.file.userIdInvalid"));
    setError(undefined);
    setFailure(null);
    try {
      const filed = await runSensitive({
        actionLabel: t("gdpr.file.action"),
        run: () => create.mutateAsync({ user_id: id, reason: reason.trim() }),
      });
      if (filed) onDone();
    } catch (err) {
      if (err instanceof SensitiveActionCancelled) return;
      // Only the account's home organisation may have it erased; others are told it isn't found.
      if (normalizeError(err).httpStatus === 404) return setError(t("gdpr.file.notHere"));
      setFailure(err);
    }
  }

  return (
    <DrawerContent
      title={t("gdpr.file.title")}
      description={t("gdpr.file.description", { date: on, days: ERASURE_GRACE_DAYS })}
      size="sm"
    >
      <DrawerBody>
        <form
          id="erasure-request"
          className="cmp-form"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (!create.isPending) void submit();
          }}
        >
          {failure ? (
            <Alert tone="danger" title={errorMessage(failure)}>
              <ErrorReference error={failure} />
            </Alert>
          ) : null}
          {people.canRead ? (
            <Field
              label={t("gdpr.file.person")}
              description={error ? undefined : t("gdpr.file.personHelp")}
              error={error}
            >
              <Combobox<string>
                items={groups}
                value={person || null}
                onValueChange={(value) => {
                  setPerson(value ? String(value) : "");
                  setError(undefined);
                }}
                icon={SearchIcon}
                placeholder={t("gdpr.file.personPlaceholder")}
              />
            </Field>
          ) : (
            <TextField
              label={t("gdpr.file.userId")}
              description={error ? undefined : t("gdpr.file.userIdHelp")}
              error={error}
              value={person}
              onValueChange={(value) => {
                setPerson(value);
                setError(undefined);
              }}
              autoComplete="off"
              spellCheck={false}
            />
          )}
          <Field label={t("gdpr.file.reason")} optional description={t("gdpr.file.reasonHelp")}>
            <Textarea
              rows={3}
              maxRows={6}
              value={reason}
              onValueChange={setReason}
              placeholder={t("gdpr.file.reasonPlaceholder")}
            />
          </Field>
          <DescriptionList layout="rows">
            <DescriptionItem term={t("gdpr.file.untilTerm", { date: on })}>
              {t("gdpr.file.until")}
            </DescriptionItem>
            <DescriptionItem term={t("gdpr.file.onTerm", { date: on })}>
              {t("gdpr.file.on")}
            </DescriptionItem>
            <DescriptionItem term={t("gdpr.file.auditTerm")}>
              {t("gdpr.file.audit")}
            </DescriptionItem>
          </DescriptionList>
        </form>
      </DrawerBody>
      <DrawerFooter>
        <Button variant="ghost" onClick={onDone} disabled={create.isPending}>
          {t("gdpr.file.cancel")}
        </Button>
        <Button
          type="submit"
          form="erasure-request"
          icon={ArrowRightIcon}
          loading={create.isPending}
        >
          {t("gdpr.file.submit")}
        </Button>
      </DrawerFooter>
    </DrawerContent>
  );
}
