# Contributing to @pricemoov-oss/react-table

Thanks for taking the time to contribute!

The following is a set of guidelines, not rules. Use your best judgment, and feel free to propose changes to this document in a pull request.

## Quick start

```bash
git clone https://github.com/PricemoovOSS/react-table
cd react-table
yarn install --frozen-lockfile
yarn storybook      # http://localhost:9001
yarn test           # jest, jsdom
yarn test:browser   # Playwright, against Storybook
yarn build && yarn test:size   # weight of the published ES modules against its budget
yarn lint
```

Node 22 is recommended: it is the version of the CI pipeline.

`yarn test:browser` needs a browser once: `npx playwright install chromium`, or `PLAYWRIGHT_CHANNEL=chrome`
to use the Chrome already installed. It starts Storybook itself, or uses the one already running on port 9001.

## Tests

| What you change                                                 | Where to test it                                                                                                                            |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Behaviour of a component or a hook                              | `test/components`, `test/hooks`, `test/it-tests` (jest, React Testing Library)                                                              |
| How much one interaction renders                                | `test/it-tests/render-budget.test.tsx`                                                                                                      |
| The structure of the rendered table                             | `test/it-tests/dom-structure.test.tsx` — an intended change is recorded with `UPDATE_DOM_STRUCTURE=1 yarn test dom-structure`, and reviewed |
| Anything about layout, reliefs, sizes or focus                  | `test/browser` (Playwright). jsdom computes no layout: a test there cannot see it                                                           |
| A usage pattern of an application                               | `test/it-tests/application-usage.test.tsx` and the `Recipes/Application table` story                                                        |
| What a scroll step renders with heavy cells, and in which frame | `test/browser/heavy-cells.spec.ts` and the `Recipes/Heavy interactive cells` story                                                          |
| The weight of the package                                       | `yarn build && yarn test:size` — the budget is in `scripts/check-bundle-size.js`, raised on purpose only                                    |

A scroll event is processed when it is received: a test fires it and reads the result
(see `scroll-events.test.tsx`). jsdom sends no scroll event for a scroll made by a script; the table moves
its window itself in that case. The jest setup makes `requestAnimationFrame` synchronous for the keyboard
navigation, which looks for a cell on the frames that follow a scroll.

## Reporting bugs

Before opening a bug, search the [issue tracker](https://github.com/PricemoovOSS/react-table/issues) to make sure it hasn't already been reported.

When opening a new issue, please include:

- the version of `@pricemoov-oss/react-table`, React and the browser you are using
- a minimal reproduction (CodeSandbox, gist, or a Storybook story snippet)
- the actual vs. expected behaviour

## Suggesting enhancements

Open an issue with the `enhancement` label. Describe the use case before the proposed API — what problem are you trying to solve, and what alternatives have you considered?

## Pull requests

- Tests and stories are mandatory for any new public API.
- Run `yarn format` and `yarn lint` before pushing.
- Use the present imperative in commit messages ("Add fixed-row controller", not "Added").
- One feature per PR; avoid mixing refactors and behaviour changes.
- Update the guides in `docs/` and the changelog when the public API changes.

### Architecture conventions

- Components are **function components**. Class components are not accepted in new code.
- Public components that need an imperative API expose it via `forwardRef` + `useImperativeHandle` (see `Scroller`, `Virtualizer`, `Table`). Don't reach into private state.
- Pure virtualization math lives in `src/components/utils/table.tsx` and is consumed by `useVirtualizer`. Keep it framework-agnostic.
- Heavy components are wrapped in `React.memo` with a custom equality comparator only when profiling shows a real benefit.
- Tests use [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/). Do not introduce Enzyme.
- Stories use [Storybook CSF3](https://storybook.js.org/docs/api/csf), with `args` + `argTypes` controls. Do not use `addon-knobs` or `storiesOf`.

- A new look goes through a CSS custom property with a default value equal to the current rendering
  (see [docs/theming.md](docs/theming.md)).

### Dependencies

Use `yarn` only. `resolutions` pins `strip-ansi`, `string-width` and `wrap-ansi`: yarn 1 installs a package
once when an `npm:` alias and the plain name resolve to the same version, which left jest with the ES module
versions. Check a change of dependencies with a fresh install: `rm -rf node_modules && yarn install --frozen-lockfile && yarn test`.

### Styleguide

- Strict TypeScript (`strict: true`, `strictNullChecks`).
- Prefer ES module exports; avoid default exports for utilities.
- Comments explain the _why_, not the _what_.
- Add a unit test next to behavioural changes; for visual changes, add or update a Storybook story.

## Releasing

Releases are cut from `master` by repository maintainers via GitHub Releases; the [`npm-publish.yml`](.github/workflows/npm-publish.yml) workflow runs `yarn test` + `yarn build` and publishes to npm with the `--access public` flag.

The published version comes from the release tag, which must match `package.json` apart from a pre-release suffix: `@pricemoov-oss/react-table@5.0.0` goes to the npm dist-tag `latest`, `@pricemoov-oss/react-table@5.0.0-beta.1` to `beta` and leaves `latest` untouched. A pre-release can be cut from a branch, to try it in an application before the merge.
