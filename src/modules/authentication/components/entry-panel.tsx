import {
  BlocksIcon,
  CircleCheckIcon,
  CircleDotIcon,
  CircleIcon,
  FingerprintPatternIcon,
  ShieldCheckIcon,
} from "@qeetrix/icons";
import { Heading } from "@qeetrix/react";
import { useTranslation } from "react-i18next";

export type EntryStep = { title: string; text: string };

/**
 * The end side of every entry page: a passkey inside the Ember frame, the three steps of the flow
 * the page belongs to, and three facts. `current` marks progress through the steps; without it,
 * all three read as done (sign-in's "how it works").
 */
export function EntryPanel({ steps, current }: { steps: readonly EntryStep[]; current?: number }) {
  const { t } = useTranslation("auth-flow");

  return (
    <aside className="entry-panel" aria-label={t("entry.panel.label")}>
      <div className="entry-panel-body">
        <div className="entry-panel-copy">
          <Heading level={2} size="display-md">
            {t("entry.panel.title")}
          </Heading>
          <p>{t("entry.panel.text")}</p>
        </div>
        <div className="entry-mark-wrap">
          {/* A picture, not a control: hidden from assistive technology. */}
          <div className="entry-mark" aria-hidden="true">
            <span className="entry-tick" data-corner="start-top" />
            <span className="entry-tick" data-corner="end-top" />
            <span className="entry-tick" data-corner="start-bottom" />
            <span className="entry-tick" data-corner="end-bottom" />
            <FingerprintPatternIcon shape="sharp" size={132} strokeWidth={1} />
          </div>
          <ol className="entry-steps">
            {steps.map((step, index) => {
              const state =
                current === undefined || index < current
                  ? "done"
                  : index === current
                    ? "current"
                    : "next";
              const Icon =
                state === "done"
                  ? CircleCheckIcon
                  : state === "current"
                    ? CircleDotIcon
                    : CircleIcon;
              return (
                <li
                  key={step.title}
                  data-state={state}
                  aria-current={state === "current" ? "step" : undefined}
                >
                  <Icon shape="sharp" size={20} aria-hidden="true" />
                  <strong>{step.title}</strong>
                  <span>{step.text}</span>
                </li>
              );
            })}
          </ol>
        </div>
      </div>

      <div className="entry-facts">
        <div className="entry-fact">
          <FingerprintPatternIcon shape="sharp" size={20} aria-hidden="true" />
          <strong>{t("entry.facts.passkeysTitle")}</strong>
          <span>{t("entry.facts.passkeysText")}</span>
        </div>
        <div className="entry-fact">
          <ShieldCheckIcon shape="sharp" size={20} aria-hidden="true" />
          <strong>{t("entry.facts.organisationsTitle")}</strong>
          <span>{t("entry.facts.organisationsText")}</span>
        </div>
        <div className="entry-fact">
          <BlocksIcon shape="sharp" size={20} aria-hidden="true" />
          <strong>{t("entry.facts.standardsTitle")}</strong>
          <span>{t("entry.facts.standardsText")}</span>
        </div>
      </div>
    </aside>
  );
}

/** The steps each entry page shows, from the catalogue. */
export function useEntrySteps() {
  const { t } = useTranslation("auth-flow");
  return {
    signIn: [
      { title: t("entry.steps.signIn.emailTitle"), text: t("entry.steps.signIn.emailText") },
      { title: t("entry.steps.signIn.touchTitle"), text: t("entry.steps.signIn.touchText") },
      { title: t("entry.steps.signIn.inTitle"), text: t("entry.steps.signIn.inText") },
    ],
    signUp: [
      { title: t("entry.steps.signUp.identityTitle"), text: t("entry.steps.signUp.identityText") },
      { title: t("entry.steps.signUp.passkeyTitle"), text: t("entry.steps.signUp.passkeyText") },
      {
        title: t("entry.steps.signUp.organisationTitle"),
        text: t("entry.steps.signUp.organisationText"),
      },
    ],
    verify: [
      { title: t("entry.steps.verify.accountTitle"), text: t("entry.steps.verify.accountText") },
      { title: t("entry.steps.verify.verifyTitle"), text: t("entry.steps.verify.verifyText") },
      {
        title: t("entry.steps.verify.organisationTitle"),
        text: t("entry.steps.verify.organisationText"),
      },
    ],
    confirm: [
      { title: t("entry.steps.confirm.signInTitle"), text: t("entry.steps.confirm.signInText") },
      { title: t("entry.steps.confirm.confirmTitle"), text: t("entry.steps.confirm.confirmText") },
      { title: t("entry.steps.confirm.inTitle"), text: t("entry.steps.confirm.inText") },
    ],
    setup: [
      { title: t("entry.steps.setup.signInTitle"), text: t("entry.steps.setup.signInText") },
      { title: t("entry.steps.setup.setupTitle"), text: t("entry.steps.setup.setupText") },
      { title: t("entry.steps.setup.codesTitle"), text: t("entry.steps.setup.codesText") },
    ],
    organisation: [
      {
        title: t("entry.steps.organisation.signInTitle"),
        text: t("entry.steps.organisation.signInText"),
      },
      {
        title: t("entry.steps.organisation.chooseTitle"),
        text: t("entry.steps.organisation.chooseText"),
      },
      {
        title: t("entry.steps.organisation.openTitle"),
        text: t("entry.steps.organisation.openText"),
      },
    ],
    magic: [
      { title: t("entry.steps.magic.emailTitle"), text: t("entry.steps.magic.emailText") },
      { title: t("entry.steps.magic.openTitle"), text: t("entry.steps.magic.openText") },
      { title: t("entry.steps.magic.inTitle"), text: t("entry.steps.magic.inText") },
    ],
    recovery: [
      { title: t("entry.steps.recovery.emailTitle"), text: t("entry.steps.recovery.emailText") },
      {
        title: t("entry.steps.recovery.passwordTitle"),
        text: t("entry.steps.recovery.passwordText"),
      },
      {
        title: t("entry.steps.recovery.passkeyTitle"),
        text: t("entry.steps.recovery.passkeyText"),
      },
    ],
    invite: [
      { title: t("entry.steps.invite.openTitle"), text: t("entry.steps.invite.openText") },
      { title: t("entry.steps.invite.chooseTitle"), text: t("entry.steps.invite.chooseText") },
      { title: t("entry.steps.invite.joinTitle"), text: t("entry.steps.invite.joinText") },
    ],
    sso: [
      { title: t("entry.steps.sso.providerTitle"), text: t("entry.steps.sso.providerText") },
      { title: t("entry.steps.sso.returnTitle"), text: t("entry.steps.sso.returnText") },
      { title: t("entry.steps.sso.openTitle"), text: t("entry.steps.sso.openText") },
    ],
  } satisfies Record<string, EntryStep[]>;
}
