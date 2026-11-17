/**
 * The two languages the plugin speaks, the same pair as the platform's
 * (`en`, `zh-CN`), and the rule that maps any language tag onto one of them.
 * Imported by both halves: no Node or host imports.
 */

export type Locale = 'en' | 'zh-CN';

/** Any Chinese tag reads Chinese; everything else, and nothing at all, reads English. */
export function pickLocale(tag: string | null | undefined): Locale {
  return tag?.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';
}

/** Fills `{name}` placeholders; a placeholder without a value stays as written, so a missing one is visible. */
export function fill(template: string, values?: Record<string, string | number>): string {
  return values ? template.replace(/\{(\w+)\}/g, (whole, name: string) => (name in values ? String(values[name]) : whole)) : template;
}

/** A lookup over one catalogue per locale, where the Chinese catalogue has every English key. */
export function translator<K extends string>(catalogs: Record<Locale, Record<K, string>>, locale: Locale) {
  return (key: K, values?: Record<string, string | number>) => fill(catalogs[locale][key], values);
}
