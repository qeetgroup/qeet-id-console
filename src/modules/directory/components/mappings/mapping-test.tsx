import { PlayIcon } from "@qeetrix/icons";
import { Badge, Button, Field, Heading, Text, Textarea } from "@qeetrix/react";
import { Alert, DescriptionItem, DescriptionList } from "@qeetrix/react/experimental";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { DirectoryMapping, MappingPreview } from "@/modules/directory/api/directory";
import { usePreviewDirectoryMappings } from "@/modules/directory/api/mapping-actions";
import { parseMappingSource } from "@/modules/directory/directory-model";
import {
  type ConnectionKind,
  effectiveProfile,
  exampleEntry,
  type LdapAttributes,
  TARGETS,
  unmappedKeys,
} from "@/modules/directory/mappings-model";
import { errorMessage } from "@/platform/errors/user-message";
import { issueText } from "./mapping-fields";
import { Section } from "./mapping-parts";

type Run = {
  text: string;
  signature: string;
  entry: Record<string, unknown>;
  result: MappingPreview;
};

const shown = (value: unknown) =>
  typeof value === "string"
    ? value
    : Array.isArray(value)
      ? value.join(", ")
      : JSON.stringify(value);

/**
 * Test with a directory entry: the server applies the saved mappings to one pasted entry and
 * returns the profile they make, and anything that would refuse it (the preview only computes;
 * nothing is saved). The email and name a sign-in takes when nothing maps them are added here,
 * as the server's preview leaves them out (a server gap).
 */
export function MappingTest({
  connectionId,
  kind,
  ldap,
  mappings,
}: {
  connectionId: string;
  kind: ConnectionKind;
  ldap?: LdapAttributes;
  mappings: readonly DirectoryMapping[];
}) {
  const { t } = useTranslation("directory");
  const preview = usePreviewDirectoryMappings(connectionId);
  const [text, setText] = useState(() => exampleEntry(kind, ldap));
  const [invalid, setInvalid] = useState(false);
  const [last, setLast] = useState<Run | null>(null);
  const signature = mappings.map((m) => `${m.id}:${m.version}`).join("|");
  const stale = !!last && (last.text !== text || last.signature !== signature);

  function run() {
    let entry: Record<string, unknown>;
    try {
      entry = parseMappingSource(text);
    } catch {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    preview.mutate(entry, {
      onSuccess: (result) => setLast({ text, signature, entry, result }),
    });
  }

  const profile = last ? effectiveProfile(kind, last.entry, last.result.profile, ldap) : {};
  const filled = TARGETS.filter((target) => profile[target] != null && profile[target] !== "");
  const empty = TARGETS.filter((target) => !filled.includes(target));
  const unmapped = last ? unmappedKeys(kind, last.entry, mappings, ldap) : [];

  return (
    <Section
      title={t("mappings.test.title")}
      description={t("mappings.test.description")}
      action={
        <Button variant="soft" icon={PlayIcon} loading={preview.isPending} onClick={run}>
          {t("mappings.test.run")}
        </Button>
      }
    >
      <div className="map-test">
        {/* Library gap: an editable code field (findings §5); a Textarea set in the code face. */}
        <Field
          label={t("mappings.test.entry")}
          error={invalid ? t("mappings.test.invalid") : undefined}
        >
          <Textarea
            className="map-entry"
            rows={9}
            maxRows={18}
            value={text}
            spellCheck={false}
            onValueChange={(value) => {
              setText(value);
              setInvalid(false);
            }}
          />
        </Field>
        {preview.isError ? <Alert tone="danger" title={errorMessage(preview.error)} /> : null}
        {last ? (
          <section className="map-result" aria-live="polite">
            <div className="map-result-head">
              <Heading level={3} size="title-sm">
                {t("mappings.test.result")}
              </Heading>
              {last.result.valid ? (
                <Badge tone="success" size="sm">
                  {t("mappings.test.valid")}
                </Badge>
              ) : (
                <Badge tone="danger" size="sm">
                  {t("mappings.test.refused", {
                    count: last.result.issues.length,
                    n: last.result.issues.length,
                  })}
                </Badge>
              )}
            </div>
            {stale ? (
              <Text size="sm" tone="subtle">
                {t("mappings.test.stale")}
              </Text>
            ) : null}
            {!last.result.valid ? (
              <Alert tone="danger" title={t("mappings.test.refusedHint")}>
                <ul className="map-issues">
                  {last.result.issues.map((issue) => (
                    <li key={`${issue.mapping_id}:${issue.field}:${issue.code}`}>
                      {issue.field && TARGETS.some((x) => x === issue.field)
                        ? `${t(`mappings.fields.names.${issue.field as (typeof TARGETS)[number]}`)}: `
                        : ""}
                      {issueText(issue.code)}
                    </li>
                  ))}
                </ul>
              </Alert>
            ) : null}
            <DescriptionList>
              {filled.map((target) => (
                <DescriptionItem key={target} term={t(`mappings.fields.names.${target}`)}>
                  {shown(profile[target])}
                  {last.result.profile[target] == null ? (
                    <span className="map-from"> · {t("mappings.test.fromSettings")}</span>
                  ) : null}
                </DescriptionItem>
              ))}
              {empty.length ? (
                <DescriptionItem
                  term={empty.map((target) => t(`mappings.fields.names.${target}`)).join(", ")}
                >
                  <span className="map-none">{t("mappings.test.empty")}</span>
                </DescriptionItem>
              ) : null}
            </DescriptionList>
            {unmapped.length ? (
              <Text size="sm" tone="subtle">
                {t("mappings.test.unmapped")} <code>{unmapped.join(", ")}</code>
              </Text>
            ) : null}
          </section>
        ) : null}
      </div>
    </Section>
  );
}
