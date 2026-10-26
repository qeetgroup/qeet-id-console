import { TrashIcon, UploadIcon } from "@qeetrix/icons";
import { Avatar, Badge, Button, formatRelativeTime, Heading, TextField } from "@qeetrix/react";
import { CopyButton } from "@qeetrix/react/experimental";
import { Link } from "@tanstack/react-router";
import { type ChangeEvent, type FormEvent, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import {
  sessionCountry,
  sessionDevice,
  useEligibleOrganizations,
  useSessions,
} from "@/modules/authentication";
import { type Me, useMe, useSessionId, useTenantId, useUserId } from "@/platform/auth/session";
import { errorMessage } from "@/platform/errors/user-message";
import { useUpdateProfile } from "../api/profile";
import { Detail, EditingDetail, Failure, LoadFailed, Loading, Section } from "./account-parts";
import { EmailChange } from "./email-change";

const AVATAR_PX = 192; // displayed at ≤88px; 192 keeps it crisp on retina
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

const nameOf = (me: Me) => me.display_name?.trim() || me.email.split("@")[0] || me.email;

/**
 * The signed-in person's profile: who they are first (photo, name, email), then the facts others
 * see, each changed where it sits, then what's useful to know about the account itself.
 */
export function ProfilePage() {
  const me = useMe();
  if (!me.data) {
    return me.isError ? (
      <LoadFailed error={me.error} onRetry={() => void me.refetch()} />
    ) : (
      <Loading rows={3} />
    );
  }
  return (
    <>
      <Identity me={me.data} />
      {/* Mounted once per person, so a background refetch never discards an edit. */}
      <PersonalDetails key={me.data.id} me={me.data} onEmailChanged={() => void me.refetch()} />
      <AboutAccount me={me.data} />
    </>
  );
}

/** The photo, name and email at the top, and the way to change the photo: saved as it's picked. */
function Identity({ me }: { me: Me }) {
  const { t } = useTranslation("account");
  const save = useUpdateProfile();
  const fileRef = useRef<HTMLInputElement>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const name = nameOf(me);
  const saveAvatar = (avatar_url: string) =>
    save.mutate({ avatar_url }, { onError: (err) => setFailure(errorMessage(err)) });

  async function pick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // so the same file can be picked again
    if (!file) return;
    setFailure(null);
    if (!file.type.startsWith("image/")) return setFailure(t("profile.photo.notImage"));
    if (file.size > MAX_FILE_BYTES) return setFailure(t("profile.photo.tooLarge"));
    try {
      saveAvatar(await fileToAvatarDataUrl(file));
    } catch {
      setFailure(t("profile.photo.unreadable"));
    }
  }

  return (
    <div className="account-identity">
      <div className="account-identity-inner">
        <Avatar name={name} src={me.avatar_url || undefined} size="xl" decorative />
        <div className="account-identity-text">
          <Heading level={2} size="heading-md">
            {name}
          </Heading>
          <span className="account-identity-mail">
            {me.email}
            {me.email_verified_at && (
              <Badge tone="success" size="sm">
                {t("profile.verified")}
              </Badge>
            )}
          </span>
          <span className="account-identity-photo">
            <Button
              variant="ghost"
              size="sm"
              icon={UploadIcon}
              loading={save.isPending}
              onClick={() => fileRef.current?.click()}
            >
              {me.avatar_url ? t("profile.photo.change") : t("profile.photo.upload")}
            </Button>
            {me.avatar_url && (
              <Button
                variant="ghost"
                size="sm"
                icon={TrashIcon}
                disabled={save.isPending}
                onClick={() => {
                  setFailure(null);
                  saveAvatar("");
                }}
              >
                {t("profile.photo.remove")}
              </Button>
            )}
          </span>
          {failure && (
            <span role="alert" className="account-note">
              {failure}
            </span>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            hidden
            tabIndex={-1}
            aria-hidden="true"
            onChange={(event) => void pick(event)}
          />
        </div>
      </div>
    </div>
  );
}

/** The name others see and the address you sign in with, each changed in place. */
function PersonalDetails({ me, onEmailChanged }: { me: Me; onEmailChanged: () => void }) {
  const { t } = useTranslation("account");
  const [editing, setEditing] = useState<"name" | "email" | null>(null);
  return (
    <Section title={t("profile.details.title")} description={t("profile.details.description")}>
      <dl className="account-details">
        {editing === "name" ? (
          <NameEditor me={me} onDone={() => setEditing(null)} />
        ) : (
          <Detail
            label={t("profile.details.name")}
            hint={t("profile.details.nameHint")}
            action={
              <Button variant="ghost" onClick={() => setEditing("name")}>
                {t("profile.details.edit")}
              </Button>
            }
          >
            {me.display_name?.trim() || t("profile.details.noName")}
          </Detail>
        )}
        {editing === "email" ? (
          <EmailChange
            current={me.email}
            onClose={() => setEditing(null)}
            onChanged={() => {
              setEditing(null);
              onEmailChanged();
            }}
          />
        ) : (
          <Detail
            label={t("profile.details.email")}
            hint={t("profile.details.emailHint")}
            action={
              <Button variant="ghost" onClick={() => setEditing("email")}>
                {t("profile.details.change")}
              </Button>
            }
          >
            {me.email}
          </Detail>
        )}
      </dl>
    </Section>
  );
}

function NameEditor({ me, onDone }: { me: Me; onDone: () => void }) {
  const { t } = useTranslation("account");
  const save = useUpdateProfile();
  const [name, setName] = useState(me.display_name ?? "");
  const [error, setError] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    setFailure(null);
    const display_name = name.trim();
    if (!display_name) return setError(t("profile.details.nameRequired"));
    if (display_name === (me.display_name ?? "").trim()) return onDone();
    save.mutate(
      { display_name },
      { onSuccess: onDone, onError: (err) => setFailure(errorMessage(err)) },
    );
  }

  return (
    <EditingDetail
      label={t("profile.details.name")}
      buttons={
        <>
          <Button variant="ghost" size="lg" disabled={save.isPending} onClick={onDone}>
            {t("cancel")}
          </Button>
          <Button size="lg" type="submit" form="account-name" loading={save.isPending}>
            {t("save")}
          </Button>
        </>
      }
    >
      <form id="account-name" noValidate onSubmit={submit}>
        <TextField
          label={t("profile.details.name")}
          hideLabel
          autoComplete="name"
          maxLength={120}
          autoFocus
          value={name}
          error={error ?? undefined}
          invalid={Boolean(error)}
          disabled={save.isPending}
          onChange={(event) => {
            setName(event.target.value);
            setError(null);
          }}
        />
        {failure && <Failure>{failure}</Failure>}
      </form>
    </EditingDetail>
  );
}

/** Facts about the account itself: where you belong, this sign-in, its age and its ID. */
function AboutAccount({ me }: { me: Me }) {
  const { t } = useTranslation("account");
  const tenantId = useTenantId();
  const sessionId = useSessionId();
  const eligible = useEligibleOrganizations(useUserId());
  const organizations = eligible.data ?? [];
  const open = organizations.find((organization) => organization.id === tenantId);
  const here = useSessions().data?.items.find(
    (session) => session.current || session.id === sessionId,
  );
  const locale = formatLocale();
  const country = here ? sessionCountry(here, locale) : "";

  return (
    <Section title={t("profile.about.title")}>
      <dl className="account-details">
        {eligible.isSuccess && organizations.length === 0 && (
          <Detail
            label={t("profile.about.organisations")}
            hint={t("profile.about.noneHint")}
            action={
              <Button variant="ghost" render={<Link to="/select-organization" />}>
                {t("profile.about.choose")}
              </Button>
            }
          >
            {t("profile.about.none")}
          </Detail>
        )}
        {organizations.length > 0 && (
          <Detail
            label={t("profile.about.organisations")}
            hint={open ? t("profile.about.openNow", { name: open.name }) : undefined}
            action={
              organizations.length > 1 && (
                <Button variant="ghost" render={<Link to="/select-organization" />}>
                  {t("profile.about.switch")}
                </Button>
              )
            }
          >
            {t("profile.about.memberOf", { count: organizations.length })}
          </Detail>
        )}
        {here && (
          <Detail
            label={t("profile.about.thisSignIn")}
            hint={
              country
                ? t("profile.about.deviceIn", { device: sessionDevice(here), country })
                : sessionDevice(here)
            }
            action={
              <Button variant="ghost" render={<Link to="/account/sessions" />}>
                {t("profile.about.seeSessions")}
              </Button>
            }
          >
            {formatRelativeTime(new Date(here.created_at), locale)}
          </Detail>
        )}
        {me.created_at && (
          <Detail label={t("profile.about.memberSince")}>
            {new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(new Date(me.created_at))}
          </Detail>
        )}
        <Detail
          label={t("profile.about.accountId")}
          hint={t("profile.about.accountIdHint")}
          action={
            <CopyButton value={me.id} label={t("profile.about.copyIdLabel")}>
              {t("profile.about.copyId")}
            </CopyButton>
          }
        >
          <span className="account-mono">{me.id}</span>
        </Detail>
      </dl>
    </Section>
  );
}
