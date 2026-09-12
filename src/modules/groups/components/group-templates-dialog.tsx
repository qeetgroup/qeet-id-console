import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  Input,
  Textarea,
} from "@qeetrix/ui";
import { Loader2Icon, PlayIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { errorMessage } from "@/platform/errors/user-message";
import {
  type GroupTemplateNode,
  useApplyGroupTemplate,
  useCreateGroupTemplate,
  useDeleteGroupTemplate,
  useGroupTemplates,
} from "../api/groups";

/**
 * Parses the indented outline in the textarea into the tree the API expects.
 *
 * Indentation is two spaces per level. A line indented more than one level
 * below its predecessor is attached at the deepest level that exists, rather
 * than rejected — a stray space shouldn't lose someone's typing.
 */
export function parseOutline(text: string): GroupTemplateNode[] {
  const roots: GroupTemplateNode[] = [];
  // stack[d] is the node currently open at depth d.
  const stack: GroupTemplateNode[] = [];

  for (const raw of text.split("\n")) {
    if (!raw.trim()) continue;
    const indent = raw.length - raw.trimStart().length;
    const depth = Math.min(Math.floor(indent / 2), stack.length);
    const node: GroupTemplateNode = { name: raw.trim(), children: [] };

    if (depth === 0) roots.push(node);
    else {
      const parent = stack[depth - 1];
      parent.children = parent.children ?? [];
      parent.children.push(node);
    }
    stack.length = depth;
    stack.push(node);
  }
  return roots;
}

export function GroupTemplatesDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { t } = useTranslation("groups");
  const templatesQ = useGroupTemplates();
  const createM = useCreateGroupTemplate();
  const applyM = useApplyGroupTemplate();
  const deleteM = useDeleteGroupTemplate();
  const [outline, setOutline] = useState("");

  const templates = templatesQ.data?.items ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("templates.title")}</DialogTitle>
          <DialogDescription>{t("templates.description")}</DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-5 overflow-y-auto">
          {templates.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {templates.map((tpl) => (
                <li key={tpl.id} className="flex items-center gap-3 rounded-lg border p-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{tpl.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {t("templates.groupCount", { count: tpl.group_count })}
                    </span>
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={applyM.isPending}
                    onClick={() => applyM.mutate({ id: tpl.id })}
                  >
                    {applyM.isPending && applyM.variables?.id === tpl.id ? (
                      <Loader2Icon className="animate-spin" />
                    ) : (
                      <PlayIcon />
                    )}
                    {t("templates.apply")}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={t("templates.delete")}
                    disabled={deleteM.isPending}
                    onClick={() => deleteM.mutate(tpl.id)}
                  >
                    <Trash2Icon className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              {t("templates.empty")}
            </p>
          )}

          <form
            className="space-y-4 border-t pt-4"
            onSubmit={(e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              createM.mutate(
                {
                  name: String(data.get("tpl_name") ?? "").trim(),
                  nodes: parseOutline(outline),
                },
                { onSuccess: () => setOutline("") },
              );
            }}
          >
            <Field>
              <FieldLabel htmlFor="tpl_name">{t("templates.newName")}</FieldLabel>
              <Input
                id="tpl_name"
                name="tpl_name"
                required
                placeholder={t("templates.newNamePlaceholder")}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="tpl_nodes">{t("templates.newNodes")}</FieldLabel>
              <Textarea
                id="tpl_nodes"
                rows={5}
                required
                className="font-mono text-xs"
                value={outline}
                onChange={(e) => setOutline(e.target.value)}
                placeholder={t("templates.newNodesPlaceholder")}
              />
              <FieldDescription>{t("templates.newNodesHelp")}</FieldDescription>
            </Field>
            {createM.error ? (
              <Field>
                <FieldError>{errorMessage(createM.error)}</FieldError>
              </Field>
            ) : null}
            <Button type="submit" size="sm" disabled={createM.isPending}>
              {createM.isPending ? <Loader2Icon className="animate-spin" /> : null}
              {t("templates.save")}
            </Button>
          </form>
        </div>

        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>
            {t("templates.close")}
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
