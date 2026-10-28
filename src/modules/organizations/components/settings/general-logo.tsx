import { TrashIcon, UploadIcon } from "@qeetrix/icons";
import { Button } from "@qeetrix/react";
import { type ChangeEvent, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { errorMessage } from "@/platform/errors/user-message";
import { SensitiveActionCancelled } from "@/platform/security/sensitive-action-provider";

const LOGO_PX = 256; // shown at 88px at most; 256 stays sharp on a dense screen
const MAX_FILE_BYTES = 8 * 1024 * 1024; // the largest file accepted, before it's resized

/**
 * Fits an image into a transparent square PNG data URL. The organisation's logo is stored inline
 * (logo_url, up to 3 MB), so a picked file is resized first; PNG keeps a logo's transparency.
 */
async function fileToLogoDataUrl(file: File, size = LOGO_PX): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported");
    const scale = Math.min(size / bitmap.width, size / bitmap.height);
    const w = bitmap.width * scale;
    const h = bitmap.height * scale;
    ctx.drawImage(bitmap, (size - w) / 2, (size - h) / 2, w, h);
    return canvas.toDataURL("image/png");
  } finally {
    bitmap.close();
  }
}

/** Change logo and Remove, under the organisation's name: each saved as soon as it's chosen. */
export function LogoActions({
  hasLogo,
  onSave,
}: {
  hasLogo: boolean;
  onSave: (logoUrl: string) => Promise<unknown>;
}) {
  const { t } = useTranslation("organizations");
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<"change" | "remove" | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  async function save(logoUrl: string, kind: "change" | "remove") {
    setPending(kind);
    try {
      await onSave(logoUrl);
    } catch (err) {
      if (!(err instanceof SensitiveActionCancelled)) setFailure(errorMessage(err));
    } finally {
      setPending(null);
    }
  }

  async function pick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // so the same file can be picked again
    if (!file) return;
    setFailure(null);
    if (!file.type.startsWith("image/")) return setFailure(t("settings.general.logo.notImage"));
    if (file.size > MAX_FILE_BYTES) return setFailure(t("settings.general.logo.tooLarge"));
    let dataUrl: string;
    try {
      dataUrl = await fileToLogoDataUrl(file);
    } catch {
      return setFailure(t("settings.general.logo.unreadable"));
    }
    await save(dataUrl, "change");
  }

  return (
    <>
      <span className="account-identity-photo">
        <Button
          variant="ghost"
          size="sm"
          icon={UploadIcon}
          loading={pending === "change"}
          disabled={!!pending}
          onClick={() => fileRef.current?.click()}
        >
          {hasLogo ? t("settings.general.logo.change") : t("settings.general.logo.add")}
        </Button>
        {hasLogo && (
          <Button
            variant="ghost"
            size="sm"
            icon={TrashIcon}
            loading={pending === "remove"}
            disabled={!!pending}
            onClick={() => {
              setFailure(null);
              void save("", "remove");
            }}
          >
            {t("settings.general.logo.remove")}
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
    </>
  );
}
