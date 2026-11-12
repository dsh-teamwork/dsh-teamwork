import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';
import { Icon, type IconName } from './icons.js';
import { join } from './root.js';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  /** A leading icon; with no children the button is square and needs an `aria-label`. */
  icon?: IconName;
  /** A trailing icon, e.g. `external` for a button that opens another page. */
  trailingIcon?: IconName;
  /** Full width of its container. */
  block?: boolean;
  /** Shows a spinner and disables the button while an action runs. */
  busy?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon, trailingIcon, block = false, busy = false, disabled, className, children, type = 'button', ...props },
  ref,
) {
  const iconSize = size === 'sm' ? 14 : 16;
  return (
    <button
      {...props}
      ref={ref}
      type={type}
      className={join('twui-btn', className)}
      data-variant={variant}
      data-size={size}
      data-block={block || undefined}
      data-icon-only={!children || undefined}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
    >
      {busy ? <Spinner /> : icon && <Icon name={icon} size={iconSize} />}
      {children}
      {trailingIcon && <Icon name={trailingIcon} size={iconSize - 2} />}
    </button>
  );
});

export const Input = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & { size?: 'md' | 'lg' }>(
  function Input({ className, size = 'md', ...props }, ref) {
    return <input {...props} ref={ref} data-size={size} className={join('twui-input', className)} />;
  },
);

/** A labelled input with an optional hint or error under it. */
export function Field({ label, hint, error, htmlFor, children }: {
  label: ReactNode;
  htmlFor: string;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="twui-field">
      <label className="twui-label" htmlFor={htmlFor}>{label}</label>
      {children}
      {error ? <p className="twui-hint" data-tone="danger" role="alert">{error}</p> : hint && <p className="twui-hint">{hint}</p>}
    </div>
  );
}

export type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'accent';

export function Badge({ tone = 'neutral', dot = false, outline = false, title, children }: {
  tone?: Tone;
  /** A leading dot in the tone's colour, for states. */
  dot?: boolean;
  outline?: boolean;
  title?: string;
  children: ReactNode;
}) {
  return (
    <span className="twui-badge" data-tone={tone} data-outline={outline || undefined} title={title}>
      {dot && <span className="twui-badge-dot" aria-hidden="true" />}
      {children}
    </span>
  );
}

export function Spinner({ label }: { label?: string }) {
  return <span className="twui-spinner" role={label ? 'status' : undefined} aria-label={label} aria-hidden={label ? undefined : true} />;
}

/** A placeholder block while content loads. */
export function Skeleton({ width = '100%', height = 14 }: { width?: number | string; height?: number }) {
  return <span className="twui-skeleton" aria-hidden="true" style={{ display: 'block', width, height }} />;
}

export interface TabItem<Id extends string> {
  id: Id;
  label: ReactNode;
  count?: number;
}

/** A row of tabs; the caller owns the selection and renders the selected content. */
export function Tabs<Id extends string>({ items, value, onChange, label }: {
  items: ReadonlyArray<TabItem<Id>>;
  value: Id;
  onChange(id: Id): void;
  /** Accessible name of the tab list. */
  label: string;
}) {
  return (
    <div className="twui-tabs" role="tablist" aria-label={label}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          className="twui-tab"
          aria-selected={item.id === value}
          onClick={() => onChange(item.id)}
        >
          {item.label}
          {item.count !== undefined && <span className="twui-tab-count">{item.count}</span>}
        </button>
      ))}
    </div>
  );
}

/** A square initial mark, e.g. for a team or a workspace. */
export function Monogram({ text, size = 32 }: { text: string; size?: number }) {
  const letters = Array.from(text.trim()).slice(0, 2).join('').toUpperCase() || '?';
  return (
    <span className="twui-monogram" aria-hidden="true" style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}>
      {letters}
    </span>
  );
}
