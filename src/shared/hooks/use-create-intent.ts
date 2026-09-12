import { useLocation, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export function parseCreateIntent(search: Record<string, unknown>): { action?: "create" } {
  return search.action === "create" ? { action: "create" } : {};
}

export function useCreateIntent(enabled: boolean) {
  const { action } = useSearch({ strict: false });
  const { pathname, searchStr, hash } = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!enabled || action !== "create") return;
    setOpen(true);
    const search = new URLSearchParams(searchStr);
    search.delete("action");
    const query = search.toString();
    void navigate({
      href: `${pathname}${query ? `?${query}` : ""}${hash ? `#${hash}` : ""}`,
      replace: true,
    });
  }, [action, enabled, hash, navigate, pathname, searchStr]);

  return [open, setOpen] as const;
}
