import { useInsertionEffect, type HTMLAttributes } from 'react';
import { css, STYLE_ELEMENT_ID } from './styles.js';

/** Adds the library's stylesheet to `doc` once; later calls find it and do nothing. */
export function ensureStyles(doc: Document = document): void {
  if (doc.getElementById(STYLE_ELEMENT_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ELEMENT_ID;
  style.textContent = css;
  doc.head.appendChild(style);
}

/**
 * The boundary every screen built from this library sits inside: it injects
 * the stylesheet and sets the `--twui-*` theme variables (see `styles.ts`).
 */
export function UIRoot({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  useInsertionEffect(() => ensureStyles(), []);
  return <div {...props} className={join('twui', className)} />;
}

export function join(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(' ');
}
