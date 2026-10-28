import {
  ArrowLeftRightIcon,
  ArrowRightIcon,
  CpuIcon,
  KeyRoundIcon,
  SparklesIcon,
} from "@qeetrix/icons";
import {
  Badge,
  Button,
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  Field,
  Radio,
  RadioGroup,
  TextField,
} from "@qeetrix/react";
import { Alert, CodeBlock, Combobox } from "@qeetrix/react/experimental";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import type { User } from "@/modules/users";
import { useMe } from "@/platform/auth/session";
import { getApiBaseUrl } from "@/platform/config/api-base-url";
import { applyServerErrors, useAppForm } from "@/platform/forms/app-form";
import {
  settleSensitiveAction,
  useSensitiveAction,
} from "@/platform/security/sensitive-action-provider";
import {
  useAgentsSponsoredBy,
  useCreateAgent,
  useTransferSponsor,
} from "@/modules/developer/api/agents";
import type { MachineKind } from "@/modules/developer/machine-model";
import { fieldError, FormFailure, ScopesField } from "../form-parts";
import { personName, ShownOnceDrawer, useNumbers } from "../parts";

const TTL = ["600", "1800", "3600"] as const;
type Ttl = (typeof TTL)[number];

const options = (people: readonly User[]) =>
  people
    .filter((u) => u.status === "active")
    .map((u) => ({ value: u.id, label: personName(u) ?? u.email, description: u.email }));

/**
 * New agent: a name, its scopes (vaults included), how long its tokens last (the server allows one
 * minute to an hour) and its sponsor, the person who answers for it (you, unless you pick someone
 * else in the organisation). Its ID and secret are shown once, after it's made.
 */
export function AgentDrawer({
  open,
  onOpenChange,
  people,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  people: readonly User[];
}) {
  const { t } = useTranslation("developer");
  const me = useMe().data;
  const runSensitive = useSensitiveAction();
  const createM = useCreateAgent();
  const [made, setMade] = useState<{
    id: string;
    name: string;
    secret: string;
    ttl: number;
  } | null>(null);
  const [failure, setFailure] = useState<unknown>(null);
  const schema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(1, t("agentDrawer.nameRequired")),
        scopes: z.array(z.string()).min(1, t("agentDrawer.scopesRequired")),
        ttl: z.enum(TTL),
        sponsor: z.string().min(1, t("agentDrawer.sponsorRequired")),
      }),
    [t],
  );
  const form = useAppForm({
    defaultValues: { name: "", scopes: [] as string[], ttl: "600" as Ttl, sponsor: me?.id ?? "" },
    validators: { onSubmit: schema },
    onSubmit: async ({ value, formApi }) => {
      setFailure(null);
      await runSensitive({
        actionLabel: t("agentDrawer.stepUp"),
        run: () =>
          createM.mutateAsync({
            name: value.name.trim(),
            scopes: value.scopes,
            token_ttl_seconds: Number(value.ttl),
            sponsor_user_id: value.sponsor,
          }),
      })
        .then((res) => {
          if (!res) return;
          setMade({ id: res.id, name: res.name, secret: res.secret, ttl: res.token_ttl_seconds });
          onOpenChange(false);
        })
        .catch((err: unknown) => {
          applyServerErrors(formApi, err, { sponsor_user_id: "sponsor", token_ttl_seconds: "ttl" });
          setFailure(err);
          settleSensitiveAction(err);
        });
    },
  });

  useEffect(() => {
    if (!open) return;
    form.reset({ name: "", scopes: [], ttl: "600", sponsor: me?.id ?? "" });
    setFailure(null);
  }, [open, form, me?.id]);

  // Without the directory (no user.read), you are the only sponsor to choose.
  const sponsors = options(people);
  if (me && !sponsors.some((o) => o.value === me.id))
    sponsors.unshift({
      value: me.id,
      label: me.display_name?.trim() || me.email,
      description: me.email,
    });
  const origin = new URL(getApiBaseUrl()).origin;
  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent
          title={t("agentDrawer.title")}
          description={t("agentDrawer.description")}
          size="md"
        >
          <DrawerBody>
            <form
              id="agent-drawer"
              className="dev-form"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                void form.handleSubmit();
              }}
            >
              <FormFailure error={failure} />
              <form.Field name="name">
                {(field) => (
                  <TextField
                    label={t("agentDrawer.name")}
                    value={field.state.value}
                    onValueChange={field.handleChange}
                    onBlur={field.handleBlur}
                    placeholder={t("agentDrawer.namePlaceholder")}
                    autoComplete="off"
                    error={fieldError(field.state.meta.errors)}
                  />
                )}
              </form.Field>
              <form.Field name="scopes">
                {(field) => (
                  <ScopesField
                    value={field.state.value}
                    onChange={field.handleChange}
                    description={t("agentDrawer.scopesHelp")}
                    error={fieldError(field.state.meta.errors)}
                  />
                )}
              </form.Field>
              <form.Field name="ttl">
                {(field) => (
                  <RadioGroup
                    label={t("agentDrawer.ttl")}
                    orientation="horizontal"
                    value={field.state.value}
                    onValueChange={(v) => field.handleChange(v as Ttl)}
                  >
                    <Radio
                      value="600"
                      label={
                        <span className="dev-choice">
                          {t("agentDrawer.ttl10")}
                          <Badge tone="brand" size="sm">
                            {t("keyDrawer.recommended")}
                          </Badge>
                        </span>
                      }
                    />
                    <Radio value="1800" label={t("agentDrawer.ttl30")} />
                    <Radio value="3600" label={t("agentDrawer.ttl60")} />
                  </RadioGroup>
                )}
              </form.Field>
              <form.Field name="sponsor">
                {(field) => (
                  <Field
                    label={t("agentDrawer.sponsor")}
                    description={
                      fieldError(field.state.meta.errors) ? undefined : t("agentDrawer.sponsorHelp")
                    }
                    error={fieldError(field.state.meta.errors)}
                  >
                    <Combobox<string>
                      items={sponsors}
                      value={field.state.value || null}
                      onValueChange={(v) => field.handleChange(v ?? "")}
                      placeholder={t("agentDrawer.sponsorPlaceholder")}
                    />
                  </Field>
                )}
              </form.Field>
            </form>
          </DrawerBody>
          <DrawerFooter>
            <DrawerClose render={<Button variant="ghost">{t("drawer.cancel")}</Button>} />
            <form.Subscribe selector={(s) => s.isSubmitting}>
              {(submitting) => (
                <Button
                  type="submit"
                  form="agent-drawer"
                  icon={ArrowRightIcon}
                  loading={submitting}
                >
                  {t("agentDrawer.create")}
                </Button>
              )}
            </form.Subscribe>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <ShownOnceDrawer
        open={!!made}
        title={made?.name ?? ""}
        description={made ? t("agentDrawer.made", { count: Math.round(made.ttl / 60) }) : undefined}
        warning={t("shownOnce.secret")}
        why={t("shownOnce.hashed")}
        values={
          made
            ? [
                { label: t("agentDrawer.agentId"), value: made.id },
                { label: t("agentDrawer.secret"), value: made.secret },
              ]
            : []
        }
        onDone={() => setMade(null)}
      >
        {made ? (
          <CodeBlock
            language="shell"
            title={t("identityDrawer.getToken")}
            wrap
            code={`curl -X POST "${origin}/v1/agents/token" \\\n  -H "Content-Type: application/json" \\\n  -d '{"agent_id":"${made.id}","secret":"'"$QEET_ID_AGENT_SECRET"'"}'`}
          />
        ) : null}
      </ShownOnceDrawer>
    </>
  );
}

/**
 * Moves every agent one person sponsors to another, in one call: for a sponsor who leaves. The
 * server moves all of their agents and checks the new sponsor is in the organisation.
 */
export function TransferDrawer({
  open,
  onOpenChange,
  people,
  sponsorIds,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  people: ReadonlyMap<string, User>;
  /** The people who sponsor an agent now. */
  sponsorIds: readonly string[];
}) {
  const { t } = useTranslation("developer");
  const { n } = useNumbers();
  const runSensitive = useSensitiveAction();
  const transferM = useTransferSponsor();
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const [failure, setFailure] = useState<unknown>(null);
  const movingQ = useAgentsSponsoredBy(open ? from : null);
  const moving = movingQ.data?.items ?? [];

  useEffect(() => {
    if (!open) return;
    setFrom(null);
    setTo(null);
    setFailure(null);
  }, [open]);

  const name = (id: string | null) =>
    id ? (personName(people.get(id)) ?? t("owner.unknown")) : "";
  const fromItems = sponsorIds.map((id) => ({
    value: id,
    label: name(id),
    description: people.get(id)?.email,
  }));
  const toItems = options([...people.values()]).filter((o) => o.value !== from);
  const ready = !!from && !!to && from !== to && moving.length > 0;

  const submit = () => {
    if (!from || !to) return;
    setFailure(null);
    void runSensitive({
      actionLabel: t("transfer.stepUp"),
      run: () => transferM.mutateAsync({ fromUserId: from, toUserId: to }),
    })
      .then(() => onOpenChange(false))
      .catch((err: unknown) => {
        setFailure(err);
        settleSensitiveAction(err);
      });
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent title={t("transfer.title")} description={t("transfer.description")} size="md">
        <DrawerBody>
          <div className="dev-form">
            <FormFailure error={failure} />
            <Field label={t("transfer.from")}>
              <Combobox<string>
                items={fromItems}
                value={from}
                onValueChange={(v) => setFrom(v ?? null)}
                placeholder={t("transfer.fromPlaceholder")}
              />
            </Field>
            <Field label={t("transfer.to")} description={t("transfer.toHelp")}>
              <Combobox<string>
                items={toItems}
                value={to}
                onValueChange={(v) => setTo(v ?? null)}
                placeholder={t("transfer.toPlaceholder")}
              />
            </Field>
            {from && to && moving.length ? (
              <Alert
                tone="info"
                title={t("transfer.preview", {
                  count: moving.length,
                  n: n(moving.length),
                  name: name(to),
                })}
              >
                {t("transfer.previewList", {
                  names: moving.map((a) => a.name).join(", "),
                  name: name(to),
                })}
              </Alert>
            ) : null}
          </div>
        </DrawerBody>
        <DrawerFooter>
          <DrawerClose render={<Button variant="ghost">{t("drawer.cancel")}</Button>} />
          <Button
            icon={ArrowLeftRightIcon}
            disabled={!ready}
            loading={transferM.isPending}
            onClick={submit}
          >
            {ready
              ? t("transfer.submitN", { count: moving.length, n: n(moving.length) })
              : t("transfer.submit")}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

/** New credential, from All: what will use it decides the kind, then that kind's drawer opens. */
export function ChooseKindDrawer({
  open,
  onOpenChange,
  onChoose,
  can,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChoose: (kind: MachineKind) => void;
  can: (kind: MachineKind) => boolean;
}) {
  const { t } = useTranslation("developer");
  const [kind, setKind] = useState<MachineKind>("identity");
  useEffect(() => {
    if (open) setKind("identity");
  }, [open]);
  const ICON = { identity: CpuIcon, key: KeyRoundIcon, agent: SparklesIcon } as const;
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        title={t("chooseKind.title")}
        description={t("chooseKind.description")}
        size="md"
      >
        <DrawerBody>
          <RadioGroup
            label={t("chooseKind.label")}
            variant="tile"
            value={kind}
            onValueChange={(v) => setKind(v as MachineKind)}
          >
            {(["identity", "key", "agent"] as const).filter(can).map((k) => (
              <Radio
                key={k}
                value={k}
                icon={ICON[k]}
                label={
                  k === "identity" ? (
                    <span className="dev-choice">
                      {t("chooseKind.identity")}
                      <Badge tone="brand" size="sm">
                        {t("keyDrawer.recommended")}
                      </Badge>
                    </span>
                  ) : (
                    t(`chooseKind.${k}`)
                  )
                }
                description={t(`chooseKind.${k}Help`)}
              />
            ))}
          </RadioGroup>
        </DrawerBody>
        <DrawerFooter>
          <DrawerClose render={<Button variant="ghost">{t("drawer.cancel")}</Button>} />
          <Button icon={ArrowRightIcon} onClick={() => onChoose(kind)}>
            {t("chooseKind.continue")}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
