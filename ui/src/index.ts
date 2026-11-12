/**
 * @dsh-teamwork/ui — the components DSH Teamwork's screens share: the DSH
 * plugin panels today, the web app later. Components carry no product copy;
 * every label comes from the caller, in the caller's language. Theming is
 * `--twui-*` variables that default to DSH's own tokens (`styles.ts`).
 */
export { UIRoot, ensureStyles, join } from './root.js';
export { BrandMark, BRAND_INDIGO, BRAND_PAPER } from './brand.js';
export { Icon } from './icons.js';
export type { IconName } from './icons.js';
export { Badge, Button, Field, Input, Monogram, Skeleton, Spinner, Tabs } from './controls.js';
export type { ButtonProps, ButtonVariant, TabItem, Tone } from './controls.js';
export { Banner, Card, Confirm, DefinitionList, EmptyState, Item, ItemBody, Notice, Panel, Toast } from './layout.js';
export { css, STYLE_ELEMENT_ID } from './styles.js';
