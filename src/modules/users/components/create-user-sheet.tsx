import {
  Card,
  CardContent,
  Button,
  FieldControl,
  FieldGroup,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@qeetrix/ui";
import { Link } from "@tanstack/react-router";
import {
  ArrowRightIcon,
  LockIcon,
  MailIcon,
  PlusIcon,
  ShieldCheckIcon,
  UserIcon,
  UserPlusIcon,
} from "@qeetrix/icons";
import { useStore } from "@tanstack/react-form";
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { useOrgs } from "@/modules/organizations";
import { useRoles } from "@/modules/authorization";
import {
  applyServerErrors,
  FieldFrame,
  FormError,
  useAppForm,
  useFieldChange,
} from "@/platform/forms/app-form";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import { DEFAULT_DIAL_COUNTRY, DIAL_CODES, toE164 } from "@/shared/data/country-dial-codes";

import { useCreateUser } from "../api/users";

type CreateUserSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string | null;
};

/** Renders the sheet that creates a password user in the current organization with a role. */
export function CreateUserSheet({ open, onOpenChange, tenantId }: CreateUserSheetProps) {
  const { t } = useTranslation(["users", "common"]);
  const rolesQ = useRoles();
  const roles = useMemo(() => rolesQ.data?.items ?? [], [rolesQ.data?.items]);
  const orgName = useOrgs().data?.items.find((o) => o.id === tenantId)?.name;
  const createM = useCreateUser();
  const runSensitive = useSensitiveAction();

  const schema = useMemo(
    () =>
      z.object({
        email: z.email(t("create.validation.email")),
        display_name: z.string().max(200, t("create.validation.displayName")),
        country: z.string(),
        phone: z.string().regex(/^[\d\s().-]*$/, t("create.validation.phone")),
        password: z.string().min(8, t("create.validation.password")),
        role_id: z.string().min(1, t("create.validation.role")),
      }),
    [t],
  );

  const form = useAppForm({
    defaultValues: {
      email: "",
      display_name: "",
      country: DEFAULT_DIAL_COUNTRY,
      phone: "",
      password: "",
      role_id: "",
    },
    validators: { onSubmit: schema },
    onSubmit: async ({ value, formApi }) => {
      if (!tenantId) return;
      const dial = DIAL_CODES.find((c) => c.code === value.country) ?? DIAL_CODES[0];
      // Assigning the role can ask for a step-up, which then names this action.
      await runSensitive({
        actionLabel: t("create.actionLabel"),
        run: () =>
          createM.mutateAsync({
            tenant_id: tenantId,
            email: value.email.trim(),
            password: value.password,
            display_name: value.display_name.trim() || undefined,
            phone: dial ? toE164(dial.dial, value.phone) : undefined,
            role_id: value.role_id,
          }),
      })
        .then(() => onOpenChange(false))
        .catch((err: unknown) => {
          applyServerErrors(formApi, err);
          settleSensitiveAction(err);
        });
    },
  });

  const country = useStore(form.store, (state) => state.values.country);

  // Default to a "member"-type role (else the least-privileged, last one), so a created user is
  // an organization member out of the box.
  useEffect(() => {
    if (form.getFieldValue("role_id") || roles.length === 0) return;
    const member = roles.find((r) => /member/i.test(r.name));
    form.setFieldValue("role_id", member?.id ?? roles.at(-1)?.id ?? "");
  }, [roles, form]);

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          form.reset();
          createM.reset();
        }
        onOpenChange(next);
      }}
    >
      <SheetContent side="right" className="w-full sm:max-w-md">
        <form
          className="flex h-full flex-col"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void form.handleSubmit();
          }}
        >
          <SheetHeader className="flex-row items-start gap-3 space-y-0">
            <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <UserPlusIcon className="size-4.5" />
            </span>
            <div className="min-w-0">
              <SheetTitle>{t("create.title")}</SheetTitle>
              <SheetDescription>{t("create.description")}</SheetDescription>
            </div>
          </SheetHeader>

          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            <Card>
              <CardContent className="space-y-4 p-4">
                <SectionHeading
                  icon={<UserIcon className="size-4" />}
                  title={t("create.detailsTitle")}
                  subtitle={t("create.detailsSubtitle")}
                />
                <FieldGroup>
                  <form.AppField name="email">
                    {(field) => (
                      <field.TextField
                        label={t("create.email")}
                        description={t("create.emailHelp")}
                        type="email"
                        autoComplete="off"
                        placeholder={t("create.emailPlaceholder")}
                        required
                      />
                    )}
                  </form.AppField>
                  <form.AppField name="display_name">
                    {(field) => (
                      <field.TextField
                        label={t("create.displayName")}
                        description={t("create.displayNameHelp")}
                        placeholder={t("create.displayNamePlaceholder")}
                      />
                    )}
                  </form.AppField>
                  <form.AppField name="phone">
                    {(field) => (
                      <FieldFrame label={t("create.phone")} description={t("create.phoneHelp")}>
                        <PhoneInput
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          country={country}
                          onCountryChange={(code) => form.setFieldValue("country", code)}
                          countryLabel={t("create.countryLabel")}
                          placeholder={t("create.phonePlaceholder")}
                        />
                      </FieldFrame>
                    )}
                  </form.AppField>
                </FieldGroup>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-4 p-4">
                <SectionHeading
                  icon={<LockIcon className="size-4" />}
                  title={t("create.accessTitle")}
                  subtitle={t("create.accessSubtitle")}
                />
                <FieldGroup>
                  <form.AppField name="password">
                    {(field) => (
                      <field.PasswordField
                        label={t("create.password")}
                        description={t("create.passwordHelp")}
                        autoComplete="new-password"
                        placeholder={t("create.passwordPlaceholder")}
                        required
                      />
                    )}
                  </form.AppField>
                  <form.AppField name="role_id">
                    {(field) => (
                      <field.SelectField
                        label={t("create.role")}
                        description={t("create.roleHelp")}
                        placeholder={
                          rolesQ.isLoading ? t("create.roleLoading") : t("create.rolePlaceholder")
                        }
                        options={roles.map((r) => ({ value: r.id, label: r.name }))}
                        required
                      />
                    )}
                  </form.AppField>
                </FieldGroup>
              </CardContent>
            </Card>

            <div className="flex items-start gap-3 px-1">
              <MailIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-medium">
                  {t("create.inviteTitle")}{" "}
                  <span className="font-normal text-muted-foreground">
                    {t("create.inviteOptional")}
                  </span>
                </p>
                <p className="text-sm text-muted-foreground">{t("create.inviteDescription")}</p>
                <Link
                  to="/invitations"
                  onClick={() => onOpenChange(false)}
                  className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                  {t("create.inviteCta")} <ArrowRightIcon className="size-3.5" />
                </Link>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-md border bg-muted/40 p-3">
              <ShieldCheckIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {t("create.summaryTitle", { org: orgName ?? t("create.thisOrganization") })}
                </p>
                <p className="text-sm text-muted-foreground">{t("create.summaryDescription")}</p>
              </div>
            </div>

            <FormError error={createM.error} />
          </div>

          <SheetFooter className="flex-row justify-end gap-2 border-t">
            <SheetClose render={<Button type="button" variant="outline" />}>
              {t("common:actions.cancel")}
            </SheetClose>
            <form.AppForm>
              <form.SubmitButton
                icon={<PlusIcon />}
                pendingLabel={t("create.submitting")}
                disabled={!tenantId}
              >
                {t("create.submit")}
              </form.SubmitButton>
            </form.AppForm>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

// One control, as a flag picker and a dial picker would both set the country; the trigger shows
// the flag and its dial code. The API takes one E.164 string, built on submit.
function PhoneInput({
  value,
  onBlur,
  country,
  onCountryChange,
  countryLabel,
  placeholder,
}: {
  value: string;
  onBlur: () => void;
  country: string;
  onCountryChange: (code: string) => void;
  countryLabel: string;
  placeholder: string;
}) {
  const change = useFieldChange<string>();
  const dial = DIAL_CODES.find((c) => c.code === country) ?? DIAL_CODES[0];
  return (
    <div className="flex items-center gap-2">
      <Select value={country} onValueChange={(v) => v && onCountryChange(v)}>
        <SelectTrigger className="w-28 shrink-0" aria-label={countryLabel}>
          <span className="flex items-center gap-1.5">
            <span className="text-base leading-none">{dial?.flag}</span>
            <span className="text-sm">{dial?.dial}</span>
          </span>
        </SelectTrigger>
        <SelectContent>
          {DIAL_CODES.map((c) => (
            <SelectItem key={c.code} value={c.code}>
              <span className="mr-2">{c.flag}</span>
              {c.code} <span className="text-muted-foreground">{c.dial}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FieldControl
        render={
          <Input
            type="tel"
            inputMode="tel"
            className="min-w-0 flex-1"
            placeholder={placeholder}
            value={value}
            onBlur={onBlur}
            onChange={(e) => change(e.target.value)}
          />
        }
      />
    </div>
  );
}

function SectionHeading({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <div className="min-w-0">
        <p className="text-sm font-semibold leading-none">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}
