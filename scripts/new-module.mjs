#!/usr/bin/env node
// Creates a console module from the template below and registers it: `bun run new-module reports`.
// The result is a working page at /<id> with its route, manifest (a sidebar entry), translations,
// data hook and test; everything else about the module stays inside src/modules/<id>/.

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const pascal = (id) => id.replace(/(^|-)([a-z])/g, (_, __, c) => c.toUpperCase());
const camel = (id) => pascal(id).replace(/^./, (c) => c.toLowerCase());
const title = (id) => id.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase());

/** Returns the template's files for module `id`, keyed by their path under src/modules/<id>. */
export function moduleFiles(id) {
  const P = pascal(id);
  const c = camel(id);
  return {
    "index.ts": `// Public API of the ${id} module: what other modules may import.
export { ${c}Keys } from "./api/keys";
export { ${c}Queries } from "./api/${id}";
`,
    "pages.ts": `// The ${id} pages, for routes only; see src/modules/users/pages.ts.
export { ${P}Page } from "./components/${id}-page";
`,
    "manifest.tsx": `// What this module adds to the console shell; see src/platform/modules/manifest.ts.
import { LayoutGridIcon } from "@qeetrix/icons";

import { defineModule } from "@/platform/modules/manifest";

export const manifest = defineModule({
  id: "${id}",
  nav: [
    {
      id: "overview.${c}",
      group: "overview",
      order: 100,
      title: "${id}:nav.title",
      url: "/${id}",
      icon: <LayoutGridIcon />,
      // Add the capability its route requires, once the backend has a permission for it.
    },
  ],
});

// Types its translation keys from the English catalogue (src/i18n/index.ts has the platform's).
declare module "i18next" {
  interface ResourceNamespaceMap {
    "${id}": typeof import("./locales/en/${id}.json");
  }
}
`,
    "api/keys.ts": `// Every ${id} query key sits under ["${id}", tenantId]; see src/modules/users/api/keys.ts.
export const ${c}Keys = {
  all: ["${id}"] as const, // every tenant
  tenant: (tenantId: string | null) => ["${id}", tenantId] as const,
  list: (tenantId: string | null) => [...${c}Keys.tenant(tenantId), "list"] as const,
};
`,
    [`api/${id}.ts`]: `import { queryOptions, useQuery } from "@tanstack/react-query";

import { api } from "@/platform/api/client";
import { useTenantId } from "@/platform/auth/session";

import { ${c}Keys } from "./keys";

export interface ${P}Item {
  id: string;
  name: string;
}

export const ${c}Queries = {
  list: (tenantId: string | null) =>
    queryOptions({
      queryKey: ${c}Keys.list(tenantId),
      queryFn: () => api<{ items: ${P}Item[] }>(\`/v1/tenants/\${tenantId}/${id}\`),
      enabled: !!tenantId,
    }),
};

export function use${P}() {
  return useQuery(${c}Queries.list(useTenantId()));
}
`,
    [`components/${id}-page.tsx`]: `import { LayoutGridIcon } from "@qeetrix/icons";
import { Table, type TableColumn } from "@qeetrix/react";
import { DataState, EmptyState, PageContent, PageHeader } from "@qeetrix/react/experimental";
import { useTranslation } from "react-i18next";

import { PageBreadcrumb } from "@/modules/dashboard";

import { use${P}, type ${P}Item } from "../api/${id}";

/** The ${id} list: the library PageHeader and Table, token-only CSS (see a rebuilt list page). */
export function ${P}Page() {
  const { t } = useTranslation("${id}");
  const listQ = use${P}();
  const items = listQ.data?.items ?? [];
  const columns: TableColumn<${P}Item>[] = [
    { id: "name", header: t("page.name"), cell: (item) => item.name },
  ];

  return (
    <>
      <PageHeader
        breadcrumb={<PageBreadcrumb />}
        title={t("page.title")}
        description={t("page.description")}
      />
      <PageContent>
        {listQ.isError ? (
          <DataState error={listQ.error} onRetry={() => listQ.refetch()} />
        ) : (
          <Table<${P}Item>
            label={t("page.title")}
            rows={items}
            rowId={(item) => item.id}
            rowLabel={(item) => item.name}
            columns={columns}
            loading={listQ.isLoading}
            empty={<EmptyState icon={LayoutGridIcon} title={t("page.empty")} />}
          />
        )}
      </PageContent>
    </>
  );
}
`,
    [`routes/app/${id}.tsx`]: `import { createFileRoute } from "@tanstack/react-router";

import { ${P}Page } from "@/modules/${id}/pages";

export const Route = createFileRoute("/_app/${id}")({
  component: ${P}Page,
});
`,
    [`locales/en/${id}.json`]: `${JSON.stringify(
      {
        nav: { title: title(id) },
        page: {
          title: title(id),
          description: `Everything about ${title(id).toLowerCase()} in this organisation.`,
          name: "Name",
          empty: `No ${title(id).toLowerCase()} yet.`,
        },
      },
      null,
      2,
    )}
`,
    [`__tests__/${id}-page.test.tsx`]: `// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/platform/api/client", () => ({
  api: vi.fn(async () => ({ items: [{ id: "1", name: "First" }] })),
}));
vi.mock("@/platform/auth/session", () => ({ useTenantId: () => "tenant-1" }));
vi.mock("@/platform/components/page-header", () => ({
  PageHeader: ({ title }: { title?: string }) => <h1>{title}</h1>,
}));

import { ${P}Page } from "../components/${id}-page";

afterEach(cleanup);

describe("${P}Page", () => {
  it("lists the organization's ${title(id).toLowerCase()}", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <${P}Page />
      </QueryClientProvider>,
    );
    expect(await screen.findByText("First")).toBeTruthy();
  });
});
`,
  };
}

/** Adds `id` to src/app/modules.ts, the module list; returns null when it was already there. */
export function registerModuleId(source, id) {
  if (source.includes(`  "${id}",\n`)) return null;
  return source.replace("] as const;", `  "${id}",\n] as const;`);
}

function main() {
  const id = process.argv[2];
  if (!id || !/^[a-z][a-z0-9-]*$/.test(id)) {
    console.error("Usage: bun run new-module <id>   (lower-case, e.g. reports or audit-exports)");
    process.exit(1);
  }
  const root = join(process.cwd(), "src/modules", id);
  if (existsSync(root)) {
    console.error(`src/modules/${id} already exists.`);
    process.exit(1);
  }
  for (const [path, content] of Object.entries(moduleFiles(id))) {
    const file = join(root, path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content);
  }
  const listPath = join(process.cwd(), "src/app/modules.ts");
  const next = registerModuleId(readFileSync(listPath, "utf8"), id);
  if (next) writeFileSync(listPath, next);
  // A long id can push a template line past the line width; the formatter settles it.
  spawnSync(join(process.cwd(), "node_modules/.bin/biome"), ["format", "--write", root], {
    stdio: "inherit",
  });
  console.log(`Created src/modules/${id} and registered it in src/app/modules.ts.
Next: run \`bun run dev\` (or build) to regenerate the route tree, then open /${id}.`);
}

if (process.argv[1]?.endsWith("new-module.mjs")) main();
