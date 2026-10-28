import { Badge } from "@qeetrix/react";
import { AvatarItem } from "@qeetrix/react/experimental";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";

import {
  actorTypeLabel,
  eventResult,
  formatEventTitle,
  humanizeEventType,
} from "@/modules/activity";
import type { AuditEvent } from "@/modules/security/api/audit-log";
import { actorKind, isResourceType, short } from "@/modules/security/audit-model";
import type { Person } from "../use-people";

/** A resource type's name; one the console doesn't name yet, in words. */
export function resourceLabel(t: TFunction<"security">, type: string): string {
  return isResourceType(type) ? t(`audit.resource.${type}`) : humanizeEventType(type);
}

/**
 * The event's name over its action, with its outcome when that's a failure or a refusal. The
 * list carries no severity, so the outcome is read from the action's words, as Activity does.
 */
export function EventCell({ action, flagged }: { action: string; flagged?: boolean }) {
  const { t } = useTranslation("security");
  const result = eventResult({ severity: "info", type: action });
  return (
    <span className="sec-two">
      <span className="sec-event">
        <strong>{formatEventTitle({ type: action })}</strong>
        {result === "failed" || result === "blocked" ? (
          <Badge size="sm" tone={result === "failed" ? "danger" : "warning"}>
            {t(`audit.result.${result}`)}
          </Badge>
        ) : null}
        {flagged ? (
          <Badge size="sm" tone="warning">
            {t("audit.flagged.badge")}
          </Badge>
        ) : null}
      </span>
      <small className="sec-mono">{action}</small>
    </span>
  );
}

/** Who did it: the person by name, Qeet ID itself, a machine principal, or nobody signed in. */
export function ActorName({
  event,
  people,
  inline,
}: {
  event: Pick<AuditEvent, "actor_type" | "actor_user_id">;
  people: ReadonlyMap<string, Person>;
  inline?: boolean;
}) {
  const { t } = useTranslation("security");
  const kind = actorKind(event);
  const person = event.actor_user_id ? people.get(event.actor_user_id) : undefined;
  let name: string;
  let line: string;
  if (kind === "system") {
    name = t("audit.actor.system");
    line = person ? t("audit.actor.systemFor", { name: person.name }) : t("audit.actor.systemLine");
  } else if (kind === "anonymous") {
    name = t("audit.actor.unknown");
    line = t("audit.actor.notSignedIn");
  } else if (kind === "machine") {
    name = actorTypeLabel(event.actor_type);
    line = t("audit.actor.machine");
  } else {
    name = person?.name ?? t("audit.actor.person", { id: short(event.actor_user_id) });
    line = person?.email ?? actorTypeLabel(event.actor_type);
  }
  if (inline) return <>{`${name} · ${line}`}</>;
  return (
    <AvatarItem
      name={name}
      description={line}
      shape={kind === "system" || kind === "machine" ? "square" : undefined}
    />
  );
}

/** What it was done to: a person by name, or the resource's kind over its short ID. */
export function ResourceName({
  type,
  id,
  people,
  stacked,
}: {
  type: string;
  id?: string | null;
  people: ReadonlyMap<string, Person>;
  stacked?: boolean;
}) {
  const { t } = useTranslation("security");
  const person = type === "user" && id ? people.get(id) : undefined;
  if (!stacked) return <>{person ? person.name : resourceLabel(t, type)}</>;
  return (
    <span className="sec-two">
      <span>{person ? person.name : resourceLabel(t, type)}</span>
      {id ? (
        <small className={person ? undefined : "sec-mono"}>
          {person ? t("audit.resource.personLine", { id: short(id) }) : short(id)}
        </small>
      ) : null}
    </span>
  );
}
