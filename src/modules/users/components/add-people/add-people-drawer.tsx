import { SendIcon, UploadIcon, UserPlusIcon } from "@qeetrix/icons";
import {
  Badge,
  Button,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerFooter,
  Field,
  Link,
  Radio,
  RadioGroup,
  Select,
  TextField,
} from "@qeetrix/react";
import {
  Alert,
  type EmailEntryState,
  MultiEmailField,
  PasswordInput,
} from "@qeetrix/react/experimental";
import { Link as RouterLink } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useRoles } from "@/modules/authorization";
import { useOrgs } from "@/modules/organizations";
import {
  checkAddresses,
  isEmail,
  MAX_INVITES,
  parseAddresses,
  sendable,
  toE164,
} from "@/modules/users/add-people-model";
import { inviteCalls, useInvitations } from "@/modules/users/api/invitations";
import { useCreateUser, useUserDirectory } from "@/modules/users/api/users";
import { usePeopleRun } from "@/modules/users/components/people/people-bulk";
import "@/modules/users/components/people/people.css";
import { useOrganizationId } from "@/platform/auth/session";
import { ErrorReference } from "@/platform/components/error-reference";
import { errorMessage, fieldErrorMessages } from "@/platform/errors/user-message";
import { useCapabilities } from "@/platform/security/capability-provider";
import {
  SensitiveActionCancelled,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import { roleDisplayName } from "@/shared/utils/role-name";

type Mode = "invite" | "create";
type Errors = {
  email?: string;
  phone?: string;
  password?: string;
  addresses?: string;
  form?: string;
};
/**
 * Add people, the Users list's one main action: an email invitation (recommended — they choose
 * their own password) or an account created now with a first password. An invitation takes
 * several addresses, each checked against the directory first. They join the organisation you're
 * in, so there's no organisation to choose.
 */
export function AddPeopleDrawer({
  open,
  onOpenChange,
  mode: initialMode = "invite",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: Mode;
}) {
  const { t } = useTranslation("users");
  const access = useCapabilities();
  const canCreate = access.canAll(["user.write", "role.read", "role.write"]);
  const organizationId = useOrganizationId();
  const org = useOrgs().data?.items.find((item) => item.id === organizationId);
  const roles = useRoles().data?.items ?? [];
  const members = useUserDirectory(open).data?.items ?? [];
  const invites = useInvitations(open).data?.items ?? [];
  const createUser = useCreateUser();
  const runSensitive = useSensitiveAction();
  const { run, running } = usePeopleRun(
    () => onOpenChange(false),
    (n) => t("addPeople.sent", { count: n }),
  );

  const [mode, setMode] = useState<Mode>(initialMode);
  const [roleId, setRoleId] = useState("");
  const [addresses, setAddresses] = useState<string[]>([]);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  // The refused request, for its support reference.
  const [failure, setFailure] = useState<unknown>(null);
  // Each opening starts clean, in the way it was opened for.
  useEffect(() => {
    if (!open) return;
    setMode(canCreate ? initialMode : "invite");
    setRoleId("");
    setAddresses([]);
    setEmail("");
    setName("");
    setPhone("");
    setPassword("");
    setErrors({});
    setFailure(null);
  }, [open, initialMode, canCreate]);

  // A member-type role by default, else the last (least-privileged) one, so they join as members.
  const role = roleId || roles.find((r) => /member/i.test(r.name))?.id || roles.at(-1)?.id || "";
  const chosen = roles.find((r) => r.id === role);
  const checks = checkAddresses(addresses, members, invites);
  const outcome = (email: string): EmailEntryState | undefined => {
    const check = checks.find((c) => c.email === email);
    if (!check) return undefined;
    if (check.kind === "invited") return { tone: "info", note: t("addPeople.checks.invited") };
    if (check.kind === "member") return { tone: "skipped", note: t("addPeople.checks.member") };
    if (check.kind === "invalid") return { tone: "danger", note: t("addPeople.checks.invalid") };
    return { tone: "success", note: t("addPeople.checks.new") };
  };
  const targets = sendable(checks);
  const busy = !!running || createUser.isPending;

  function sendInvitations() {
    if (!organizationId) return;
    if (targets.length === 0) return setErrors({ addresses: t("addPeople.errors.noAddresses") });
    if (targets.length > MAX_INVITES)
      return setErrors({ addresses: t("addPeople.errors.tooMany", { n: MAX_INVITES }) });
    setErrors({});
    const byEmail = new Map(targets.map((c) => [c.email, c]));
    run(
      t("addPeople.sendAction"),
      targets.map((c) => c.email),
      (address) => {
        const target = byEmail.get(address);
        return target?.kind === "invited"
          ? inviteCalls.resend(target.invite.id)
          : inviteCalls.create({
              organization_id: organizationId,
              email: address,
              role_id: role || undefined,
            });
      },
    );
  }

  function createAccount() {
    if (!organizationId) return;
    const address = email.trim();
    const e164 = phone.trim() ? toE164(phone) : undefined;
    const next: Errors = {};
    if (!isEmail(address)) next.email = t("create.validation.email");
    else if (members.some((u) => u.email.toLowerCase() === address.toLowerCase()))
      next.email = t("addPeople.errors.alreadyMember");
    if (e164 === null) next.phone = t("addPeople.errors.phone");
    if (password.length < 8) next.password = t("create.validation.password");
    setErrors(next);
    if (Object.keys(next).length) return;
    runSensitive({
      actionLabel: t("create.actionLabel"),
      run: () =>
        createUser.mutateAsync({
          organization_id: organizationId,
          email: address,
          password,
          display_name: name.trim() || undefined,
          phone: e164 ?? undefined,
          role_id: role || undefined,
        }),
    })
      .then(() => onOpenChange(false))
      .catch((err: unknown) => {
        if (err instanceof SensitiveActionCancelled) return;
        setFailure(err);
        const fields = fieldErrorMessages(err);
        setErrors({
          email: fields.email,
          phone: fields.phone,
          password: fields.password,
          form: Object.keys(fields).length ? undefined : errorMessage(err),
        });
      });
  }

  const roleField = (
    <Field
      label={t("create.role")}
      description={
        chosen?.description ? `${roleDisplayName(chosen.name)}: ${chosen.description}` : undefined
      }
    >
      <Select
        value={role}
        onValueChange={(value) => setRoleId(String(value ?? ""))}
        items={roles.map((r): { value: string; label: string } => ({
          value: r.id,
          label: roleDisplayName(r.name),
        }))}
      />
    </Field>
  );

  return (
    <Drawer open={open} onOpenChange={(next) => (!busy || next) && onOpenChange(next)}>
      <DrawerContent
        title={t("addPeople.title")}
        description={
          org ? t("addPeople.description", { org: org.name }) : t("addPeople.descriptionNoName")
        }
        size="md"
      >
        <DrawerBody>
          <form
            id="add-people"
            className="sub-form"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              if (!busy) (mode === "invite" ? sendInvitations : createAccount)();
            }}
          >
            {errors.form ? <Alert tone="danger" title={errors.form} /> : null}
            {failure ? <ErrorReference error={failure} /> : null}
            {canCreate ? (
              <RadioGroup<Mode>
                label={t("addPeople.how")}
                variant="tile"
                value={mode}
                onValueChange={(value) => {
                  setMode(value);
                  setErrors({});
                }}
              >
                <Radio<Mode>
                  value="invite"
                  icon={SendIcon}
                  label={
                    <>
                      {t("addPeople.invite")}{" "}
                      <Badge tone="brand" size="sm">
                        {t("addPeople.recommended")}
                      </Badge>
                    </>
                  }
                  description={t("addPeople.inviteDescription")}
                />
                <Radio<Mode>
                  value="create"
                  icon={UserPlusIcon}
                  label={t("addPeople.create")}
                  description={t("addPeople.createDescription")}
                />
              </RadioGroup>
            ) : null}

            {mode === "invite" ? (
              <>
                <Field
                  label={t("addPeople.addresses")}
                  description={t("addPeople.addressesHelp", { n: MAX_INVITES })}
                  error={errors.addresses}
                >
                  <MultiEmailField
                    value={addresses}
                    onValueChange={(next) => {
                      // "<name@org.in>" from a mail client reads as the address itself.
                      setAddresses(parseAddresses(next.join(" ")));
                      if (errors.addresses) setErrors({});
                    }}
                    check={outcome}
                    max={MAX_INVITES}
                    placeholder={t("addPeople.addressesPlaceholder")}
                    messages={{ entries: t("addPeople.checksLabel") }}
                  />
                </Field>
                {roleField}
              </>
            ) : (
              <>
                <TextField
                  label={t("addPeople.email")}
                  type="email"
                  autoComplete="off"
                  value={email}
                  onValueChange={(value) => setEmail(value)}
                  description={t("addPeople.emailHelp")}
                  error={errors.email}
                />
                <TextField
                  label={t("addPeople.name")}
                  optional
                  value={name}
                  onValueChange={(value) => setName(value)}
                  description={t("addPeople.nameHelp")}
                />
                <TextField
                  label={t("create.phone")}
                  optional
                  type="tel"
                  value={phone}
                  onValueChange={(value) => setPhone(value)}
                  placeholder={t("addPeople.phonePlaceholder")}
                  description={t("addPeople.phoneHelp")}
                  error={errors.phone}
                />
                {roleField}
                <Field
                  label={t("addPeople.password")}
                  description={t("create.passwordHelp")}
                  error={errors.password}
                >
                  <PasswordInput
                    autoComplete="new-password"
                    value={password}
                    onValueChange={(value) => setPassword(value)}
                  />
                </Field>
              </>
            )}
          </form>
        </DrawerBody>
        <DrawerFooter
          start={
            <Link className="add-import" render={<RouterLink to="/users/import" />}>
              <UploadIcon className="add-import-icon" aria-hidden="true" />
              {t("addPeople.import")}
            </Link>
          }
        >
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            {t("addPeople.cancel")}
          </Button>
          {mode === "invite" ? (
            <Button type="submit" form="add-people" icon={SendIcon} loading={!!running}>
              {targets.length
                ? t("addPeople.sendN", { count: targets.length })
                : t("addPeople.send")}
            </Button>
          ) : (
            <Button
              type="submit"
              form="add-people"
              icon={UserPlusIcon}
              loading={createUser.isPending}
            >
              {t("create.submit")}
            </Button>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
