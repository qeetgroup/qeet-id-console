import type { QeetrixIcon } from "@qeetrix/react";
import { type ReactNode, useId } from "react";

/** One ruled section of the person's page: its heading and count, a note, an action at its end. */
export function Section({
  title,
  count,
  status,
  note,
  action,
  children,
}: {
  title: string;
  count?: ReactNode;
  status?: ReactNode;
  note?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
}) {
  const id = useId();
  return (
    <section className="prs-section" aria-labelledby={id}>
      <div className="prs-head">
        <div className="prs-head-text">
          <h2 id={id} className="prs-title">
            {title}
            {count !== undefined ? <span className="prs-count">{count}</span> : null}
            {status}
          </h2>
          {note ? <p className="prs-note">{note}</p> : null}
        </div>
        {action ? <div className="prs-head-actions">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

/** Ruled panels side by side, each one fact only this person has. */
export function Panels({ children }: { children: ReactNode }) {
  return <div className="prs-panels">{children}</div>;
}

/** One panel: what it is, its value, one sentence on what it means, and what to do about it. */
export function Panel({
  cap,
  value,
  tone,
  note,
  noteTone,
  meta,
  children,
}: {
  cap: string;
  value: ReactNode;
  tone?: "none" | "warning";
  note?: ReactNode;
  noteTone?: "warning";
  meta?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="prs-panel">
      <p className="prs-cap">{cap}</p>
      <p className={tone ? `prs-value is-${tone}` : "prs-value"}>{value}</p>
      {note ? (
        <p className={noteTone ? `prs-panel-note is-${noteTone}` : "prs-panel-note"}>{note}</p>
      ) : null}
      {children}
      {meta ? <p className="prs-panel-meta">{meta}</p> : null}
    </div>
  );
}

/** A ruled list of things the person has. */
export function Rows({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <ul className="prs-rows" aria-label={label}>
      {children}
    </ul>
  );
}

/** One thing in a list: an icon, what it is, a line about it, and its actions or when. */
export function Row({
  icon: Icon,
  name,
  badge,
  line,
  end,
}: {
  icon: QeetrixIcon;
  name: ReactNode;
  badge?: ReactNode;
  line?: ReactNode;
  end?: ReactNode;
}) {
  return (
    <li className="prs-row">
      <span className="prs-icon" aria-hidden="true">
        <Icon />
      </span>
      <span className="prs-row-text">
        <span className="prs-row-name">
          {name}
          {badge}
        </span>
        {line ? <small>{line}</small> : null}
      </span>
      {end ? <span className="prs-row-actions">{end}</span> : <span />}
    </li>
  );
}

/** Facts as label and value rows. */
export function Facts({ children }: { children: ReactNode }) {
  return <dl className="prs-facts">{children}</dl>;
}

/** One fact: what it is, its value with a line under it, and what you can do about it. */
export function Fact({
  label,
  children,
  hint,
  action,
}: {
  label: string;
  children: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="prs-fact">
      <dt>{label}</dt>
      <dd>
        <span className="prs-fact-value">{children}</span>
        {hint ? <small>{hint}</small> : null}
      </dd>
      <dd className="prs-fact-action">{action}</dd>
    </div>
  );
}
