import { Button, cn, Input } from "@qeetrix/ui";
import {
  CheckCircle2Icon,
  ImageIcon,
  LinkIcon,
  Loader2Icon,
  Trash2Icon,
  UploadCloudIcon,
} from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

export type LogoStatus = "empty" | "loading" | "ready" | "error";

type LogoFieldProps = {
  /** Current logo source — a public URL or a data: URL. Empty = no logo. */
  value: string;
  /** Emits the new value: a data URL after a file pick, or the typed URL. */
  onChange: (next: string) => void;
  /** Max file size in MB before the pick is rejected. Defaults to 2. */
  maxSizeMB?: number;
  /** Accepted MIME types for the file input. Defaults to all images. */
  accept?: string;
  disabled?: boolean;
  hint?: string;
  className?: string;
  /** Heading shown beside the preview. Defaults to "Logo set". */
  title?: string;
  /**
   * Replaces the line under the heading, which otherwise shows the current
   * source. Distinct from `hint`, which sits below the whole control.
   */
  subtitle?: string;
  layout?: "stacked" | "split";
  onStatusChange?: (status: LogoStatus) => void;
};

/**
 * Console-local logo picker. Replaces `@qeetrix/ui`'s `LogoUploader`, whose
 * drop-zone doesn't open the file dialog on click (the hidden <input> has no
 * label association). Here the dropzone and the Replace button both call the
 * file input's `.click()` directly, so clicking always opens the picker.
 *
 * Both input paths share the one `value` slot — a file becomes a data URL via
 * FileReader; a pasted URL is emitted verbatim — so callers treat them the same.
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
  const id = useId();
  const [dragOver, setDragOver] = useState(false);
  const [urlOpen, setUrlOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLImageElement>(null);
  const readVersion = useRef(0);
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;
  const [imageReady, setImageReady] = useState(false);

  // Attach error listener imperatively to avoid jsx-a11y/no-noninteractive-element-interactions
  // (onError on <img> is a system event, not a user interaction, but the rule flags all handlers)
  useEffect(() => {
    readVersion.current += 1;
    setError(null);
    setImageReady(false);
    onStatusChange?.(value ? "loading" : "empty");
    const el = previewRef.current;
    if (!el) return;
    const handle = () => {
      setError("Couldn't render that source as an image.");
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
  }, [value, onStatusChange]);

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
      setError("That doesn't look like an image file.");
      onStatusChange?.("error");
      return;
    }
    if (file.size > maxBytes) {
      setError(`File is larger than ${maxSizeMB} MB.`);
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
      setError("Couldn't read that file.");
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

  if (layout === "split") {
    return (
      <div className={cn("grid min-w-0 gap-4 @min-[650px]/branding:grid-cols-2", className)}>
        <div className="min-w-0">
          <p className="mb-1.5 text-xs font-medium">Logo</p>
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
            className={cn(
              "flex min-h-26 w-full cursor-pointer flex-col items-center justify-center gap-1.5 rounded-md border border-dashed px-3 py-3 text-center transition-colors hover:border-primary/60 hover:bg-primary/3 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50",
              dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/40 bg-muted/10",
            )}
          >
            <ImageIcon className="mb-1 size-5 text-muted-foreground" aria-hidden="true" />
            <span className="text-xs font-medium">Drop your logo here or click to upload</span>
            <span className="text-[10px] leading-4 text-muted-foreground">
              PNG, JPG, SVG, or WEBP (max {maxSizeMB} MB)
            </span>
          </button>
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            disabled={disabled}
            aria-label="Upload a logo file"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) handleFile(file);
              event.target.value = "";
            }}
          />
        </div>
        <div className="min-w-0 @min-[650px]/branding:border-s @min-[650px]/branding:border-border/60 @min-[650px]/branding:ps-4">
          <label htmlFor={`${id}-url`} className="mb-1.5 block text-xs font-medium">
            Or provide a logo URL
          </label>
          <Input
            id={`${id}-url`}
            type="url"
            inputMode="url"
            placeholder="https://yourdomain.com/logo.png"
            value={value.startsWith("data:") ? "" : value}
            disabled={disabled}
            onChange={(event) => {
              readVersion.current += 1;
              onChange(event.target.value);
            }}
            className="h-8 rounded-md bg-muted/15 text-xs pointer-coarse:min-h-11 pointer-coarse:text-base"
          />
          <p className="mt-1.5 text-[10px] leading-4 text-muted-foreground">
            {hint ?? "Use a clear logo with a transparent background."}
          </p>
          {value && (
            <>
              <p
                role="status"
                className={cn(
                  "mt-2 flex items-center gap-1.5 text-[10px]",
                  imageReady ? "text-success" : "text-muted-foreground",
                )}
              >
                {imageReady ? (
                  <CheckCircle2Icon className="size-3" aria-hidden="true" />
                ) : !error ? (
                  <Loader2Icon className="size-3 animate-spin" aria-hidden="true" />
                ) : null}
                {imageReady ? "Logo ready" : !error ? "Loading logo" : ""}
              </p>
              <div className="mt-2 flex min-h-10 min-w-0 items-center justify-between gap-3">
                <img
                  ref={previewRef}
                  src={value}
                  alt="Logo preview"
                  referrerPolicy="no-referrer"
                  className="h-9 w-auto max-w-40 object-contain"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-8 shrink-0 rounded-md pointer-coarse:min-h-11 pointer-coarse:min-w-11"
                  aria-label="Remove logo"
                  title="Remove logo"
                  disabled={disabled}
                  onClick={clearLogo}
                >
                  <Trash2Icon className="size-3.5" />
                </Button>
              </div>
            </>
          )}
          {error && (
            <p role="alert" className="mt-2 text-xs text-destructive">
              {error}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {value ? (
        <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3">
          <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-background">
            <img
              ref={previewRef}
              src={value}
              alt="Logo preview"
              className="h-full w-full object-contain"
            />
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <p className="text-sm font-medium">{title ?? "Logo set"}</p>
            <p className="line-clamp-1 text-xs text-muted-foreground">
              {subtitle ?? (value.startsWith("data:") ? "Uploaded file (preview)" : value)}
            </p>
            <div className="mt-1 flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled}
                onClick={openPicker}
              >
                <UploadCloudIcon /> Replace
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={disabled}
                onClick={clearLogo}
              >
                <Trash2Icon /> Remove
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled}
                onClick={() => setUrlOpen((v) => !v)}
                aria-expanded={urlOpen}
              >
                <LinkIcon /> Upload via URL
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={openPicker}
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled) setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (disabled) return;
            const file = e.dataTransfer.files[0];
            if (file) handleFile(file);
          }}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition-colors",
            dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/30",
            disabled && "pointer-events-none opacity-50",
          )}
        >
          <ImageIcon className="size-6 text-muted-foreground" />
          <span className="text-sm font-medium">Drop a logo here or click to upload</span>
          <span className="text-xs text-muted-foreground">
            PNG, JPG, SVG, or WEBP up to {maxSizeMB} MB
          </span>
        </button>
      )}

      {/* Offered in the empty state too: without it, a logo that already lives
          at a URL would have to be downloaded and re-uploaded. */}
      {!value ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          disabled={disabled}
          onClick={() => setUrlOpen((v) => !v)}
          aria-expanded={urlOpen}
        >
          <LinkIcon /> Upload via URL
        </Button>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        disabled={disabled}
        aria-label="Upload a logo file"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />

      {urlOpen ? (
        <Input
          type="url"
          inputMode="url"
          placeholder="https://example.com/logo.png"
          value={value && !value.startsWith("data:") ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          aria-label="Logo URL"
        />
      ) : null}

      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
