import { useTranslation } from "react-i18next";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Skeleton,
} from "@qeetrix/ui";
import { Link } from "@tanstack/react-router";
import { initials } from "@/shared/utils/initials";
import {
  BadgeCheckIcon,
  CreditCardIcon,
  KeyRoundIcon,
  LoaderCircleIcon,
  LogOutIcon,
  ShieldCheckIcon,
  UserIcon,
} from "@qeetrix/icons";

import { useLogout, useMe, useTenantId } from "@/platform/auth/session";

export function HeaderUser() {
  const { t } = useTranslation("dashboard");
  const meQ = useMe();
  const logout = useLogout();
  const hasOrg = !!useTenantId(); // org-scoped items 403 without an org, so they're hidden

  const name = meQ.data?.display_name || meQ.data?.email?.split("@")[0] || "—";
  const email = meQ.data?.email ?? "";
  const avatarSrc = meQ.data?.avatar_url ?? undefined;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            aria-label={t("headerUser.accountMenu")}
          >
            {/* The label names the button; initials would be read as a different name. */}
            <Avatar className="size-8" aria-hidden="true">
              <AvatarImage src={avatarSrc} alt="" />
              <AvatarFallback className="text-xs">{initials(name)}</AvatarFallback>
            </Avatar>
          </Button>
        }
      />
      <DropdownMenuContent align="end" sideOffset={8} className="min-w-64 rounded-lg">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="p-0 font-normal">
            <div className="flex items-center gap-3 px-2 py-2 text-sm">
              <Avatar className="size-10">
                <AvatarImage src={avatarSrc} alt={name} />
                <AvatarFallback>{initials(name)}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 leading-tight">
                {meQ.isLoading ? (
                  <>
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="mt-1 h-3 w-32" />
                  </>
                ) : (
                  <>
                    <span className="truncate font-medium">{name}</span>
                    <span className="truncate text-xs text-muted-foreground">{email}</span>
                  </>
                )}
              </div>
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem render={<Link to="/account/profile" />}>
            <UserIcon />
            {t("headerUser.myAccount")}
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link to="/account/security" />}>
            <ShieldCheckIcon />
            {t("headerUser.securityMfa")}
          </DropdownMenuItem>
          {hasOrg && (
            <>
              <DropdownMenuItem render={<Link to="/settings/organization/general" />}>
                <BadgeCheckIcon />
                {t("headerUser.organizationSettings")}
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link to="/auth/api/keys" />}>
                <KeyRoundIcon />
                {t("headerUser.apiKeys")}
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link to="/settings/billing" />}>
                <CreditCardIcon />
                {t("headerUser.billing")}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
        >
          {logout.isPending ? <LoaderCircleIcon className="animate-spin" /> : <LogOutIcon />}
          {logout.isPending ? t("headerUser.signingOut") : t("headerUser.signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
