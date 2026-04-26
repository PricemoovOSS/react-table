# Contributing to @pricemoov/react-table

Thanks for taking the time to contribute!

The following is a set of guidelines, not rules. Use your best judgment, and feel free to propose changes to this document in a pull request.

## Quick start

```bash
git clone https://github.com/PricemoovOSS/react-table
cd react-table
npm ci
npm run storybook    # http://localhost:9001
npm test
npm run lint
```

Node 20+ is recommended. The CI pipeline runs on Node 20.

## Reporting bugs

Before opening a bug, search the [issue tracker](https://github.com/PricemoovOSS/react-table/issues) to make sure it hasn't already been reported.

When opening a new issue, please include:

- the version of `@pricemoov/react-table`, React and the browser you are using
- a minimal reproduction (CodeSandbox, gist, or a Storybook story snippet)
- the actual vs. expected behaviour

## Suggesting enhancements

Open an issue with the `enhancement` label. Describe the use case before the proposed API — what problem are you trying to solve, and what alternatives have you considered?

## Pull requests

- Tests and stories are mandatory for any new public API.
- Run `npm run format` and `npm run lint` before pushing.
- Use the present imperative in commit messages ("Add fixed-row controller", not "Added").
- One feature per PR; avoid mixing refactors and behaviour changes.
- Update `README.md` when the public API changes.

### Architecture conventions

- Components are **function components**. Class components are not accepted in new code.
- Public components that need an imperative API expose it via `forwardRef` + `useImperativeHandle` (see `Scroller`, `Virtualizer`, `Table`). Don't reach into private state.
- Pure virtualization math lives in `src/components/utils/table.tsx` and is consumed by `useVirtualizer`. Keep it framework-agnostic.
- Heavy components are wrapped in `React.memo` with a custom equality comparator only when profiling shows a real benefit.
- Tests use [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/). Do not introduce Enzyme.
- Stories use [Storybook CSF3](https://storybook.js.org/docs/api/csf), with `args` + `argTypes` controls. Do not use `addon-knobs` or `storiesOf`.

### Styleguide

- Strict TypeScript (`strict: true`, `strictNullChecks`).
- Prefer ES module exports; avoid default exports for utilities.
- Comments explain the _why_, not the _what_.
- Add a unit test next to behavioural changes; for visual changes, add or update a Storybook story.

## Releasing

Releases are cut from `master` by repository maintainers via GitHub Releases; the [`npm-publish.yml`](.github/workflows/npm-publish.yml) workflow runs `npm test` + `npm run build` and publishes to npm with the `--access public` flag.
