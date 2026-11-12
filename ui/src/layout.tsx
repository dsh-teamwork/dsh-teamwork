import type { ReactNode } from 'react';
import { Button, type Tone } from './controls.js';
import { UIRoot } from './root.js';

/**
 * A full-height screen: a header, optional navigation (usually `Tabs`) and a
 * scrolling body. It is the `UIRoot`, so a screen needs nothing around it.
 */
export function Panel({ header, nav, children, label }: {
  header?: ReactNode;
  nav?: ReactNode;
  children: ReactNode;
  /** Accessible name of the region. */
  label: string;
}) {
  return (
    <UIRoot className="twui-panel" role="region" aria-label={label}>
      {header && <header className="twui-panel-header">{header}</header>}
      {nav && <div className="twui-panel-nav">{nav}</div>}
      <div className="twui-panel-body">{children}</div>
    </UIRoot>
  );
}

/**
 * One entry in a list: title and subtitle, a description, tags, actions on the
 * right, an optional notice under them (why an action is unavailable), and an
 * optional body below a divider (details, a confirmation).
 */
export function Item({ title, subtitle, description, tags, actions, notice, children }: {
  title: ReactNode;
  subtitle?: ReactNode;
  description?: ReactNode;
  tags?: ReactNode;
  actions?: ReactNode;
  notice?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <article className="twui-item">
      <div className="twui-item-main">
        <div style={{ minWidth: 0 }}>
          <h3 className="twui-item-title">
            {title}
            {subtitle && <span className="twui-item-subtitle">{subtitle}</span>}
          </h3>
          {description && <p className="twui-item-desc">{description}</p>}
          {tags && <div className="twui-item-tags">{tags}</div>}
        </div>
        {actions && <div className="twui-item-actions">{actions}</div>}
        {notice && <div className="twui-item-notice">{notice}</div>}
      </div>
      {children}
    </article>
  );
}

/** The part of an `Item` below its divider. */
export function ItemBody({ children }: { children: ReactNode }) {
  return <div className="twui-item-body">{children}</div>;
}

/** A short line of status or explanation in a tone's colour. */
export function Notice({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <p className="twui-notice" data-tone={tone}>
      {children}
    </p>
  );
}

/** Term and value pairs, for details. */
export function DefinitionList({ items }: { items: ReadonlyArray<readonly [ReactNode, ReactNode]> }) {
  return (
    <dl className="twui-dl">
      {items.map(([term, value], i) => (
        <div key={i} style={{ display: 'contents' }}>
          <dt>{term}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * An inline confirmation for an action with consequences, shown in place of a
 * modal: what will happen, then confirm and cancel. Put it in an `Item`'s body.
 */
export function Confirm({ title, description, confirmLabel, cancelLabel, onConfirm, onCancel, busy = false }: {
  title: ReactNode;
  description?: ReactNode;
  confirmLabel: ReactNode;
  cancelLabel: ReactNode;
  onConfirm(): void;
  onCancel(): void;
  busy?: boolean;
}) {
  return (
    <div className="twui-confirm" role="group">
      <p className="twui-confirm-title">{title}</p>
      {description && <p className="twui-notice">{description}</p>}
      <div className="twui-row">
        <Button variant="primary" busy={busy} onClick={onConfirm}>
          {confirmLabel}
        </Button>
        <Button variant="ghost" disabled={busy} onClick={onCancel}>
          {cancelLabel}
        </Button>
      </div>
    </div>
  );
}

/** A centred first screen: what this is, and the one thing to do next. */
export function EmptyState({ mark, title, children, actions }: {
  mark?: ReactNode;
  title: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="twui-empty">
      {mark}
      <h2>{title}</h2>
      {children}
      {actions}
    </section>
  );
}

/** A transient message at the bottom of a `Panel` body; the caller decides when it goes. */
export function Toast({ tone = 'neutral', children }: { tone?: 'neutral' | 'danger'; children: ReactNode }) {
  return (
    <div className="twui-toast" data-tone={tone} role={tone === 'danger' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}
