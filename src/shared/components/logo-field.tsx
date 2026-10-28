import {
  CircleCheckIcon,
  CloudUploadIcon,
  ImageIcon,
  LinkIcon,
  LoaderCircleIcon,
  TrashIcon,
} from "@qeetrix/icons";
import { Button, Field, IconButton, Input } from "@qeetrix/react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import "./logo-field.css";

export type LogoStatus = "empty" | "loading" | "ready" | "error";

type LogoFieldProps = {
  value: string; // a public URL or a data: URL; empty means no logo
  onChange: (next: string) => void; // a data URL after a file pick, or the typed URL
  maxSizeMB?: number; // largest accepted file, in MB; defaults to 2
  accept?: string; // accepted MIME types; defaults to all images
  disabled?: boolean;
  hint?: string;
  className?: string;
  title?: string; // heading beside the preview; defaults to "Logo set"
  subtitle?: string; // replaces the source line under the heading; `hint` goes below all
  layout?: "stacked" | "split";
  onStatusChange?: (status: LogoStatus) => void;
};

const INLINE_IMAGE = /^data:image\/(png|jpeg|gif|webp|svg\+xml);base64,/i;

// Only an http(s) URL or an uploaded image renders; anything else typed into the URL field (a
// `javascript:` URL, say) never reaches an element.
function previewSource(value: string): string | undefined {
  if (INLINE_IMAGE.test(value)) return value;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Renders a logo picker: a drop zone (clicking it or Replace opens the file dialog), or a URL. A
 * picked file becomes a data URL and a typed URL passes as typed, both through `value`. `split`
 * puts the URL beside the drop zone once the `branding` container is wide enough.
 */
export function LogoField({
  value,
  onChange,
  maxSizeMB = 2,
  accept = "image/*",
  disabled,
  hint,
  className,
  title,
  subtitle,
  layout = "stacked",
  onStatusChange,
}: LogoFieldProps) {
  const { t } = useTranslation("common");
  const [dragOver, setDragOver] = useState(false);
  const [urlOpen, setUrlOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLImageElement>(null);
  const readVersion = useRef(0);
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;
  const [imageReady, setImageReady] = useState(false);

  // Attached imperatively: the a11y lint flags any handler on <img>, though onError is a system
  // event, not a user interaction.
  useEffect(() => {
    readVersion.current += 1;
    setError(null);
    setImageReady(false);
    if (value && !previewSource(value)) {
      setError(t("logoField.errors.unsafeSource"));
      onStatusChange?.("error");
      return;
    }
    onStatusChange?.(value ? "loading" : "empty");
    const el = previewRef.current;
    if (!el) return;
    const handle = () => {
      setError(t("logoField.errors.notRenderable"));
      onStatusChange?.("error");
    };
    const loaded = () => {
      setImageReady(true);
      onStatusChange?.("ready");
    };
    el.addEventListener("error", handle);
    el.addEventListener("load", loaded);
    if (el.complete && el.naturalWidth > 0) loaded();
    return () => {
      readVersion.current += 1;
      el.removeEventListener("error", handle);
      el.removeEventListener("load", loaded);
    };
  }, [value, onStatusChange, t]);

  const maxBytes = maxSizeMB * 1024 * 1024;

  function handleFile(file: File) {
    if (disabledRef.current) return;
    setError(null);
    if (
      !file.type.startsWith("image/") ||
      (accept !== "image/*" &&
        !accept
          .split(",")
          .map((type) => type.trim())
          .includes(file.type))
    ) {
      setError(t("logoField.errors.notImage"));
      onStatusChange?.("error");
      return;
    }
    if (file.size > maxBytes) {
      setError(t("logoField.errors.tooLarge", { size: maxSizeMB }));
      onStatusChange?.("error");
      return;
    }
    const reader = new FileReader();
    const version = ++readVersion.current;
    onStatusChange?.("loading");
    reader.onload = () => {
      if (
        version === readVersion.current &&
        !disabledRef.current &&
        typeof reader.result === "string"
      )
        onChange(reader.result);
    };
    reader.onerror = () => {
      if (version !== readVersion.current || disabledRef.current) return;
      setError(t("logoField.errors.unreadable"));
      onStatusChange?.("error");
    };
    reader.readAsDataURL(file);
  }

  function openPicker() {
    if (!disabled) inputRef.current?.click();
  }

  function clearLogo() {
    readVersion.current += 1;
    onChange("");
    setError(null);
    setImageReady(false);
    onStatusChange?.("empty");
    if (inputRef.current) inputRef.current.value = "";
  }

  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept={accept}
      disabled={disabled}
      aria-label={t("logoField.uploadALogoFile")}
      className="logo-field-file"
      onChange={(event) => {
        const file = event.target.files?.[0];
        if (file) handleFile(file);
        event.target.value = "";
      }}
    />
  );

  const dropZone = (title: string, hint: string) => (
    <button
      type="button"
      disabled={disabled}
      onClick={openPicker}
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragOver(false);
        if (!disabled && event.dataTransfer.files[0]) handleFile(event.dataTransfer.files[0]);
      }}
      data-slot="logo-dropzone"
      data-drag-over={dragOver ? "" : undefined}
      className="logo-field-drop"
    >
      <ImageIcon shape="sharp" size={20} aria-hidden="true" className="logo-field-drop-icon" />
      <span className="logo-field-drop-title">{title}</span>
      <span className="logo-field-drop-hint">{hint}</span>
    </button>
  );

  const errorLine = error ? (
    <p role="alert" className="logo-field-error">
      {error}
    </p>
  ) : null;

  if (layout === "split") {
    return (
      <div className={className ? `logo-field ${className}` : "logo-field"} data-layout="split">
        <div className="logo-field-pane">
          <p className="logo-field-label">{t("logoField.logo")}</p>
          {dropZone(
            t("logoField.dropYourLogoHere"),
            t("logoField.formatsMax", { size: maxSizeMB }),
          )}
          {fileInput}
        </div>
        <div className="logo-field-pane" data-slot="logo-url">
          <Field
            label={t("logoField.orProvideALogoUrl")}
            description={hint ?? t("logoField.hint")}
            disabled={disabled}
          >
            <Input
              type="url"
              inputMode="url"
              placeholder="https://yourdomain.com/logo.png"
              value={value.startsWith("data:") ? "" : value}
              onChange={(event) => {
                readVersion.current += 1;
                onChange(event.target.value);
              }}
            />
          </Field>
          {value && (
            <>
              <p
                role="status"
                className="logo-field-status"
                data-ready={imageReady ? "" : undefined}
              >
                {imageReady ? (
                  <CircleCheckIcon shape="sharp" size={14} aria-hidden="true" />
                ) : !error ? (
                  <LoaderCircleIcon
                    shape="sharp"
                    size={14}
                    aria-hidden="true"
                    className="logo-field-spin"
                  />
                ) : null}
                {imageReady ? t("logoField.ready") : !error ? t("logoField.loading") : ""}
              </p>
              <div className="logo-field-preview">
                <img
                  ref={previewRef}
                  src={previewSource(value)}
                  alt={t("logoField.logoPreview")}
                  referrerPolicy="no-referrer"
                  className="logo-field-preview-img"
                />
                <IconButton
                  icon={TrashIcon}
                  tone="neutral"
                  aria-label={t("logoField.removeLogo")}
                  disabled={disabled}
                  onClick={clearLogo}
                />
              </div>
            </>
          )}
          {errorLine}
        </div>
      </div>
    );
  }

  const urlInput = (
    <Input
      type="url"
      inputMode="url"
      placeholder="https://example.com/logo.png"
      value={value && !value.startsWith("data:") ? value : ""}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      aria-label={t("logoField.logoUrl")}
    />
  );

  return (
    <div className={className ? `logo-field ${className}` : "logo-field"} data-layout="stacked">
      {value ? (
        <div className="logo-field-set">
          <div className="logo-field-thumb">
            <img ref={previewRef} src={previewSource(value)} alt={t("logoField.logoPreview")} />
          </div>
          <div className="logo-field-set-text">
            <p className="logo-field-set-title">{title ?? t("logoField.title")}</p>
            <p className="logo-field-set-source">
              {subtitle ?? (value.startsWith("data:") ? t("logoField.uploadedPreview") : value)}
            </p>
            <div className="logo-field-set-actions">
              <Button
                variant="soft"
                size="sm"
                icon={CloudUploadIcon}
                disabled={disabled}
                onClick={openPicker}
              >
                {t("logoField.replace")}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                icon={LinkIcon}
                disabled={disabled}
                onClick={() => setUrlOpen((v) => !v)}
                aria-expanded={urlOpen}
              >
                {t("logoField.uploadViaUrl")}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                icon={TrashIcon}
                disabled={disabled}
                onClick={clearLogo}
              >
                {t("logoField.remove")}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        dropZone(t("logoField.dropALogoHere"), t("logoField.formatsUpTo", { size: maxSizeMB }))
      )}

      {/* Offered when empty too, so a logo already at a URL needn't be re-uploaded; wrapped to
          read as one control with its input. */}
      {!value ? (
        <div data-slot="logo-url-toggle" className="logo-field-url">
          <Button
            variant="ghost"
            size="sm"
            icon={LinkIcon}
            disabled={disabled}
            onClick={() => setUrlOpen((v) => !v)}
            aria-expanded={urlOpen}
            className="logo-field-url-toggle"
          >
            {t("logoField.uploadViaUrl")}
          </Button>
          {urlOpen ? urlInput : null}
        </div>
      ) : null}

      {fileInput}

      {value && urlOpen ? urlInput : null}

      {hint && !error && <p className="logo-field-hint">{hint}</p>}
      {errorLine}
    </div>
  );
}
