import { Button, cn } from "@qeetrix/ui";
import { CheckIcon, CopyIcon } from "@qeetrix/icons";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

interface CodeBlockProps {
  code: string;
  lang?: string;
  className?: string;
}

/** Renders a fenced code block with a language chip and a copy button, without highlighting. */
export function CodeBlock({ code, lang, className }: CodeBlockProps) {
  const { t } = useTranslation("qeetai");
  const [copied, setCopied] = useState(false);

  const copy = useCallback(() => {
    void navigator.clipboard?.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [code]);

  return (
    <div
      className={cn(
        "group/code relative my-2 overflow-hidden rounded-lg border bg-muted/40",
        className,
      )}
    >
      <div className="flex items-center justify-between border-b bg-muted/60 px-3 py-1">
        <span className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
          {lang || t("codeBlock.code")}
        </span>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={t(copied ? "common:states.copied" : "codeBlock.copyCode")}
          title={t("codeBlock.copyCode")}
          onClick={copy}
        >
          {copied ? (
            <CheckIcon className="size-3.5 text-success" />
          ) : (
            <CopyIcon className="size-3.5" />
          )}
        </Button>
      </div>
      <pre className="overflow-x-auto p-3 text-[13px] leading-relaxed">
        <code className="font-mono">{code}</code>
      </pre>
    </div>
  );
}
