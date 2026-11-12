import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';
import { join } from './root.js';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'md' | 'sm';
  /** Shows a spinner and disables the button while an action runs. */
  busy?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', busy = false, disabled, className, children, type = 'button', ...props },
  ref,
) {
  return (
    <button
      {...props}
      ref={ref}
      type={type}
      className={join('twui-btn', className)}
      data-variant={variant}
      data-size={size}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
    >
      {busy && <Spinner />}
      {children}
    </button>
  );
});

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return <input {...props} ref={ref} className={join('twui-input', className)} />;
});

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
