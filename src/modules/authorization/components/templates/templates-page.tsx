import { ArrowRightIcon, LayoutTemplateIcon } from "@qeetrix/icons";
import {
  Badge,
  Button,
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  Select,
  Table,
  type TableColumn,
  Text,
} from "@qeetrix/react";
import {
  CodeBlock,
  DescriptionItem,
  DescriptionList,
  EmptyState,
  FilterTags,
  PageContent,
  PageHeader,
  SearchField,
} from "@qeetrix/react/experimental";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { PageBreadcrumb, PageTabList, PageTabs } from "@/modules/dashboard";
import type { Effect } from "@/modules/authorization/api/abac";
import { setBuilderDoc } from "@/modules/authorization/store/authz-store";
import { type PolicyDoc, toDsl } from "@/modules/authorization/utils/policy-codegen";
import {
  POLICY_TEMPLATES,
  type PolicyTemplate,
  TEMPLATE_CATEGORIES,
} from "@/modules/authorization/utils/policy-template";
import { EffectWord, Two, useCount } from "../lists/authz-parts";
import "../lists/authz-lists.css";

const ANY = "";
type Category = (typeof TEMPLATE_CATEGORIES)[number];

export type TemplateFilters = { q?: string; category?: Category; effect?: Effect };

type Row = {
  template: PolicyTemplate;
  doc: PolicyDoc;
  name: string;
  description: string;
  source: string;
};

/**
 * Policies › Templates: the console's starting points for a policy (static: the server has no
 * templates). Each opens in the builder, where nothing is saved until it's saved there; one with a
 * role or relationship rule can only be tried, because ABAC can't store those (abacSaveBlocker).
 */
export function PolicyTemplatesPage({
  filters,
  onFiltersChange,
  open,
  onOpenChange,
}: {
  filters: TemplateFilters;
  onFiltersChange: (next: TemplateFilters) => void;
  /** The template whose drawer is open (`?template=<id>`). */
  open?: string;
  onOpenChange: (id: string | undefined) => void;
}) {
  const { t, i18n } = useTranslation("authorization");
  const n = useCount();
  const searchRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(filters.q ?? "");
  useEffect(() => setText(filters.q ?? ""), [filters.q]);
  const set = (patch: Partial<TemplateFilters>) => onFiltersChange({ ...filters, ...patch });

  // Built once: each build gives its condition nodes new IDs.
  const all: Row[] = useMemo(
    () =>
      POLICY_TEMPLATES.map((template) => ({
        template,
        doc: template.build(),
        name: i18n.t(template.name),
        description: i18n.t(template.description),
        source:
          "vendor" in template.source ? template.source.vendor : i18n.t(template.source.sector),
      })),
    [i18n],
  );
  const rows = useMemo(() => {
    const q = filters.q?.trim().toLowerCase();
    return all.filter(
      (r) =>
        (!filters.category || r.template.category === filters.category) &&
        (!filters.effect || r.doc.effect === filters.effect) &&
        (!q || `${r.name} ${r.description} ${r.source}`.toLowerCase().includes(q)),
    );
  }, [all, filters]);

  const appliesTo = (doc: PolicyDoc) =>
    `${!doc.resourceType || doc.resourceType === "*" ? t("lists.common.anyResource") : doc.resourceType} · ${!doc.action || doc.action === "*" ? t("lists.common.anyAction") : doc.action}`;

  const columns: TableColumn<Row>[] = [
    {
      id: "name",
      header: t("lists.templates.columns.template"),
      primary: true,
      cell: (r) => <Two main={r.name} sub={r.description} />,
    },
    {
      id: "source",
      header: t("lists.templates.columns.basedOn"),
      width: 170,
      cell: (r) => r.source,
    },
    {
      id: "effect",
      header: t("lists.templates.columns.effect"),
      width: 90,
      cell: (r) => <EffectWord effect={r.doc.effect} />,
    },
    {
      id: "on",
      header: t("lists.templates.columns.appliesTo"),
      width: 220,
      cell: (r) => <span className="authz-mono">{appliesTo(r.doc)}</span>,
    },
    {
      id: "saves",
      header: t("lists.templates.columns.canSave"),
      width: 170,
      cell: (r) => <CanSave doc={r.doc} />,
    },
  ];

  const tags = [
    ...(filters.category
      ? [
          {
            id: "category",
            label: t("lists.templates.filters.category"),
            value: t(`lists.templates.categories.${filters.category}`),
          },
        ]
      : []),
    ...(filters.effect
      ? [
          {
            id: "effect",
            label: t("lists.templates.filters.effect"),
            value: t(`lists.common.effect.${filters.effect}`),
          },
        ]
      : []),
  ];
  const openRow = open ? all.find((r) => r.template.id === open) : undefined;

  return (
    <PageTabs>
      <PageHeader
        breadcrumb={<PageBreadcrumb />}
        title={t("lists.templates.title")}
        description={t("lists.templates.description")}
        tabs={<PageTabList />}
      />
      <PageContent>
        <div className="authz-page">
          <Table<Row>
            label={t("lists.templates.tableLabel")}
            rows={rows}
            rowId={(r) => r.template.id}
            rowLabel={(r) => r.name}
            columns={columns}
            renderRowLink={(r) => (
              <Link
                to="/authorization/templates"
                search={{ ...filters, template: r.template.id }}
              />
            )}
            toolbar={
              <div className="ppl-toolbar">
                <div className="ppl-filters">
                  <SearchField
                    ref={searchRef}
                    className="ppl-search"
                    aria-label={t("lists.templates.filters.search")}
                    placeholder={t("lists.templates.filters.searchPlaceholder")}
                    value={text}
                    onValueChange={setText}
                    onSearch={(q) => set({ q: q.trim() || undefined })}
                  />
                  <Select
                    aria-label={t("lists.templates.filters.category")}
                    className="ppl-filter"
                    value={filters.category ?? ANY}
                    onValueChange={(v) =>
                      set({ category: v ? (String(v) as Category) : undefined })
                    }
                    items={[
                      { value: ANY, label: t("lists.templates.filters.anyCategory") },
                      ...TEMPLATE_CATEGORIES.map((c) => ({
                        value: c,
                        label: `${t(`lists.templates.categories.${c}`)} · ${n(all.filter((r) => r.template.category === c).length)}`,
                      })),
                    ]}
                  />
                  <Select
                    aria-label={t("lists.templates.filters.effect")}
                    className="ppl-filter"
                    value={filters.effect ?? ANY}
                    onValueChange={(v) => set({ effect: v ? (String(v) as Effect) : undefined })}
                    items={[
                      { value: ANY, label: t("lists.templates.filters.anyEffect") },
                      ...(["allow", "deny"] as const).map((e) => ({
                        value: e,
                        label: `${t(`lists.common.effect.${e}`)} · ${n(all.filter((r) => r.doc.effect === e).length)}`,
                      })),
                    ]}
                  />
                </div>
                {tags.length || filters.q ? (
                  <FilterTags
                    filters={tags}
                    onRemove={(id) => set({ [id]: undefined })}
                    onClear={() => onFiltersChange({ q: filters.q })}
                    returnFocusTo={searchRef}
                    summary={t("lists.templates.filters.summary", {
                      n: n(rows.length),
                      total: n(all.length),
                    })}
                  />
                ) : null}
              </div>
            }
            empty={
              <EmptyState
                size="section"
                icon={LayoutTemplateIcon}
                title={t("lists.common.noMatchTitle")}
                description={t("lists.common.noMatchDescription")}
                actions={
                  <Button variant="ghost" onClick={() => onFiltersChange({})}>
                    {t("lists.common.clearFilters")}
                  </Button>
                }
              />
            }
          />
        </div>
      </PageContent>
      <Drawer open={!!openRow} onOpenChange={(o) => !o && onOpenChange(undefined)}>
        {openRow ? (
          <TemplateDrawerContent row={openRow} appliesTo={appliesTo(openRow.doc)} />
        ) : null}
      </Drawer>
    </PageTabs>
  );
}

/** Whether ABAC can store it: yes, or preview only with the rule it can't. */
function CanSave({ doc }: { doc: PolicyDoc }) {
  const { t } = useTranslation("authorization");
  if (!doc.requireRole && !doc.relation) return <Text>{t("lists.templates.cells.yes")}</Text>;
  return (
    <span className="authz-two">
      <Badge size="sm" tone="warning">
        {t("lists.templates.cells.previewOnly")}
      </Badge>
      <small>
        {t(
          doc.requireRole
            ? "lists.templates.cells.needsRole"
            : "lists.templates.cells.needsRelationship",
        )}
      </small>
    </span>
  );
}

/** A template opened: what it does, and its policy as the builder writes it, before it goes there. */
function TemplateDrawerContent({ row, appliesTo }: { row: Row; appliesTo: string }) {
  const { t } = useTranslation("authorization");
  const n = useCount();
  const navigate = useNavigate();
  const { doc } = row;
  const preview = !!(doc.requireRole || doc.relation);
  const use = () => {
    setBuilderDoc(row.template.build());
    void navigate({ to: "/authorization/builder" });
  };
  return (
    <DrawerContent title={row.name} description={row.description} size="md">
      <DrawerBody>
        <div className="authz-drawer">
          <DescriptionList className="authz-facts">
            <DescriptionItem term={t("lists.templates.drawer.basedOn")}>
              {row.source}
            </DescriptionItem>
            <DescriptionItem term={t("lists.templates.drawer.effect")}>
              <EffectWord effect={doc.effect} />
            </DescriptionItem>
            <DescriptionItem term={t("lists.templates.drawer.appliesTo")}>
              <span className="authz-mono">{appliesTo}</span>
            </DescriptionItem>
            <DescriptionItem term={t("lists.templates.drawer.priority")}>
              {n(doc.priority)}
            </DescriptionItem>
          </DescriptionList>
          <CodeBlock code={toDsl(doc)} title={t("lists.templates.drawer.policy")} />
          {preview ? (
            <Text size="sm" tone="subtle" render={<p className="authz-drawer-note" />}>
              {t("lists.templates.drawer.previewNote")}
            </Text>
          ) : null}
        </div>
      </DrawerBody>
      <DrawerFooter>
        <DrawerClose render={<Button variant="ghost">{t("lists.common.cancel")}</Button>} />
        <Button icon={ArrowRightIcon} onClick={use}>
          {t("lists.templates.drawer.use")}
        </Button>
      </DrawerFooter>
    </DrawerContent>
  );
}
