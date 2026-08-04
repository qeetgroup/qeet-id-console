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
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from "@qeetrix/ui";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2Icon, UploadIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { toast } from "sonner";

import { LANGUAGE_LABELS, SUPPORTED_LANGUAGES, type SupportedLanguage } from "@/i18n";
import { ApiError, api } from "@/lib/api";
import { useConfirmEmailChange, useMe, useStartEmailChange } from "@/lib/auth";

export const Route = createFileRoute("/account/profile")({
  component: ProfilePage,
});

const AVATAR_PX = 192; // displayed at ≤64px; 192 keeps it crisp on retina
const MAX_FILE_BYTES = 8 * 1024 * 1024;

function initials(name: string) {
  return (
    name
      .split(/[\s@.]+/)
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

// Resize + center-crop to a square JPEG data-URL. Keeps the payload tiny
// (~15–30 KB) so it fits the inline avatar_url column without object storage.
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

function ProfilePage() {
  const { t, i18n } = useTranslation("account");
  const me = useMe();
  const fileRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState({ display_name: "" });
  // Pending locale pick; undefined = show the persisted server value. Kept as a
  // draft (not hydrated-once) so it never desyncs from the refetched profile.
  const [localeDraft, setLocaleDraft] = useState<SupportedLanguage | undefined>(undefined);
  // undefined = unchanged · string = newly picked · "" = removed
  const [avatar, setAvatar] = useState<string | undefined>(undefined);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Email-change flow state: idle → "code" (after a code is sent to the new address).
  const startEmail = useStartEmailChange();
  const confirmEmail = useConfirmEmailChange();
  const [emailStep, setEmailStep] = useState<"idle" | "code">("idle");
  const [newEmail, setNewEmail] = useState("");
  const [emailCode, setEmailCode] = useState("");

  const sendEmailCode = () => {
    startEmail.mutate(newEmail.trim(), {
      onSuccess: () => {
        setEmailStep("code");
        toast.success("Verification code sent to your new email.");
      },
      onError: (err) =>
        toast.error(err instanceof ApiError ? err.message : "Could not start the email change."),
    });
  };

  const confirmEmailChange = () => {
    confirmEmail.mutate(emailCode, {
      onSuccess: () => {
        toast.success("Your email address has been updated.");
        setEmailStep("idle");
        setNewEmail("");
        setEmailCode("");
        void me.refetch();
      },
      onError: (err) =>
        toast.error(err instanceof ApiError ? err.message : "That code is incorrect or expired."),
    });
  };

  // Hydrate the form once `me` resolves, then leave it alone so the
  // user's edits aren't blown away by background refetches.
  const hydratedRef = useState<{ done: boolean }>({ done: false })[0];
  useEffect(() => {
    if (!hydratedRef.done && me.data) {
      setDraft({ display_name: me.data.display_name ?? "" });
      hydratedRef.done = true;
    }
  }, [me.data, hydratedRef]);

  // The persisted locale (from the profile), falling back to the active UI
  // language. A pending pick (localeDraft) overrides it until the save lands.
  const savedLocale = SUPPORTED_LANGUAGES.includes(me.data?.metadata?.locale as SupportedLanguage)
    ? (me.data?.metadata?.locale as SupportedLanguage)
    : undefined;
  const effectiveLocale: SupportedLanguage =
    localeDraft ?? savedLocale ?? (i18n.resolvedLanguage as SupportedLanguage) ?? "en";

  const saveM = useMutation({
    mutationFn: (body: { display_name?: string; avatar_url?: string; locale?: string }) =>
      api<unknown>(`/v1/me`, { method: "PATCH", body }),
    onSuccess: (_data, body) => {
      setAvatar(undefined); // fall back to the freshly-fetched server value
      setLocaleDraft(undefined); // the refetched profile is now the source of truth
      // Apply the chosen language immediately so the UI reflects the save.
      if (body.locale) void i18n.changeLanguage(body.locale);
      void me.refetch();
    },
    meta: { successMessage: t("profile.toast.updated") },
  });

  const name = me.data?.display_name || me.data?.email?.split("@")[0] || "—";
  // What to show now: a pending pick wins; "" means removed → fallback.
  const shownAvatar =
    avatar !== undefined ? avatar || undefined : (me.data?.avatar_url ?? undefined);

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // let the same file be re-picked later
    if (!file) return;
    setUploadError(null);
    if (!file.type.startsWith("image/")) {
      setUploadError(t("profile.picture.errorNotImage"));
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setUploadError(t("profile.picture.errorTooLarge"));
      return;
    }
    try {
      setAvatar(await fileToAvatarDataUrl(file));
    } catch {
      setUploadError(t("profile.picture.errorProcess"));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("profile.title")}</CardTitle>
          <CardDescription>{t("profile.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          {me.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-16 rounded-full" />
              <Skeleton className="h-8 w-1/2" />
              <Skeleton className="h-8 w-1/2" />
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveM.mutate({
                  display_name: draft.display_name.trim() || undefined,
                  ...(avatar !== undefined ? { avatar_url: avatar } : {}),
                  locale: effectiveLocale,
                });
              }}
            >
              <FieldGroup>
                {/* Avatar */}
                <Field>
                  <FieldLabel>{t("profile.picture.label")}</FieldLabel>
                  <div className="flex items-center gap-4">
                    <Avatar className="size-16">
                      <AvatarImage src={shownAvatar} alt={name} />
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
                        {shownAvatar && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setUploadError(null);
                              setAvatar("");
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
                    onChange={onPickFile}
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="display_name">{t("profile.displayName")}</FieldLabel>
                  <Input
                    id="display_name"
                    value={draft.display_name}
                    onChange={(e) => setDraft((d) => ({ ...d, display_name: e.target.value }))}
                    placeholder={t("profile.displayNamePlaceholder")}
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="email">{t("profile.email")}</FieldLabel>
                  {emailStep === "idle" ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <Input
                        id="email"
                        className="max-w-xs"
                        value={me.data?.email ?? ""}
                        disabled
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setNewEmail("");
                          setEmailStep("code");
                        }}
                      >
                        {t("profile.emailChange", { defaultValue: "Change" })}
                      </Button>
                    </div>
                  ) : (
                    <div className="grid max-w-sm gap-2 rounded-md border bg-muted/30 p-3">
                      <Input
                        type="email"
                        autoComplete="email"
                        placeholder={t("profile.emailNewPlaceholder", {
                          defaultValue: "new@email.com",
                        })}
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                      />
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={sendEmailCode}
                          disabled={startEmail.isPending || !newEmail.includes("@")}
                        >
                          {startEmail.isPending && <Loader2Icon className="animate-spin" />}
                          {startEmail.isSuccess
                            ? t("profile.emailResend", { defaultValue: "Resend code" })
                            : t("profile.emailSend", { defaultValue: "Send code" })}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEmailStep("idle");
                            setEmailCode("");
                            startEmail.reset();
                          }}
                        >
                          {t("cancel", { defaultValue: "Cancel", ns: "common" })}
                        </Button>
                      </div>
                      {startEmail.isSuccess && (
                        <div className="flex items-center gap-2">
                          <Input
                            inputMode="numeric"
                            placeholder="6-digit code"
                            className="max-w-32"
                            value={emailCode}
                            onChange={(e) => setEmailCode(e.target.value)}
                          />
                          <Button
                            type="button"
                            size="sm"
                            onClick={confirmEmailChange}
                            disabled={confirmEmail.isPending || emailCode.length < 6}
                          >
                            {confirmEmail.isPending && <Loader2Icon className="animate-spin" />}
                            {t("profile.emailConfirm", { defaultValue: "Confirm" })}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                  <FieldDescription>{t("profile.emailHelp")}</FieldDescription>
                </Field>

                <Field>
                  <FieldLabel htmlFor="locale">
                    {t("profile.language", { defaultValue: "Language" })}
                  </FieldLabel>
                  <Select
                    value={effectiveLocale}
                    onValueChange={(v) => v && setLocaleDraft(v as SupportedLanguage)}
                  >
                    <SelectTrigger id="locale" className="w-full sm:w-64">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SUPPORTED_LANGUAGES.map((lng) => (
                        <SelectItem key={lng} value={lng}>
                          {LANGUAGE_LABELS[lng]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldDescription>
                    {t("profile.languageHelp", {
                      defaultValue: "Your preferred language for the console.",
                    })}
                  </FieldDescription>
                </Field>

                <Field>
                  <Button type="submit" disabled={saveM.isPending}>
                    {saveM.isPending && <Loader2Icon className="animate-spin" />}
                    {saveM.isPending ? t("profile.saving") : t("profile.save")}
                  </Button>
                </Field>
              </FieldGroup>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
