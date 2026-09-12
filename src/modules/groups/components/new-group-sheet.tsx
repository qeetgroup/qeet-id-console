import {
  Button,
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Textarea,
} from "@qeetrix/ui";
import { ChevronUpIcon, InfoIcon, Loader2Icon, SearchIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { errorMessage } from "@/platform/errors/user-message";
import { useRoles } from "@/modules/authorization";
import { type Group, useAddGroupMember, useAssignGroupRole, useCreateGroup } from "../api/groups";

type DirectoryUser = { id: string; email: string; display_name?: string | null };

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  groups: Group[];
  /** Candidates for "initial members"; the caller already has the directory loaded. */
  users: DirectoryUser[];
};

const NONE = "__none__";

export function NewGroupSheet({ open, onOpenChange, groups, users }: Props) {
  const { t } = useTranslation("groups");
  const rolesQ = useRoles();
  const createM = useCreateGroup();
  const addMemberM = useAddGroupMember();
  const assignRoleM = useAssignGroupRole();

  const [parentId, setParentId] = useState(NONE);
  const [roleId, setRoleId] = useState(NONE);
  const [optionalOpen, setOptionalOpen] = useState(true);
  const [memberQuery, setMemberQuery] = useState("");
  const [selected, setSelected] = useState<DirectoryUser[]>([]);

  const matches = memberQuery.trim()
    ? users
        .filter((u) => !selected.some((s) => s.id === u.id))
        .filter((u) =>
          `${u.email} ${u.display_name ?? ""}`.toLowerCase().includes(memberQuery.toLowerCase()),
        )
        .slice(0, 6)
    : [];

  const reset = () => {
    setParentId(NONE);
    setRoleId(NONE);
    setMemberQuery("");
    setSelected([]);
    createM.reset();
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <SheetContent side="right" className="w-full sm:max-w-md">
        <form
          className="flex h-full flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            createM.mutate(
              {
                name: String(data.get("name") ?? "").trim(),
                description: String(data.get("description") ?? "").trim() || undefined,
                parent_id: parentId === NONE ? null : parentId,
              },
              {
                onSuccess: async (group) => {
                  // Members and the role are follow-up calls: the create endpoint
                  // takes neither, and doing them here is what the form promises.
                  await Promise.allSettled([
                    ...selected.map((u) =>
                      addMemberM.mutateAsync({ groupId: group.id, userId: u.id }),
                    ),
                    ...(roleId !== NONE
                      ? [assignRoleM.mutateAsync({ groupId: group.id, roleId })]
                      : []),
                  ]);
                  reset();
                  onOpenChange(false);
                },
              },
            );
          }}
        >
          <SheetHeader>
            <SheetTitle>{t("create.title")}</SheetTitle>
            <SheetDescription>{t("create.description")}</SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-5 overflow-y-auto p-4">
            <div className="flex items-start gap-3 rounded-lg border border-sky-500/25 bg-sky-500/5 p-3">
              <InfoIcon className="mt-0.5 size-4 shrink-0 text-sky-600 dark:text-sky-400" />
              <p className="text-sm leading-5 text-muted-foreground">{t("create.info")}</p>
            </div>

            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="name">
                  {t("create.name")} <span className="text-destructive">*</span>
                </FieldLabel>
                <Input
                  id="name"
                  name="name"
                  required
                  autoComplete="off"
                  placeholder={t("create.namePlaceholder")}
                />
                <FieldDescription>{t("create.nameHelp")}</FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="description">{t("create.description_field")}</FieldLabel>
                <Textarea
                  id="description"
                  name="description"
                  rows={3}
                  placeholder={t("create.descriptionPlaceholder")}
                />
                <FieldDescription>{t("create.descriptionHelp")}</FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="parent">{t("create.parent")}</FieldLabel>
                <Select value={parentId} onValueChange={(v) => v && setParentId(v)}>
                  <SelectTrigger id="parent" aria-label={t("create.parent")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>{t("create.parentNone")}</SelectItem>
                    {groups.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldDescription>{t("create.parentHelp")}</FieldDescription>
              </Field>
            </FieldGroup>

            <div className="border-t pt-4">
              <button
                type="button"
                onClick={() => setOptionalOpen((v) => !v)}
                aria-expanded={optionalOpen}
                className="flex w-full items-center justify-between text-sm font-semibold"
              >
                {t("create.optionalSettings")}
                <ChevronUpIcon
                  className={`size-4 text-muted-foreground transition-transform ${
                    optionalOpen ? "" : "rotate-180"
                  }`}
                />
              </button>

              {optionalOpen ? (
                <FieldGroup className="mt-4">
                  <Field>
                    <FieldLabel htmlFor="role">{t("create.defaultRole")}</FieldLabel>
                    <Select value={roleId} onValueChange={(v) => v && setRoleId(v)}>
                      <SelectTrigger id="role" aria-label={t("create.defaultRole")}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>{t("create.defaultRoleNone")}</SelectItem>
                        {(rolesQ.data?.items ?? []).map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldDescription>{t("create.defaultRoleHelp")}</FieldDescription>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="members">{t("create.initialMembers")}</FieldLabel>
                    {selected.length > 0 ? (
                      <div className="mb-2 flex flex-wrap gap-1.5">
                        {selected.map((u) => (
                          <span
                            key={u.id}
                            className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs"
                          >
                            {u.display_name || u.email}
                            <button
                              type="button"
                              aria-label={`Remove ${u.email}`}
                              onClick={() =>
                                setSelected((prev) => prev.filter((s) => s.id !== u.id))
                              }
                            >
                              <XIcon className="size-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <div className="relative">
                      <SearchIcon className="pointer-events-none absolute inset-s-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="members"
                        className="ps-9"
                        value={memberQuery}
                        onChange={(e) => setMemberQuery(e.target.value)}
                        placeholder={t("create.initialMembersPlaceholder")}
                      />
                    </div>
                    {matches.length > 0 ? (
                      <ul className="mt-1 overflow-hidden rounded-md border">
                        {matches.map((u) => (
                          <li key={u.id}>
                            <button
                              type="button"
                              className="flex w-full items-center gap-2 px-3 py-2 text-start text-sm hover:bg-muted/50"
                              onClick={() => {
                                setSelected((prev) => [...prev, u]);
                                setMemberQuery("");
                              }}
                            >
                              <span className="truncate">{u.display_name || u.email}</span>
                              {u.display_name ? (
                                <span className="truncate text-xs text-muted-foreground">
                                  {u.email}
                                </span>
                              ) : null}
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <FieldDescription>{t("create.initialMembersHelp")}</FieldDescription>
                  </Field>
                </FieldGroup>
              ) : null}
            </div>

            {createM.error ? (
              <Field>
                <FieldError>{errorMessage(createM.error)}</FieldError>
              </Field>
            ) : null}
          </div>

          <SheetFooter className="flex-row justify-end gap-2 border-t">
            <SheetClose render={<Button type="button" variant="outline" />}>
              {t("create.cancel")}
            </SheetClose>
            <Button type="submit" disabled={createM.isPending}>
              {createM.isPending ? <Loader2Icon className="animate-spin" /> : null}
              {createM.isPending ? t("create.submitting") : t("create.submit")}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
