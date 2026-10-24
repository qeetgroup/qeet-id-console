import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@qeetrix/ui";
import { ChevronDownIcon, LogOutIcon, QeetLogo, SettingsIcon } from "@qeetrix/icons";
import { useTranslation } from "react-i18next";

import type { Me } from "@/platform/auth/session";
import { ThemeToggle } from "@/platform/components/theme-toggle";
import { organizationImage, organizationInitials } from "../organization-selection-model";

/** Renders the selection page's top bar: the product mark, theme toggle and account menu. */
export function OrganizationSelectorHeader({
  user,
  accountName,
  disabled,
  onAccount,
  onSignOut,
}: {
  user?: Pick<Me, "email" | "avatar_url">;
  accountName: string;
  disabled: boolean;
  onAccount: () => void;
  onSignOut: () => void;
}) {
  const { t } = useTranslation("auth-flow");
  return (
    <header className="flex min-h-12 shrink-0 items-center justify-between gap-3 border-b border-border/60 bg-card/55 px-4 py-1 backdrop-blur-sm sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <span
          className="relative grid size-9 shrink-0 place-items-center rounded-lg border border-border/40 bg-muted/30"
          aria-hidden="true"
        >
          <span className="absolute opacity-100 dark:opacity-0">
            <QeetLogo height={24} />
          </span>
          <span className="absolute opacity-0 dark:opacity-100">
            <QeetLogo variant="dark" height={24} />
          </span>
        </span>
        <span className="font-heading text-sm font-semibold">Qeet ID</span>
        <span className="hidden border-s border-border/70 ps-3 text-[10px] uppercase text-muted-foreground sm:block">
          {t("organizationSelection.controlPlane")}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                className="h-auto min-h-10 max-w-52 gap-2 rounded-md px-2"
                disabled={disabled}
              />
            }
          >
            {/* Named by the visible account, then what the button opens, so the name begins with
                what a speech-input user reads. */}
            <Avatar className="size-8 shrink-0" aria-hidden="true">
              <AvatarImage src={organizationImage(user?.avatar_url)} alt="" />
              <AvatarFallback className="bg-muted text-[10px]">
                {organizationInitials(accountName)}
              </AvatarFallback>
            </Avatar>
            <span className="hidden min-w-0 text-start sm:block">
              <span className="block truncate text-xs font-medium">{accountName}</span>
              {user?.email && (
                <span className="block truncate text-[10px] text-muted-foreground">
                  {user.email}
                </span>
              )}
            </span>
            <span className="sr-only">{t("organizationSelection.accountMenu")}</span>
            <ChevronDownIcon className="size-3.5 text-muted-foreground" aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onAccount}>
              <SettingsIcon />
              {t("organizationSelection.accountSettings")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onSignOut}>
              <LogOutIcon />
              {t("organizationSelection.signOut")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
