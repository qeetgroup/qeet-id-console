import {
  type IconProps,
  KeyRoundIcon,
  LinkIcon,
  MailIcon,
  ShieldCheckIcon,
  UserRoundPlusIcon,
} from "@qeetrix/icons";
import { Badge, Select } from "@qeetrix/react";
import type { ComponentType } from "react";
import { useTranslation } from "react-i18next";

import type { EmailTemplate } from "@/modules/organizations/api/email-templates";

const KNOWN = ["verify_email", "password_reset", "magic_link", "invite", "mfa_otp"] as const;
type KnownKey = (typeof KNOWN)[number];
const isKnown = (key: string): key is KnownKey => (KNOWN as readonly string[]).includes(key);

/**
 * A template's name and what it's for, in the console's words: the server's catalogue is English
 * developer text ("a tenant"), so the five it has are worded here; another shows as it comes.
 */
export function useTemplateText() {
  const { t } = useTranslation("organizations");
  return (item: EmailTemplate) =>
    isKnown(item.key)
      ? {
          name: t(`emails.catalogue.${item.key}.name`),
          description: t(`emails.catalogue.${item.key}.description`),
        }
      : { name: item.name, description: item.description };
}

const ICONS: Record<string, ComponentType<IconProps<"outline">>> = {
  verify_email: MailIcon,
  password_reset: KeyRoundIcon,
  magic_link: LinkIcon,
  invite: UserRoundPlusIcon,
  mfa_otp: ShieldCheckIcon,
};

/**
 * The templates in a column, as My account lists its pages: the open one carries the Ember bar,
 * each says whether it's customised or has unsaved changes. On a phone the column becomes a
 * picker above the editor.
 */
export function EmailTemplateList({
  templates,
  selectedKey,
  dirtyKeys,
  disabled,
  onSelect,
}: {
  templates: EmailTemplate[];
  selectedKey: string;
  dirtyKeys: string[];
  disabled: boolean;
  onSelect: (key: string) => void;
}) {
  const { t } = useTranslation("organizations");
  const text = useTemplateText();
  return (
    <nav aria-label={t("emails.list")} className="mail-nav">
      <Select
        className="mail-picker"
        aria-label={t("emails.picker")}
        value={selectedKey}
        disabled={disabled}
        onValueChange={(key) => key && onSelect(key)}
        items={templates.map((item) => ({ value: item.key, label: text(item).name }))}
      />
      <ul className="mail-list">
        {templates.map((item) => {
          const Icon = ICONS[item.key] ?? MailIcon;
          const current = item.key === selectedKey;
          return (
            <li key={item.key}>
              <button
                type="button"
                aria-current={current ? "true" : undefined}
                disabled={disabled && !current}
                onClick={() => onSelect(item.key)}
              >
                <span className="account-icon" aria-hidden="true">
                  <Icon />
                </span>
                <span>
                  <strong className="mail-list-name">
                    {text(item).name}
                    {dirtyKeys.includes(item.key) ? (
                      <Badge tone="brand" size="sm">
                        {t("emails.unsaved")}
                      </Badge>
                    ) : item.custom ? (
                      <Badge tone="neutral" size="sm">
                        {t("emails.custom")}
                      </Badge>
                    ) : null}
                  </strong>
                  <small>{text(item).description}</small>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
