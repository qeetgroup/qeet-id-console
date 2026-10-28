import type { ReactNode } from "react";

/** One ruled section of an organisation's page: its heading, an action at its end, a note. */
export function OrgSection({
  id,
  title,
  action,
  note,
  children,
}: {
  id: string;
  title: string;
  action?: ReactNode;
  note?: string;
  children?: ReactNode;
}) {
  return (
    <section className="org-page-section" aria-labelledby={id}>
      <div className="org-page-head">
        <h2 id={id} className="org-page-title">
          {title}
        </h2>
        {action}
      </div>
      {note ? <p className="org-page-note">{note}</p> : null}
      {children}
    </section>
  );
}
