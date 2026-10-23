import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@qeetrix/ui";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeftRightIcon,
  BuildingComplexIcon,
  EllipsisIcon,
  PencilIcon,
  TrashIcon,
  UserCheckIcon,
  UserXIcon,
} from "@qeetrix/icons";
import { useTranslation } from "react-i18next";

import { switchToTenant } from "@/modules/authentication";
import type { Org } from "../api/orgs";

export interface OrgActionHandlers {
  onEdit: (o: Org) => void;
  onToggleSuspend: (o: Org) => void;
  onDelete: (o: Org) => void;
}

export function OrgRowActions({
  org,
  isCurrent,
  canWrite,
  handlers,
}: {
  org: Org;
  isCurrent: boolean;
  canWrite: boolean;
  handlers: OrgActionHandlers;
}) {
  const { t } = useTranslation("organizations");
  const suspended = org.status === "suspended";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" aria-label={t("tenants.columns.actions")}>
            <EllipsisIcon />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="min-w-48">
        <DropdownMenuItem render={<Link to="/organizations/$orgId" params={{ orgId: org.id }} />}>
          <BuildingComplexIcon />
          {t("rowActions.open")}
        </DropdownMenuItem>
        <DropdownMenuItem disabled={isCurrent} onClick={() => void switchToTenant(org.id)}>
          <ArrowLeftRightIcon />
          {t("tenants.table.switch")}
        </DropdownMenuItem>
        {canWrite ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handlers.onEdit(org)}>
              <PencilIcon />
              {t("rowActions.edit")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handlers.onToggleSuspend(org)}>
              {suspended ? <UserCheckIcon /> : <UserXIcon />}
              {suspended ? t("rowActions.activate") : t("rowActions.suspend")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              disabled={isCurrent}
              onClick={() => handlers.onDelete(org)}
            >
              <TrashIcon />
              {t("rowActions.delete")}
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
