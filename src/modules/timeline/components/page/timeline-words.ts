// The words for what timeline-model reads from an event: its sentence, who did it, its icon.

import {
  ActivityIcon,
  AppWindowIcon,
  ArrowLeftRightIcon,
  CircleXIcon,
  IdCardIcon,
  KeyIcon,
  KeyRoundIcon,
  LockIcon,
  LockKeyholeIcon,
  LogInIcon,
  LogOutIcon,
  MailCheckIcon,
  MailIcon,
  MonitorSmartphoneIcon,
  SendIcon,
  ShieldCheckIcon,
  SmartphoneIcon,
  TrashIcon,
  UserCheckIcon,
  UserPenIcon,
  UserPlusIcon,
  UserXIcon,
} from "@qeetrix/icons";
import type { QeetrixIcon } from "@qeetrix/react";
import type { TimelineTone } from "@qeetrix/react/experimental";
import type { TFunction } from "i18next";

import { type ActivityEvent, formatEventTitle, humanizeEventType } from "@/modules/activity";
import type { EventTitle, Who } from "@/modules/timeline/timeline-model";

/** Names the page has read: roles by id, and the people an admin acted on. */
export type Names = {
  role: (id?: string) => string | undefined;
  person: (id?: string) => string | undefined;
};

/** An event's sentence on the person's timeline. */
export function titleText(
  title: EventTitle,
  e: ActivityEvent,
  t: TFunction<"timeline">,
  names: Names,
): string {
  switch (title.kind) {
    case "signedIn":
      return title.twoStep
        ? t(`event.signedInTwoStep.${title.method}`)
        : t(`event.signedIn.${title.method}`);
    case "moved":
      return t(`event.moved.${title.method}`);
    case "signInFailed":
      return t(`event.signInFailed.${title.reason}`);
    case "accountLocked":
      return title.failures
        ? t("event.accountLockedAfter", { count: title.failures, n: title.failures })
        : t("event.accountLocked");
    case "sessionEnded":
      return t(title.idle ? "event.sessionIdle" : "event.sessionEnded");
    case "codeSent":
      return t(`event.codeSent.${title.channel}`);
    case "samlApp":
      return t("event.samlApp", { app: title.app });
    case "apiKeyCreated":
      return t("event.apiKeyCreated", { name: title.name });
    case "invited":
      return t("event.invited", { email: title.email });
    case "plain":
      return t(`event.plain.${title.key}`);
    case "about": {
      const role = names.role(title.roleId);
      if (role && (title.key === "roleAssigned" || title.key === "roleUnassigned"))
        return t(`event.aboutRole.${title.key}`, { role });
      return t(`event.about.${title.key}`);
    }
    case "toOther": {
      const name = names.person(title.personId) ?? t("event.aPerson");
      const role = names.role(title.roleId);
      if (role && (title.key === "roleAssigned" || title.key === "roleUnassigned"))
        return t(`event.toOtherRole.${title.key}`, { name, role });
      return t(`event.toOther.${title.key}`, { name });
    }
    case "other": {
      // Activity's wording where it has one; never its raw "Group Created" title.
      const words = formatEventTitle(e);
      return words === e.title ? humanizeEventType(e.type) : words;
    }
  }
}

/** Who did it, in words: the person's own name for their own events. */
export function whoText(who: Who, person: string, t: TFunction<"timeline">): string {
  if (who.kind === "self") return person;
  if (who.kind === "service") return t(`who.${who.service}`);
  return who.name ?? t("who.someone");
}

const PLAIN_ICONS: Record<Extract<EventTitle, { kind: "plain" }>["key"], QeetrixIcon> = {
  mfaChallenged: ShieldCheckIcon,
  mfaVerified: ShieldCheckIcon,
  signInConfirmed: MailCheckIcon,
  magicLinkRequested: MailIcon,
  magicLinkConsumed: MailCheckIcon,
  trustedDeviceAdded: MonitorSmartphoneIcon,
  passwordChanged: LockKeyholeIcon,
  passwordResetRequested: MailIcon,
  passwordResetConfirmed: LockKeyholeIcon,
  otherSessionsRevoked: LogOutIcon,
  totpStarted: SmartphoneIcon,
  totpEnrolled: SmartphoneIcon,
  recoveryCodeUsed: KeyIcon,
  stepUpRequired: ShieldCheckIcon,
  inviteAccepted: MailCheckIcon,
  inviteDeclined: MailIcon,
  emailVerificationStarted: MailIcon,
  emailVerified: MailCheckIcon,
  emailVerificationFailed: MailIcon,
  apiKeyRevoked: KeyRoundIcon,
};

const PERSON_ICONS: Record<Extract<EventTitle, { kind: "about" }>["key"], QeetrixIcon> = {
  created: UserPlusIcon,
  deleted: TrashIcon,
  suspended: UserXIcon,
  reactivated: UserCheckIcon,
  suspensionReviewed: UserCheckIcon,
  updated: UserPenIcon,
  passwordSet: LockKeyholeIcon,
  mfaRequiredSet: ShieldCheckIcon,
  otpFactorAdded: SmartphoneIcon,
  signedOutEverywhere: LogOutIcon,
  roleAssigned: IdCardIcon,
  roleUnassigned: IdCardIcon,
};

/** The event's icon, by what it says. */
export function iconOf(title: EventTitle): QeetrixIcon {
  switch (title.kind) {
    case "signedIn":
      return LogInIcon;
    case "moved":
      return ArrowLeftRightIcon;
    case "signInFailed":
      return CircleXIcon;
    case "accountLocked":
      return LockIcon;
    case "sessionEnded":
      return LogOutIcon;
    case "codeSent":
      return SendIcon;
    case "samlApp":
      return AppWindowIcon;
    case "apiKeyCreated":
      return KeyRoundIcon;
    case "invited":
      return MailIcon;
    case "plain":
      return PLAIN_ICONS[title.key];
    case "about":
    case "toOther":
      return PERSON_ICONS[title.key];
    case "other":
      return ActivityIcon;
  }
}

/** Failures (the server's error and critical severities) take the danger colour; the rest none. */
export const toneOf = (e: ActivityEvent): TimelineTone =>
  e.severity === "error" || e.severity === "critical" ? "danger" : "neutral";
