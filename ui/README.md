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
| `Panel` | A full-height screen: header, navigation, scrolling body. It is the theme root. |
| `UIRoot` | The theme root for anything that is not a `Panel`. |
| `Item`, `ItemBody` | One entry in a list: title, subtitle, description, tags, actions, a notice, and a body below a divider. |
| `Confirm` | An inline confirmation for an action with consequences, in place of a modal. |
| `EmptyState` | A first screen: what this is and the one thing to do next. |
| `Button` | `primary`, `secondary`, `ghost`, `danger`; `busy` shows a spinner and blocks a second click. |
| `Badge` | A state or a label; `tone` and an optional `dot`. |
| `Tabs` | A row of tabs; the caller owns the selection. |
| `Input`, `Monogram`, `Spinner`, `Notice`, `DefinitionList`, `Toast` | What their names say. |

Utility classes for layout inside a screen: `twui-row` (a wrapping row with
gaps), `twui-mono`, `twui-muted`, `twui-subtle`.

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
