import {
  PageHeader,
  RelativeTime,
  Toolbar,
  Workspace as QeetrixWorkspace,
  WorkspaceMain,
  WorkspaceOutput,
  WorkspacePane,
} from "@qeetrix/react/experimental";
import type { ReactNode } from "react";

import { formatLocale } from "@/i18n";
import { PageBreadcrumb, PageTabList } from "@/modules/dashboard";
import "./workspace.css";

/**
 * The authorization tools' one layout, on Qeetrix's Workspace. Top to bottom: the PageHeader with
 * the area's sub-pages; a Toolbar (what you're working on at the start, the tool's actions at the
 * end, the primary last); then ruled panes edge to edge: a list, the canvas with its output docked
 * under it, and an inspector. It fills the window under the top bar, and each pane scrolls on its
 * own; on a phone the panes stack and the page scrolls.
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
      <PageHeader
        breadcrumb={<PageBreadcrumb />}
        title={title}
        description={description}
        tabs={<PageTabList />}
      />
      {start || end ? <Toolbar aria-label={toolbarLabel} start={start} end={end} /> : null}
      <QeetrixWorkspace layout={layout} className="ws-body">
        {children}
      </QeetrixWorkspace>
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
  return (
    <WorkspacePane
      side={side}
      label={label}
      meta={meta}
      action={action}
      footer={footer}
      className={className}
    >
      {children}
    </WorkspacePane>
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
    <WorkspaceMain aria-label={label} output={output}>
      {children}
    </WorkspaceMain>
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
    <WorkspaceOutput
      aria-label={label}
      views={tabs}
      value={value}
      onValueChange={onValueChange}
      end={end}
    >
      {children}
    </WorkspaceOutput>
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

/** A relative time with the full date on hover (Qeetrix's RelativeTime); it keeps itself current. */
export function When({ at, now }: { at: string; now?: number }) {
  return (
    <RelativeTime
      date={Math.min(Date.parse(at), now ?? Date.now())}
      now={now}
      locale={formatLocale()}
    />
  );
}
