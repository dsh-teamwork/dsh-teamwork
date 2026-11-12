// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { Button, Panel, STYLE_ELEMENT_ID, Tabs, css, ensureStyles } from '../src/index.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function render(node: React.ReactNode) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(node));
  return { container, unmount: () => act(() => root.unmount()) };
}

afterEach(() => {
  document.body.innerHTML = '';
  document.getElementById(STYLE_ELEMENT_ID)?.remove();
});

describe('@dsh-teamwork/ui', () => {
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
