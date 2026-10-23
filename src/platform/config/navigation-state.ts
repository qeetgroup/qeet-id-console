export type NavTreeItem = {
  url: string;
  items?: { url: string }[];
};

/** Returns true only for an exact match, so sibling sections never appear active together. */
export function isNavPathActive(pathname: string, url: string): boolean {
  return pathname === url;
}

/** Returns true for the branch, its listed children and their deeper detail routes. */
export function isNavBranchActive(pathname: string, item: NavTreeItem): boolean {
  if (pathname === item.url) return true;
  return (
    item.items?.some(
      (subItem) =>
        pathname === subItem.url || (subItem.url !== "/" && pathname.startsWith(`${subItem.url}/`)),
    ) ?? false
  );
}
