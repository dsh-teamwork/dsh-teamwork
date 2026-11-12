import type { ReactNode } from 'react';
import { Button, type Tone } from './controls.js';
import { Icon, type IconName } from './icons.js';
import { UIRoot } from './root.js';

/**
 * A full-height screen: a header, optional navigation (usually `Tabs`) and a
 * scrolling body whose content is centred at a readable width. It is the
 * `UIRoot`, so a screen needs nothing around it. `centered` places the body's
 * content in the middle of the screen, for a first screen such as sign-in.
 */
export function Panel({ header, nav, children, label, centered = false }: {
  header?: ReactNode;
  nav?: ReactNode;
  children: ReactNode;
  /** Accessible name of the region. */
  label: string;
  centered?: boolean;
}) {
  return (
    <UIRoot className="twui-panel" role="region" aria-label={label} data-centered={centered || undefined}>
      {header && <header className="twui-panel-header"><div className="twui-panel-column">{header}</div></header>}
      {nav && <div className="twui-panel-nav"><div className="twui-panel-column">{nav}</div></div>}
      <div className="twui-panel-body">
        <div className="twui-panel-column twui-panel-content">{children}</div>
      </div>
    </UIRoot>
  );
}

/** A bordered surface for a group of content. */
export function Card({ children, padding = 20 }: { children: ReactNode; padding?: number }) {
  return <div className="twui-card" style={{ padding }}>{children}</div>;
}

/**
 * One entry in a list: an icon tile, title and subtitle, a description, tags,
 * actions on the right, an optional notice under them (why an action is
 * unavailable), and an optional body below a divider (details, a confirmation).
 */
export function Item({ icon, title, subtitle, description, tags, actions, notice, children }: {
  icon?: IconName;
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
      <div className="twui-item-main" data-no-icon={icon ? undefined : true}>
        {icon && <span className="twui-tile"><Icon name={icon} size={18} /></span>}
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

const toneIcon: Partial<Record<Tone, IconName>> = { warning: 'alert', danger: 'alert', success: 'check' };

/** A short line of status or explanation in a tone's colour, with the tone's icon. */
export function Notice({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  const icon = toneIcon[tone];
  return (
    <p className="twui-notice" data-tone={tone}>
      {icon && <Icon name={icon} size={14} />}
      <span>{children}</span>
    </p>
  );
}

/** A block message across the content: what happened, why, and one thing to do about it. */
export function Banner({ tone = 'neutral', title, children, action }: {
  tone?: 'neutral' | 'warning' | 'danger';
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="twui-banner" data-tone={tone} role={tone === 'danger' ? 'alert' : 'status'}>
      <span className="twui-banner-icon"><Icon name={tone === 'neutral' ? 'info' : 'alert'} size={16} /></span>
      <div className="twui-banner-body">
        <p className="twui-banner-title">{title}</p>
        {children && <p className="twui-banner-text">{children}</p>}
      </div>
      {action}
    </div>
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
      {description && <p className="twui-muted">{description}</p>}
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

/** What an empty list means and, when there is one, what to do about it. */
export function EmptyState({ icon = 'info', title, children, action }: {
  icon?: IconName;
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="twui-empty">
      <span className="twui-empty-icon"><Icon name={icon} size={20} /></span>
      <p className="twui-empty-title">{title}</p>
      {children && <p>{children}</p>}
      {action}
    </section>
  );
}

/** A transient message at the bottom of a `Panel` body; the caller decides when it goes. */
export function Toast({ tone = 'neutral', children }: { tone?: 'neutral' | 'danger'; children: ReactNode }) {
  return (
    <div className="twui-toast" data-tone={tone} role={tone === 'danger' ? 'alert' : 'status'}>
      <Icon name={tone === 'danger' ? 'alert' : 'check'} size={16} />
      {children}
    </div>
  );
}
