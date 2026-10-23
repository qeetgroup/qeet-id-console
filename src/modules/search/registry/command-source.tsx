import i18n from "@/i18n";
import { commandContributions } from "@/platform/modules/registry";

import type { SearchContext, SearchItem, SearchSource } from "./types/registry.types";

/** Lists the modules' commands (from their manifests) that the person's capabilities allow. */
export function createCommandSource(): SearchSource {
  return {
    id: "commands",
    getItems(_query: string, ctx: SearchContext): SearchItem[] {
      return commandContributions()
        .filter((def) => def.capability === undefined || ctx.capabilities.has(def.capability))
        .map(
          (def): SearchItem => ({
            id: def.id,
            kind: "command",
            category: i18n.t("search:category.commands"),
            title: i18n.t(`${def.text}.title`),
            subtitle: i18n.t(`${def.text}.subtitle`),
            icon: def.icon,
            // Translated, so people can search in their own language.
            keywords: i18n
              .t(`${def.text}.keywords`)
              .split(",")
              .map((word) => word.trim()),
            capability: def.capability,
            run: ({ navigate }) => navigate(def.to),
          }),
        );
    },
  };
}
