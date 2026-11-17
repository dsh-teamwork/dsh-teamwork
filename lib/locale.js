/**
 * The two languages the plugin speaks, the same pair as the platform's
 * (`en`, `zh-CN`), and the rule that maps any language tag onto one of them.
 * Imported by both halves: no Node or host imports.
 */
/** Any Chinese tag reads Chinese; everything else, and nothing at all, reads English. */
export function pickLocale(tag) {
    return tag?.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';
}
/** Fills `{name}` placeholders; a placeholder without a value stays as written, so a missing one is visible. */
export function fill(template, values) {
    return values ? template.replace(/\{(\w+)\}/g, (whole, name) => (name in values ? String(values[name]) : whole)) : template;
}
/** A lookup over one catalogue per locale, where the Chinese catalogue has every English key. */
export function translator(catalogs, locale) {
    return (key, values) => fill(catalogs[locale][key], values);
}
//# sourceMappingURL=locale.js.map