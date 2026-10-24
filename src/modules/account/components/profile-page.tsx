import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@qeetrix/ui";
import { UploadIcon } from "@qeetrix/icons";
import { type ChangeEvent, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { LANGUAGE_LABELS, OFFERED_LANGUAGES, type OfferedLanguage } from "@/i18n";
import { type Me, useMe } from "@/platform/auth/session";
import { DataState } from "@/platform/components/data-state";
import { applyServerErrors, FormError, useAppForm } from "@/platform/forms/app-form";
import { initials } from "@/shared/utils/initials";
import { useUpdateProfile } from "../api/profile";
import { EmailChange } from "./email-change";

const AVATAR_PX = 192; // displayed at ≤64px; 192 keeps it crisp on retina
const MAX_FILE_BYTES = 8 * 1024 * 1024; // largest pick accepted, before resizing

// Resizes and centre-crops to a square JPEG data URL, small enough (~15–30 KB) for the inline
// avatar_url column without object storage.
async function fileToAvatarDataUrl(file: File, size = AVATAR_PX): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported");
    const scale = Math.max(size / bitmap.width, size / bitmap.height);
    const dw = bitmap.width * scale;
    const dh = bitmap.height * scale;
    ctx.drawImage(bitmap, (size - dw) / 2, (size - dh) / 2, dw, dh);
    return canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    bitmap.close();
  }
}

function isOfferedLanguage(value: unknown): value is OfferedLanguage {
  return OFFERED_LANGUAGES.includes(value as OfferedLanguage);
}

/** Renders the signed-in person's profile: photo, name, language and email address. */
export function ProfilePage() {
  const { t } = useTranslation("account");
  const me = useMe();
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("profile.title")}</CardTitle>
          <CardDescription>{t("profile.description")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <DataState
            isLoading={me.isLoading}
            isError={me.isError}
            error={me.error}
            isEmpty={false}
            skeletonRows={3}
          >
            {me.data && (
              <>
                {/* Mounted once per person, so a background refetch never discards edits. */}
                <ProfileForm key={me.data.id} me={me.data} />
                <EmailChange email={me.data.email} onChanged={() => void me.refetch()} />
              </>
            )}
          </DataState>
        </CardContent>
      </Card>
    </div>
  );
}

function ProfileForm({ me }: { me: Me }) {
  const { t, i18n } = useTranslation("account");
  const saveM = useUpdateProfile();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const savedLocale = me.metadata?.locale;
  const form = useAppForm({
    defaultValues: {
      display_name: me.display_name ?? "",
      avatar_url: me.avatar_url ?? "", // "" means no photo
      locale:
        (isOfferedLanguage(savedLocale) ? savedLocale : undefined) ??
        (isOfferedLanguage(i18n.resolvedLanguage) ? i18n.resolvedLanguage : "en"),
    },
    validators: {
      onSubmit: z.object({
        display_name: z.string(),
        avatar_url: z.string(),
        locale: z.enum(OFFERED_LANGUAGES),
      }),
    },
    onSubmit: async ({ value, formApi }) => {
      const initial = formApi.options.defaultValues;
      await saveM
        .mutateAsync({
          display_name: value.display_name.trim() || undefined,
          // The photo is sent only when it changed: it can be tens of kilobytes.
          ...(value.avatar_url !== initial?.avatar_url ? { avatar_url: value.avatar_url } : {}),
          locale: value.locale,
        })
        .then(() => {
          void i18n.changeLanguage(value.locale);
          formApi.reset(value);
        })
        .catch((err: unknown) => applyServerErrors(formApi, err));
    },
  });
  const name = me.display_name || me.email?.split("@")[0] || "—";

  async function pickPhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // so the same file can be picked again
    if (!file) return;
    setUploadError(null);
    if (!file.type.startsWith("image/")) return setUploadError(t("profile.picture.errorNotImage"));
    if (file.size > MAX_FILE_BYTES) return setUploadError(t("profile.picture.errorTooLarge"));
    try {
      form.setFieldValue("avatar_url", await fileToAvatarDataUrl(file));
    } catch {
      setUploadError(t("profile.picture.errorProcess"));
    }
  }

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
    >
      <FieldGroup>
        <form.Field name="avatar_url">
          {(field) => (
            <Field>
              <FieldLabel>{t("profile.picture.label")}</FieldLabel>
              <div className="flex items-center gap-4">
                <Avatar className="size-16">
                  <AvatarImage src={field.state.value || undefined} alt={name} />
                  <AvatarFallback className="text-lg">{initials(name)}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileRef.current?.click()}
                    >
                      <UploadIcon /> {t("profile.picture.upload")}
                    </Button>
                    {field.state.value && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setUploadError(null);
                          field.handleChange("");
                        }}
                      >
                        {t("profile.picture.remove")}
                      </Button>
                    )}
                  </div>
                  <FieldDescription>{t("profile.picture.help")}</FieldDescription>
                  {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}
                </div>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={pickPhoto}
              />
            </Field>
          )}
        </form.Field>

        <form.AppField name="display_name">
          {(field) => (
            <field.TextField
              label={t("profile.displayName")}
              placeholder={t("profile.displayNamePlaceholder")}
            />
          )}
        </form.AppField>

        {/* A choice of one isn't offered. */}
        {OFFERED_LANGUAGES.length > 1 && (
          <div className="sm:w-64">
            <form.AppField name="locale">
              {(field) => (
                <field.SelectField
                  label={t("profile.language")}
                  description={t("profile.languageHelp")}
                  options={OFFERED_LANGUAGES.map((lng) => ({
                    value: lng,
                    label: LANGUAGE_LABELS[lng],
                  }))}
                />
              )}
            </form.AppField>
          </div>
        )}

        <FormError error={saveM.error} />
        <form.AppForm>
          <div>
            <form.SubmitButton requireChanges pendingLabel={t("profile.saving")}>
              {t("profile.save")}
            </form.SubmitButton>
          </div>
        </form.AppForm>
      </FieldGroup>
    </form>
  );
}
