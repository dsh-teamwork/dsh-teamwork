# @dsh-teamwork/ui

The React components DSH Teamwork's screens share: the Teamwork panel in the
DSH plugin today, and the web app and other DSH plugins later. It lives in the
plugin repository's `ui/` until it moves to its own repository,
[`dsh-teamwork/dsh-teamwork-ui`](https://github.com/dsh-teamwork/dsh-teamwork-ui).
Nothing is published yet: the plugin's browser bundle compiles it in.

## Rules

- **No product copy.** Every label, title and message comes from the caller,
  in the caller's language. A component that needs words takes them as props.
- **React is the host's.** `react` is a peer dependency; a DSH plugin bundles
  this library with `react` external, so it renders with DSH's own copy.
- **One stylesheet, injected once.** `Panel` and `UIRoot` add it to the
  document the first time they mount (`ensureStyles`). Class names carry the
  `twui-` prefix.
- **Themed by variables.** Colours, radii and fonts are `--twui-*` variables
  on `.twui`. Each defaults to the DeepSeek Harness token of the same role
  (`--dsw-alias-*`), so inside DSH the components follow its light and dark
  themes with nothing to configure. Outside DSH the built-in fallbacks apply,
  or the host maps the variables to its own tokens:

  ```css
  .twui { --twui-accent: var(--brand); --twui-border: var(--border); --twui-fg: var(--foreground); }
  ```

  The full list is at the top of `src/styles.ts`.

## Components

| Component | Use it for |
| --- | --- |
| `Panel` | A full-height screen: header, navigation and a scrolling body in one centred column. It is the theme root; `centered` places a first screen in the middle. |
| `BrandMark` | The DSH Teamwork mark on its plate, copied from the platform's `docs/brand/icon.svg`. Never drawn without the plate or recoloured. |
| `Icon` | The stroke icons the screens use (Lucide's paths), in `currentColor`. |
| `Card`, `Banner` | A bordered surface; a block message with a tone, a title and one action. |
| `UIRoot` | The theme root for anything that is not a `Panel`. |
| `Item`, `ItemBody` | One entry in a list: an icon tile, title, subtitle, description, tags, actions, a notice, and a body below a divider. |
| `Confirm` | An inline confirmation for an action with consequences, in place of a modal. |
| `EmptyState` | What an empty list means and, when there is one, what to do about it. |
| `Button` | `primary`, `secondary`, `ghost`, `danger`; sizes `sm`, `md`, `lg`; a leading or trailing `Icon`; `busy` shows a spinner and blocks a second click. |
| `Badge` | A state or a label; `tone` and an optional `dot`. |
| `Tabs` | A row of tabs; the caller owns the selection. |
| `Field`, `Input` | A labelled input with a hint or an error under it. |
| `Monogram`, `Spinner`, `Skeleton`, `Notice`, `DefinitionList`, `Toast` | What their names say. |

Utility classes for layout inside a screen: `twui-row` (a wrapping row with
gaps), `twui-stack`, `twui-tile`, `twui-link`, `twui-mono`, `twui-muted`,
`twui-subtle`. `--twui-fill` is a quiet fill drawn from the text colour, which
shows on any surface in both themes; use it rather than a host layer token.

## Development

```sh
pnpm --filter @dsh-teamwork/ui typecheck
pnpm --filter @dsh-teamwork/ui test
```

## Moving to its own repository

The directory is self-contained: its own `package.json`, `tsconfig.json`,
tests and this README, and nothing in it imports from the plugin. Moving it is
copying `ui/` to the new repository, publishing it, and replacing the
plugin's `workspace:*` dependency with the published version.
