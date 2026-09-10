import { Card, Key, Logout, RefreshArrow, ShieldTick, User, Verify } from "@qeetrix/icons";
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

import { useLogout, useMe, useTenantId } from "@/platform/auth/session";

export function HeaderUser() {
  const meQ = useMe();
  const logout = useLogout();
  // Org-scoped destinations 403 without a selected organization. Hide them for
  // an org-less user so the menu never dead-ends (they see only self-service).
  const hasOrg = !!useTenantId();

  const name = meQ.data?.display_name || meQ.data?.email?.split("@")[0] || "—";
  const email = meQ.data?.email ?? "";
  const avatarSrc = meQ.data?.avatar_url ?? undefined;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" className="rounded-full" aria-label="Account menu">
            <Avatar className="size-8">
              <AvatarImage src={avatarSrc} alt={name} />
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
            <User />
            My account
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link to="/account/security" />}>
            <ShieldTick />
            Security & MFA
          </DropdownMenuItem>
          {hasOrg && (
            <>
              <DropdownMenuItem render={<Link to="/settings/organization/general" />}>
                <Verify />
                Organization settings
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link to="/auth/api/keys" />}>
                <Key />
                API Keys
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link to="/settings/billing" />}>
                <Card />
                Billing
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
          {logout.isPending ? <RefreshArrow className="animate-spin" /> : <Logout />}
          {logout.isPending ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
