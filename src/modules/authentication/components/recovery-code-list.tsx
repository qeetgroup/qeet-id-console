import { Button } from "@qeetrix/ui";
import { CheckIcon, CopyIcon, DownloadIcon } from "@qeetrix/icons";
import { useState } from "react";

const FILE_NAME = "qeet-id-recovery-codes.txt";

/** Renders recovery codes, shown once, with copy and download. */
export function RecoveryCodeList({
  codes,
  copyLabel,
  copiedLabel,
  downloadLabel,
}: {
  codes: string[];
  copyLabel: string;
  copiedLabel: string;
  downloadLabel: string;
}) {
  const [copied, setCopied] = useState(false);

  function copy() {
    void navigator.clipboard?.writeText(codes.join("\n"));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  function download() {
    const url = URL.createObjectURL(new Blob([`${codes.join("\n")}\n`], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = FILE_NAME;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="grid grid-cols-2 gap-2 font-mono text-sm">
        {codes.map((code) => (
          <li key={code} className="rounded-md border bg-background px-3 py-2 text-center">
            {code}
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={copy}>
          {copied ? <CheckIcon /> : <CopyIcon />} {copied ? copiedLabel : copyLabel}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={download}>
          <DownloadIcon /> {downloadLabel}
        </Button>
      </div>
    </div>
  );
}
