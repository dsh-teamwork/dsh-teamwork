import { useEffect, useId, useRef, useState } from 'react';
import { Icon } from './icons.js';

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

/** A button/listbox select with native keyboard conventions and no native popup. */
export function Select({ id, label, value, options, onChange, onActivate, disabled = false }: {
  id?: string;
  label: string;
  value: string;
  options: readonly SelectOption[];
  onChange(value: string): void;
  /** Splits the selected label into a primary action and a separate popup toggle. */
  onActivate?(): void;
  disabled?: boolean;
}) {
  const generated = useId();
  const listId = `${id ?? generated}-options`;
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [side, setSide] = useState<'top' | 'bottom'>('bottom');
  const [height, setHeight] = useState(288);
  const search = useRef({ text: '', at: 0 });
  const selected = options.findIndex(o => o.value === value);
  const close = (focus = false) => { setOpen(false); if (focus) trigger.current?.focus(); };
  const move = (from: number, direction: number) => {
    for (let step = 1; step <= options.length; step++) {
      const next = (from + step * direction + options.length) % options.length;
      if (!options[next].disabled) { setActive(next); return; }
    }
  };
  const show = (edge?: 'first' | 'last') => {
    if (disabled || !options.some(o => !o.disabled)) return;
    const first = options.findIndex(o => !o.disabled), last = options.map(o => !o.disabled).lastIndexOf(true);
    const next = edge === 'first' ? first : edge === 'last' ? last : selected >= 0 && !options[selected].disabled ? selected : first;
    setActive(next); setOpen(true);
  };
  useEffect(() => {
    if (!open) return;
    const rect = root.current?.getBoundingClientRect();
    if (rect) {
      const below = window.innerHeight - rect.bottom, above = rect.top;
      const top = below < 250 && above > below;
      setSide(top ? 'top' : 'bottom');
      setHeight(Math.max(48, Math.min(288, (top ? above : below) - 12)));
    }
    list.current?.focus();
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  useEffect(() => { if (open) list.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView?.({ block: 'nearest' }); }, [active, open]);
  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);
  useEffect(() => {
    if (!open || options[active] && !options[active].disabled) return;
    const next = selected >= 0 && !options[selected].disabled ? selected : options.findIndex(o => !o.disabled);
    if (next < 0) close(true); else setActive(next);
  }, [options, selected, active, open]);
  return <div className="twui-select" data-split={!!onActivate || undefined} role={onActivate ? 'group' : undefined} aria-label={onActivate ? label : undefined} ref={root} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) close(); }}>
    {onActivate && <button type="button" className="twui-select-primary" disabled={disabled || selected < 0 || options[selected]?.disabled} onClick={() => { close(); onActivate(); }}><span>{options[selected]?.label ?? label}</span></button>}
    <button ref={trigger} id={id} type="button" className="twui-select-trigger" aria-label={`${label}：${options[selected]?.label ?? ''}`}
      aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? listId : undefined} disabled={disabled}
      onClick={() => open ? close(true) : show()}
      onKeyDown={e => { if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) { e.preventDefault(); show(e.key === 'Home' ? 'first' : e.key === 'End' ? 'last' : undefined); } }}>
      {!onActivate && <span>{options[selected]?.label ?? label}</span>}<Icon name="chevronDown" size={14} />
    </button>
    {open && <div ref={list} id={listId} role="listbox" aria-label={label} tabIndex={-1} className="twui-select-menu" data-side={side} style={{ maxHeight: height }}
      aria-activedescendant={`${listId}-${active}`} onKeyDown={e => {
        if (e.key === 'Tab') { close(true); return; }
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); return; }
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); move(active, e.key === 'ArrowDown' ? 1 : -1); }
        else if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); move(e.key === 'Home' ? options.length - 1 : 0, e.key === 'Home' ? 1 : -1); }
        else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const option = options[active]; if (option && !option.disabled) { onChange(option.value); close(true); } }
        else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          const text = (Date.now() - search.current.at < 700 ? search.current.text : '') + e.key.toLocaleLowerCase();
          search.current = { text, at: Date.now() };
          const next = options.findIndex(o => !o.disabled && o.label.toLocaleLowerCase().startsWith(text));
          if (next >= 0) setActive(next);
        }
      }}>
      {options.map((option, index) => <div key={option.value} id={`${listId}-${index}`} role="option"
        aria-selected={option.value === value} aria-disabled={option.disabled || undefined} data-index={index}
        data-active={index === active || undefined} className="twui-select-option"
        onPointerMove={() => { if (!option.disabled) setActive(index); }}
        onMouseDown={e => e.preventDefault()} onClick={() => { if (!option.disabled) { onChange(option.value); close(true); } }}>
        <span><span>{option.label}</span>{option.description && <small>{option.description}</small>}</span>
        {option.value === value && <Icon name="check" size={14} />}
      </div>)}
    </div>}
  </div>;
}
