import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Meter,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@qeetrix/ui";
import { PlayIcon } from "@qeetrix/icons";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { useAppForm } from "@/platform/forms/app-form";
import { BATCH_CAP, useBatchSimulate } from "../api/simulate";
import { DecisionBadge } from "./shared/decision-badge";

const DEFAULT_SUBJECTS = "user:alice\nuser:bob\nuser:carol";

// One subject per line as type:id; a bare id is a user.
function parseSubjects(raw: string): { type: string; id: string }[] {
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [type, ...rest] = l.split(":");
      return { type: type || "user", id: rest.join(":") };
    });
}

/**
 * Renders the batch simulation: one resource and action against many subjects, fanned out from
 * the browser to the live decision point (there is no batch endpoint).
 */
export function BatchSimulationCard() {
  const { t } = useTranslation("authorization");
  const batch = useBatchSimulate();
  const schema = useMemo(() => {
    const required = z.string().trim().min(1, t("simulator.validation.required"));
    return z.object({
      resourceType: required,
      resourceId: required,
      action: required,
      subjects: z
        .string()
        .refine((v) => parseSubjects(v).length > 0, t("simulator.validation.subjects")),
    });
  }, [t]);
  const form = useAppForm({
    defaultValues: {
      resourceType: "document",
      resourceId: "res-1",
      action: "read",
      subjects: DEFAULT_SUBJECTS,
    },
    validators: { onSubmit: schema },
    onSubmit: ({ value }) =>
      batch.run(
        parseSubjects(value.subjects),
        { type: value.resourceType.trim(), id: value.resourceId.trim() },
        value.action.trim(),
      ),
  });

  const decided = batch.results.filter((r) => !r.failed);
  const allowCount = decided.filter((r) => r.allowed).length;
  const failedCount = batch.results.length - decided.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("simulator.batch.title")}</CardTitle>
        <CardDescription>{t("simulator.batch.description", { cap: BATCH_CAP })}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <form
          className="flex flex-col gap-3"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void form.handleSubmit();
          }}
        >
          <div className="grid gap-3 lg:grid-cols-3">
            <form.AppField name="resourceType">
              {(field) => <field.TextField label={t("simulator.fields.resourceType")} required />}
            </form.AppField>
            <form.AppField name="resourceId">
              {(field) => (
                <field.TextField
                  label={t("simulator.fields.resourceId")}
                  className="font-mono text-xs"
                  required
                />
              )}
            </form.AppField>
            <form.AppField name="action">
              {(field) => <field.TextField label={t("simulator.fields.action")} required />}
            </form.AppField>
          </div>
          <form.AppField name="subjects">
            {(field) => (
              <field.TextareaField
                label={t("simulator.batch.subjects")}
                className="min-h-24 font-mono text-xs"
                required
              />
            )}
          </form.AppField>
          <div className="self-start">
            <form.AppForm>
              <form.SubmitButton icon={<PlayIcon />}>{t("simulator.batch.run")}</form.SubmitButton>
            </form.AppForm>
          </div>
        </form>
        {batch.isRunning && (
          <form.Subscribe selector={(state) => parseSubjects(state.values.subjects).length}>
            {(total) => (
              <Meter
                value={batch.progress}
                max={Math.min(total, BATCH_CAP)}
                label={t("simulator.batch.progress")}
              />
            )}
          </form.Subscribe>
        )}
        {batch.results.length > 0 && (
          <>
            <div className="flex items-center gap-2 text-sm">
              <Badge variant="success">
                {t("simulator.batch.allowCount", { count: allowCount })}
              </Badge>
              <Badge variant="destructive">
                {t("simulator.batch.denyCount", { count: decided.length - allowCount })}
              </Badge>
              {failedCount > 0 && (
                <Badge variant="outline">
                  {t("simulator.batch.failedCount", { count: failedCount })}
                </Badge>
              )}
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("simulator.batch.subject")}</TableHead>
                  <TableHead>{t("simulator.batch.decision")}</TableHead>
                  <TableHead className="text-right">{t("simulator.batch.latency")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batch.results.map((r) => {
                  const subj = r.input.subject as { type: string; id: string } | undefined;
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">
                        {subj ? `${subj.type}:${subj.id}` : "—"}
                      </TableCell>
                      <TableCell>
                        {r.failed ? (
                          <Badge variant="outline">{t("simulator.batch.failed")}</Badge>
                        ) : (
                          <DecisionBadge allowed={r.allowed} />
                        )}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {r.failed ? "—" : t("simulator.batch.ms", { count: r.durationMs })}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </>
        )}
      </CardContent>
    </Card>
  );
}
