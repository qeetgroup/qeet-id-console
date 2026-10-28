// Library gap (new): Workspace layout parts (a toolbar, three ruled panes edge to edge, an output
// docked under the canvas), which the authorization tools and Emails need; built here from tokens.
import { formatDateTime, formatRelativeTime, Tab, Tabs, TabsList, TabsPanel } from "@qeetrix/react";
import { PageHeader } from "@qeetrix/react/experimental";
import { type ReactNode, useId } from "react";

import { formatLocale } from "@/i18n";
import { PageBreadcrumb, PageTabList, PageTabs } from "@/modules/dashboard";
import "./workspace.css";

/**
 * The authorization tools' one layout (redesign-findings §2, Workspace template). Top to bottom: the
 * PageHeader with the area's sub-pages as tabs; a toolbar (what you're working on at the start, the
 * tool's actions at the end, the primary last); then ruled panes edge to edge: a list, the canvas
 * with its output docked under it, and an inspector. It fills the window under the top bar, and
 * each pane scrolls on its own; on a phone the panes stack.
 */
export function Workspace({
  title,
  description,
  toolbarLabel,
  start,
  end,
  layout = "three",
  className,
  children,
}: {
  title: string;
  description?: ReactNode;
  /** Names the toolbar for assistive technology: "Policies". */
  toolbarLabel: string;
  start?: ReactNode;
  end?: ReactNode;
  layout?: "three" | "list-main" | "main-inspector" | "main";
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className ? `ws ${className}` : "ws"}>
      <PageTabs>
        <PageHeader
          breadcrumb={<PageBreadcrumb />}
          title={title}
          description={description}
          tabs={<PageTabList />}
        />
      </PageTabs>
      {start || end ? (
        <div className="ws-toolbar" role="toolbar" aria-label={toolbarLabel}>
          <div className="ws-toolbar-start">{start}</div>
          <div className="ws-toolbar-end">{end}</div>
        </div>
      ) : null}
      <div className="ws-body" data-layout={layout}>
        {children}
      </div>
    </div>
  );
}

/** A side pane: the list (start) or the inspector (end), with a ruled head and an optional foot. */
export function Pane({
  side,
  label,
  meta,
  action,
  footer,
  className,
  children,
}: {
  side: "list" | "inspector";
  label: string;
  meta?: ReactNode;
  action?: ReactNode;
  footer?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section
      className={className ? `ws-pane ${className}` : "ws-pane"}
      data-side={side}
      aria-labelledby={id}
    >
      <header className="ws-pane-head">
        <span className="ws-pane-label" id={id}>
          {label}
        </span>
        {meta ? <span className="ws-pane-meta">{meta}</span> : null}
        {action ? <span className="ws-pane-action">{action}</span> : null}
      </header>
      <div className="ws-pane-body">{children}</div>
      {footer ? <footer className="ws-pane-foot">{footer}</footer> : null}
    </section>
  );
}

/** The centre: the canvas, with the output docked under it. */
export function Main({
  label,
  output,
  children,
}: {
  label: string;
  output?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="ws-main" aria-label={label} data-output={output ? "" : undefined}>
      <div className="ws-canvas">{children}</div>
      {output}
    </section>
  );
}

export type OutputTab<V extends string> = { value: V; label: string; badge?: ReactNode };

/** The docked output: views of one result (a decision, the code, the trace) as line tabs. */
export function Output<V extends string>({
  label,
  tabs,
  value,
  onValueChange,
  end,
  children,
}: {
  label: string;
  tabs: readonly OutputTab<V>[];
  value: V;
  onValueChange: (value: V) => void;
  end?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Tabs value={value} onValueChange={(next) => onValueChange(next as V)} className="ws-output">
      <div className="ws-output-head">
        <TabsList activateOnFocus={false} aria-label={label}>
          {tabs.map((tab) => (
            <Tab key={tab.value} value={tab.value} badge={tab.badge}>
              {tab.label}
            </Tab>
          ))}
        </TabsList>
        {end ? <div className="ws-output-end">{end}</div> : null}
      </div>
      <TabsPanel value={value} className="ws-output-body">
        {children}
      </TabsPanel>
    </Tabs>
  );
}

/** A group label inside a pane or the canvas: label.caps, the one place capitals are allowed. */
export function GroupLabel({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <span className="ws-group-label" id={id}>
      {children}
    </span>
  );
}

/** A pane section: a group label, then its content. */
export function Section({
  label,
  children,
  className,
}: {
  label: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className ? `ws-section ${className}` : "ws-section"}>
      <GroupLabel>{label}</GroupLabel>
      {children}
    </div>
  );
}

/** A relative time with the full date on hover. */
export function When({ at, now = Date.now() }: { at: string; now?: number }) {
  const locale = formatLocale();
  return (
    <time dateTime={at} title={formatDateTime(at, locale)}>
      {formatRelativeTime(Math.min(Date.parse(at), now), locale, now)}
    </time>
  );
}
