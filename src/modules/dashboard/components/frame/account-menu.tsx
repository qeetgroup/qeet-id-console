import {
  ArrowLeftRightIcon,
  KeyboardIcon,
  LanguagesIcon,
  LogOutIcon,
  ShieldCheckIcon,
  UserIcon,
} from "@qeetrix/icons";
import {
  Avatar,
  Menu,
  MenuContent,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuSubmenu,
  MenuSubmenuTrigger,
  MenuTrigger,
} from "@qeetrix/react";
import { AvatarItem } from "@qeetrix/react/experimental";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { LANGUAGE_LABELS, OFFERED_LANGUAGES } from "@/i18n";
import { orgQueries } from "@/modules/organizations";
import { useLogout, useMe, useTenantId } from "@/platform/auth/session";
import { ThemeColumns } from "./theme-columns";

/**
 * The account menu: only what's personal. Switching organisation opens the sign-in picker, and
 * only shows for someone in two or more; organisation pages stay in the navigation.
 */
export function AccountMenu({ onShortcuts }: { onShortcuts: () => void }) {
  const { t, i18n } = useTranslation("dashboard");
  const me = useMe();
  const logout = useLogout();
  const tenantId = useTenantId();
  const orgs = useQuery(orgQueries.list()).data?.items ?? [];
  const current = orgs.find((org) => org.id === tenantId);
  const name = me.data?.display_name?.trim() || me.data?.email?.split("@")[0] || "";
  const language =
    OFFERED_LANGUAGES.find((lng) => lng === i18n.resolvedLanguage) ?? OFFERED_LANGUAGES[0];

  return (
    <Menu>
      <MenuTrigger
        aria-label={t("frame.accountMenu")}
        render={<button type="button" className="frame-account-trigger" />}
      >
        <Avatar name={name || "?"} src={me.data?.avatar_url ?? undefined} size="sm" decorative />
      </MenuTrigger>
      <MenuContent align="end" className="frame-account-menu">
        {me.data && (
          <>
            <div className="frame-account-who">
              <AvatarItem
                name={name}
                description={me.data.email}
                src={me.data.avatar_url ?? undefined}
              />
            </div>
            <MenuSeparator />
          </>
        )}
        {orgs.length > 1 && (
          <>
            <MenuItem
              icon={ArrowLeftRightIcon}
              description={current ? t("frame.youAreIn", { name: current.name }) : undefined}
              render={<Link to="/select-organization" />}
            >
              {t("frame.switchOrganization")}
            </MenuItem>
            <MenuSeparator />
          </>
        )}
        <MenuItem icon={UserIcon} render={<Link to="/account/profile" />}>
          {t("frame.myAccount")}
        </MenuItem>
        <MenuItem icon={ShieldCheckIcon} render={<Link to="/account/security" />}>
          {t("frame.securityAndSignIn")}
        </MenuItem>
        {OFFERED_LANGUAGES.length > 1 && (
          <MenuSubmenu>
            <MenuSubmenuTrigger icon={LanguagesIcon}>{t("frame.language")}</MenuSubmenuTrigger>
            <MenuContent>
              <MenuRadioGroup
                value={language}
                onValueChange={(lng) => void i18n.changeLanguage(String(lng))}
              >
                {OFFERED_LANGUAGES.map((lng) => (
                  <MenuRadioItem key={lng} value={lng}>
                    {LANGUAGE_LABELS[lng]}
                  </MenuRadioItem>
                ))}
              </MenuRadioGroup>
            </MenuContent>
          </MenuSubmenu>
        )}
        <MenuSeparator />
        <MenuGroup>
          <MenuGroupLabel>{t("frame.theme")}</MenuGroupLabel>
          <ThemeColumns />
        </MenuGroup>
        <MenuSeparator />
        <MenuItem icon={KeyboardIcon} shortcut="?" onClick={onShortcuts}>
          {t("frame.keyboardShortcuts")}
        </MenuItem>
        <MenuSeparator />
        <MenuItem
          icon={LogOutIcon}
          disabled={logout.isPending}
          closeOnClick={false}
          onClick={() => logout.mutate()}
        >
          {logout.isPending ? t("frame.signingOut") : t("frame.signOut")}
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
