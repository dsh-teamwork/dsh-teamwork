// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { Button, Panel, Select, STYLE_ELEMENT_ID, Tabs, css, ensureStyles } from '../src/index.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function render(node: React.ReactNode) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(node));
  return { container, rerender: (next: React.ReactNode) => act(() => root.render(next)), unmount: () => act(() => root.unmount()) };
}

afterEach(() => {
  document.body.innerHTML = '';
  document.getElementById(STYLE_ELEMENT_ID)?.remove();
});

describe('@dsh-teamwork/ui', () => {
  it('keeps the split primary action separate from selecting another option', () => {
    const activated: string[] = [], picked: string[] = [];
    const { container, unmount } = render(<Select label="Team" value="a" options={[{ value: 'a', label: 'Alpha' }, { value: 'b', label: 'Beta' }]} onActivate={() => activated.push('a')} onChange={v => picked.push(v)} />);
    act(() => container.querySelector<HTMLButtonElement>('.twui-select-primary')!.click());
    expect(activated).toEqual(['a']); expect(container.querySelector('[role="listbox"]')).toBeNull();
    act(() => container.querySelector<HTMLButtonElement>('.twui-select-trigger')!.click());
    expect(container.querySelector('[role="listbox"]')).not.toBeNull(); expect(activated).toEqual(['a']);
    act(() => container.querySelector('[role="option"][data-index="1"]')!.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(picked).toEqual(['b']); expect(activated).toEqual(['a']);
    expect(document.activeElement).toBe(container.querySelector('.twui-select-trigger'));
    unmount();
  });
  it('opens at the keyboard edge and recovers when the highlighted option disappears', () => {
    const picked: string[] = [];
    const options = [{ value: 'a', label: 'Alpha' }, { value: 'b', label: 'Beta' }];
    const { container, rerender, unmount } = render(<Select label="Team" value="a" options={options} onChange={v => picked.push(v)} />);
    act(() => container.querySelector('button')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true })));
    expect(container.querySelector('[role="listbox"]')!.getAttribute('aria-activedescendant')).toContain('-1');
    rerender(<Select label="Team" value="a" options={options.slice(0, 1)} onChange={v => picked.push(v)} />);
    act(() => container.querySelector('[role="listbox"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
    expect(picked).toEqual(['a']); unmount();
  });
  it('selects by keyboard, skips disabled options, restores focus, and closes on outside input', () => {
    const picked: string[] = [];
    const { container, unmount } = render(<Select label="Team" value="a" options={[{ value: 'a', label: 'Alpha' }, { value: 'b', label: 'Beta', disabled: true }, { value: 'c', label: 'Charlie' }]} onChange={value => picked.push(value)} />);
    const trigger = container.querySelector('button')!;
    expect(container.querySelector('select')).toBeNull();
    act(() => trigger.click());
    const list = container.querySelector('[role="listbox"]')!;
    expect(document.activeElement).toBe(list);
    act(() => list.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })));
    act(() => list.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
    expect(picked).toEqual(['c']);
    expect(document.activeElement).toBe(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    act(() => trigger.click());
    act(() => container.querySelector('[role="listbox"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(picked).toEqual(['c']);
    act(() => trigger.click());
    act(() => document.body.dispatchEvent(new Event('pointerdown', { bubbles: true })));
    expect(container.querySelector('[role="listbox"]')).toBeNull();
    unmount();
  });
  it('adds its stylesheet once, however many screens mount', () => {
    render(<><Panel label="a">x</Panel><Panel label="b">y</Panel></>);
    ensureStyles();
    expect(document.querySelectorAll(`#${STYLE_ELEMENT_ID}`)).toHaveLength(1);
  });

  it('follows DSH tokens and falls back outside DSH', () => {
    // Inside DSH the host's token wins; elsewhere the fallback after the comma applies.
    expect(css).toContain('--twui-accent: var(--dsw-alias-state-business-primary,');
    expect(css).toContain('--twui-fg: var(--dsw-alias-label-primary,');
  });

  it('disables a busy button so an action cannot run twice', () => {
    const { container } = render(<Button busy onClick={() => { throw new Error('clicked'); }}>Save</Button>);
    const button = container.querySelector('button')!;
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');
  });

  it('reports the tab the person picks and marks the selected one', () => {
    const picked: string[] = [];
    const { container } = render(<Tabs label="Kinds" value="a" onChange={(id) => picked.push(id)} items={[{ id: 'a', label: 'A', count: 2 }, { id: 'b', label: 'B' }]} />);
    const [a, b] = container.querySelectorAll('[role="tab"]');
    expect(a.getAttribute('aria-selected')).toBe('true');
    act(() => (b as HTMLButtonElement).click());
    expect(picked).toEqual(['b']);
  });
});
