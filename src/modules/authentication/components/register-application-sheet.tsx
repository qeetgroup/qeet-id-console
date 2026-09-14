import {
  Button,
  Callout,
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Textarea,
} from "@qeetrix/ui";
import { InfoIcon, Loader2Icon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { errorMessage } from "@/platform/errors/user-message";

import { type OidcClient, useCreateOidcClient } from "../api/oidc-clients";

type ClientType = "public" | "confidential";

type RegisterApplicationSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Receives the created client plus its one-time secret ("" for public clients). */
  onCreated: (client: OidcClient, secret: string) => void;
};

/** Splits a textarea into trimmed, non-empty lines. */
function lines(value: FormDataEntryValue | null): string[] {
  return String(value ?? "")
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * The "Register OAuth / OIDC application" slide-over.
 *
 * Uncontrolled inputs read through FormData on submit, per the house form
 * convention; only the type Select needs state, because the PKCE / client-secret
 * callout switches on it. There is no description field — `auth.oidc_clients`
 * has no column to store one.
 */
export function RegisterApplicationSheet({
  open,
  onOpenChange,
  onCreated,
}: RegisterApplicationSheetProps) {
  const { t } = useTranslation("oidc");
  const [type, setType] = useState<ClientType>("public");
  const createM = useCreateOidcClient();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg">
        <form
          className="flex h-full flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            const scopesRaw = String(data.get("scopes") ?? "openid profile email").trim();
            createM.mutate(
              {
                name: String(data.get("name") ?? "").trim(),
                type,
                redirect_uris: lines(data.get("redirect_uris")),
                post_logout_uris: lines(data.get("post_logout_uris")),
                grant_types: ["authorization_code", "refresh_token"],
                scopes: scopesRaw.split(/\s+/).filter(Boolean),
              },
              {
                onSuccess: (res) => {
                  onCreated(res.client, res.client_secret ?? "");
                  onOpenChange(false);
                },
              },
            );
          }}
        >
          <SheetHeader>
            <SheetTitle>{t("create.title")}</SheetTitle>
            <SheetDescription>{t("create.description")}</SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-4">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="name">{t("create.name")}</FieldLabel>
                <Input id="name" name="name" placeholder="My SPA" required maxLength={200} />
                <FieldDescription>{t("create.nameHelp")}</FieldDescription>
              </Field>

              <Field>
                <FieldLabel id="oidc-type-label">{t("create.type")}</FieldLabel>
                <Select value={type} onValueChange={(v) => v && setType(v as ClientType)}>
                  <SelectTrigger aria-labelledby="oidc-type-label">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">{t("create.typePublic")}</SelectItem>
                    <SelectItem value="confidential">{t("create.typeConfidential")}</SelectItem>
                  </SelectContent>
                </Select>
                <FieldDescription>
                  {type === "public"
                    ? t("create.typePublicHelp")
                    : t("create.typeConfidentialHelp")}
                </FieldDescription>
              </Field>

              <Callout
                variant="info"
                icon={<InfoIcon />}
                title={
                  type === "public"
                    ? t("create.publicCalloutTitle")
                    : t("create.confidentialCalloutTitle")
                }
              >
                {type === "public"
                  ? t("create.publicCalloutBody")
                  : t("create.confidentialCalloutBody")}
              </Callout>

              <Field>
                <FieldLabel htmlFor="redirect_uris">{t("create.redirectUris")}</FieldLabel>
                <Textarea
                  id="redirect_uris"
                  name="redirect_uris"
                  rows={3}
                  placeholder={"http://localhost:3000/callback\nhttps://app.acme.com/callback"}
                  required
                />
                <FieldDescription>{t("create.redirectUrisHelp")}</FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="post_logout_uris">{t("create.postLogoutUris")}</FieldLabel>
                <Textarea
                  id="post_logout_uris"
                  name="post_logout_uris"
                  rows={2}
                  placeholder="https://app.acme.com/"
                />
                <FieldDescription>{t("create.postLogoutUrisHelp")}</FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="scopes">{t("create.scopes")}</FieldLabel>
                <Input id="scopes" name="scopes" defaultValue="openid profile email" />
                <FieldDescription>{t("create.scopesHelp")}</FieldDescription>
              </Field>

              {createM.error && (
                <Field>
                  <FieldError>{errorMessage(createM.error)}</FieldError>
                </Field>
              )}
            </FieldGroup>
          </div>

          <SheetFooter className="flex-row justify-end gap-2 border-t">
            <SheetClose render={<Button type="button" variant="outline" />}>
              {t("common:actions.cancel")}
            </SheetClose>
            <Button type="submit" disabled={createM.isPending}>
              {createM.isPending && <Loader2Icon className="animate-spin" />}
              {createM.isPending ? t("create.submitting") : t("create.submit")}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
