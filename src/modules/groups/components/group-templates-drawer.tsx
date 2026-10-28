import { LayoutTemplateIcon, PlusIcon, SearchIcon } from "@qeetrix/icons";
import {
  Badge,
  Button,
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerFooter,
  Field,
  formatNumber,
  Link,
  Radio,
  RadioGroup,
  Textarea,
  TextField,
} from "@qeetrix/react";
import { Alert, Combobox, DataState, EmptyState } from "@qeetrix/react/experimental";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { formatLocale } from "@/i18n";
import {
  type Group,
  type GroupTemplateNode,
  useApplyGroupTemplate,
  useCreateGroupTemplate,
  useDeleteGroupTemplate,
  useGroupTemplates,
} from "@/modules/groups/api/groups";
import {
  outlineProblem,
  parseOutline,
  TEMPLATE_MAX_DEPTH,
  TEMPLATE_MAX_GROUPS,
  templateClashes,
  templateDepth,
  templateGroups,
} from "@/modules/groups/groups-io-model";
import { everyGroup, groupTree } from "@/modules/groups/groups-model";
import { ErrorReference } from "@/platform/components/error-reference";
import { ERROR_CODES } from "@/platform/errors/error-codes";
import { normalizeError } from "@/platform/errors/normalize-error";
import { errorMessage } from "@/platform/errors/user-message";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import "./group-templates-drawer.css";

const TOP = "__top__";

export type GroupTemplatesDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Every group: for "Inside" and the names already taken. */
  groups: readonly Group[];
};

/** What a template makes, as an outline: each group indented under its parent, a taken name flagged. */
function Outline({
  nodes,
  taken,
  depth = 0,
  path = "",
}: {
  nodes: readonly GroupTemplateNode[];
  taken: (name: string) => string | null | undefined;
  depth?: number;
  /** The names above these, for keys. */
  path?: string;
}) {
  const { t } = useTranslation("groups");
  return (
    <ul className={depth ? "grp-tpl-tree is-nested" : "grp-tpl-tree"}>
      {nodes.map((node) => {
        const where = taken(node.name);
        return (
          <li key={`${path}/${node.name}`}>
            <span className="grp-tpl-node">
              <span className="grp-tpl-name">{node.name}</span>
              {where !== undefined ? (
                <Badge tone="warning" size="sm">
                  {where
                    ? t("templatesDrawer.takenIn", { path: where })
                    : t("templatesDrawer.taken")}
                </Badge>
              ) : null}
            </span>
            {node.description ? <small className="grp-tpl-about">{node.description}</small> : null}
            {node.children?.length ? (
              <Outline
                nodes={node.children}
                taken={taken}
                depth={depth + 1}
                path={`${path}/${node.name}`}
              />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * New from a template: choose a template and where it goes, see every group it makes, and make them
 * at once. The server makes all or none and names are unique, so a name that's taken is flagged
 * first and the button waits. "Save a new template" swaps in the editor, which draws the outline's
 * shape as it's typed.
 */
export function GroupTemplatesDrawer({ open, onOpenChange, groups }: GroupTemplatesDrawerProps) {
  const { t } = useTranslation("groups");
  const n = (value: number) => formatNumber(value, formatLocale());
  const runSensitive = useSensitiveAction();
  const templatesQ = useGroupTemplates();
  const applyM = useApplyGroupTemplate();
  const createM = useCreateGroupTemplate();
  const deleteM = useDeleteGroupTemplate();
  const templates = templatesQ.data?.items ?? [];

  const [view, setView] = useState<"choose" | "editor">("choose");
  const [chosen, setChosen] = useState("");
  const [inside, setInside] = useState(TOP);
  const [name, setName] = useState("");
  const [about, setAbout] = useState("");
  const [outline, setOutline] = useState("");
  const [failure, setFailure] = useState<unknown>(null);
  const [nameError, setNameError] = useState<string>();

  useEffect(() => {
    if (!open) return;
    setView("choose");
    setInside(TOP);
    setFailure(null);
  }, [open]);
  const template = templates.find((tpl) => tpl.id === chosen) ?? templates[0];

  const all = useMemo(() => everyGroup(groupTree(groups)), [groups]);
  const byName = useMemo(() => new Map(all.map((g) => [g.name.trim().toLowerCase(), g])), [all]);
  // undefined: free; otherwise the path of the group that has it ("" at the top).
  const takenAt = (groupName: string) => {
    const g = byName.get(groupName.trim().toLowerCase());
    return g ? g.path.join(" › ") : undefined;
  };
  const places = [
    { value: TOP, label: t("drawer.atTheTop"), description: t("drawer.atTheTopHint") },
    ...all.map((g) => ({ value: g.id, label: [...g.path, g.name].join(" › ") })),
  ];
  const insideNode = all.find((g) => g.id === inside);
  const makes = template ? templateGroups(template.nodes).length : 0;
  const clashes = template ? templateClashes(template.nodes, groups) : [];
  const draft = parseOutline(outline);
  const problem = outlineProblem(draft);

  const close = () => onOpenChange(false);
  const apply = () => {
    if (!template || clashes.length) return;
    setFailure(null);
    applyM.mutate(
      { id: template.id, parent_id: inside === TOP ? null : inside },
      { onSuccess: close, onError: setFailure },
    );
  };
  const save = () => {
    if (!name.trim()) return setNameError(t("templatesDrawer.nameRequired"));
    if (problem) return;
    setFailure(null);
    createM.mutate(
      { name: name.trim(), description: about.trim() || undefined, nodes: draft },
      {
        onSuccess: (made) => {
          setChosen(made.id);
          setName("");
          setAbout("");
          setOutline("");
          setView("choose");
        },
        onError: (err) => {
          if (normalizeError(err).code === ERROR_CODES.GROUP_TEMPLATE_NAME_EXISTS)
            setNameError(t("templatesDrawer.nameTaken"));
          else setFailure(err);
        },
      },
    );
  };
  const remove = () => {
    if (!template) return;
    runSensitive({
      confirm: {
        title: t("templatesDrawer.deleteTitle", { name: template.name }),
        description: t("templatesDrawer.deleteDescription"),
        confirmLabel: t("templatesDrawer.deleteConfirm"),
        tone: "destructive",
      },
      actionLabel: t("templatesDrawer.deleteAction"),
      run: () => deleteM.mutateAsync(template.id),
    })
      .then(() => setChosen(""))
      .catch(settleSensitiveAction);
  };
  const busy = applyM.isPending || createM.isPending;

  return (
    <Drawer open={open} onOpenChange={(next) => (!busy || next) && onOpenChange(next)}>
      <DrawerContent
        title={view === "editor" ? t("templatesDrawer.newTitle") : t("templatesDrawer.title")}
        description={
          view === "editor" ? t("templatesDrawer.newDescription") : t("templatesDrawer.description")
        }
        size="md"
      >
        {view === "editor" ? (
          <>
            <DrawerBody>
              <form
                id="group-template"
                className="sub-form"
                noValidate
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!busy) save();
                }}
              >
                {failure ? (
                  <>
                    <Alert tone="danger" title={errorMessage(failure)} />
                    <ErrorReference error={failure} />
                  </>
                ) : null}
                <TextField
                  label={t("templatesDrawer.name")}
                  value={name}
                  onValueChange={(value) => {
                    setName(value);
                    setNameError(undefined);
                  }}
                  placeholder={t("templatesDrawer.namePlaceholder")}
                  description={nameError ? undefined : t("templatesDrawer.nameHelp")}
                  error={nameError}
                  autoComplete="off"
                />
                <Field label={t("templatesDrawer.about")} optional>
                  <Textarea rows={2} maxRows={4} value={about} onValueChange={setAbout} />
                </Field>
                <Field
                  label={t("templatesDrawer.outline")}
                  description={t("templatesDrawer.outlineHelp", {
                    depth: TEMPLATE_MAX_DEPTH,
                    size: n(TEMPLATE_MAX_GROUPS),
                  })}
                  error={
                    problem === "depth"
                      ? t("templatesDrawer.tooDeep", { depth: TEMPLATE_MAX_DEPTH })
                      : problem === "size"
                        ? t("templatesDrawer.tooMany", { size: n(TEMPLATE_MAX_GROUPS) })
                        : undefined
                  }
                >
                  <Textarea
                    className="grp-tpl-outline"
                    rows={6}
                    maxRows={14}
                    value={outline}
                    onValueChange={setOutline}
                    placeholder={t("templatesDrawer.outlinePlaceholder")}
                  />
                </Field>
                {draft.length ? (
                  <section className="grp-tpl-preview" aria-labelledby="grp-tpl-shape">
                    <h3 id="grp-tpl-shape" className="grp-tpl-title">
                      {t("templatesDrawer.shape", {
                        count: templateGroups(draft).length,
                        n: n(templateGroups(draft).length),
                        levels: n(templateDepth(draft)),
                      })}
                    </h3>
                    <Outline nodes={draft} taken={() => undefined} />
                  </section>
                ) : null}
              </form>
            </DrawerBody>
            <DrawerFooter>
              <Button variant="ghost" onClick={() => setView("choose")} disabled={busy}>
                {t("templatesDrawer.back")}
              </Button>
              <Button
                type="submit"
                form="group-template"
                loading={createM.isPending}
                disabled={!!problem}
              >
                {t("templatesDrawer.save")}
              </Button>
            </DrawerFooter>
          </>
        ) : (
          <>
            <DrawerBody>
              <DataState
                loading={templatesQ.isLoading}
                error={templatesQ.isError ? templatesQ.error : undefined}
                onRetry={() => templatesQ.refetch()}
              >
                {template ? (
                  <form
                    id="group-template-apply"
                    className="sub-form"
                    noValidate
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (!busy) apply();
                    }}
                  >
                    {failure ? (
                      <>
                        <Alert tone="danger" title={errorMessage(failure)} />
                        <ErrorReference error={failure} />
                      </>
                    ) : null}
                    <RadioGroup
                      label={t("templatesDrawer.template")}
                      variant="tile"
                      value={template.id}
                      onValueChange={(value) => setChosen(String(value))}
                    >
                      {templates.map((tpl) => (
                        <Radio
                          key={tpl.id}
                          value={tpl.id}
                          icon={LayoutTemplateIcon}
                          label={tpl.name}
                          description={[
                            t("templatesDrawer.groupCount", {
                              count: tpl.group_count,
                              n: n(tpl.group_count),
                            }),
                            tpl.description,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        />
                      ))}
                    </RadioGroup>
                    <Field
                      label={t("drawer.inside")}
                      description={
                        insideNode
                          ? t("templatesDrawer.sitInside", {
                              path: [...insideNode.path, insideNode.name].join(" › "),
                            })
                          : t("templatesDrawer.sitAtTop")
                      }
                    >
                      <Combobox
                        items={places}
                        value={inside}
                        onValueChange={(value) => setInside(value ? String(value) : TOP)}
                        icon={SearchIcon}
                        placeholder={t("drawer.insidePlaceholder")}
                      />
                    </Field>
                    <section className="grp-tpl-preview" aria-labelledby="grp-tpl-makes">
                      <div className="grp-tpl-head">
                        <h3 id="grp-tpl-makes" className="grp-tpl-title">
                          {t("templatesDrawer.makes", { count: makes, n: n(makes) })}
                        </h3>
                        <Link
                          className="grp-tpl-delete"
                          render={<button type="button" onClick={remove} />}
                        >
                          {t("templatesDrawer.delete")}
                        </Link>
                      </div>
                      <Outline nodes={template.nodes} taken={takenAt} />
                    </section>
                    {clashes.length ? (
                      <Alert
                        tone="warning"
                        title={t("templatesDrawer.clashTitle", {
                          count: clashes.length,
                          n: n(clashes.length),
                        })}
                      >
                        {t("templatesDrawer.clashDetail", {
                          names: clashes.map((c) => c.name).join(", "),
                        })}
                      </Alert>
                    ) : null}
                  </form>
                ) : (
                  <EmptyState
                    size="section"
                    icon={LayoutTemplateIcon}
                    title={t("templatesDrawer.emptyTitle")}
                    description={t("templatesDrawer.emptyDescription")}
                    actions={
                      <Button icon={PlusIcon} onClick={() => setView("editor")}>
                        {t("templatesDrawer.saveNew")}
                      </Button>
                    }
                  />
                )}
              </DataState>
            </DrawerBody>
            <DrawerFooter>
              {template ? (
                // A start slot for the footer is QTRX-23; the Users drawer's class places it.
                <Link
                  className="add-import"
                  render={<button type="button" onClick={() => setView("editor")} />}
                >
                  <PlusIcon className="add-import-icon" aria-hidden="true" />
                  {t("templatesDrawer.saveNew")}
                </Link>
              ) : null}
              <Button variant="ghost" onClick={close} disabled={busy}>
                {template ? t("drawer.cancel") : t("templatesDrawer.close")}
              </Button>
              {template ? (
                <Button
                  type="submit"
                  form="group-template-apply"
                  icon={LayoutTemplateIcon}
                  loading={applyM.isPending}
                  disabled={!!clashes.length}
                >
                  {t("templatesDrawer.make", { count: makes, n: n(makes) })}
                </Button>
              ) : null}
            </DrawerFooter>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
}
