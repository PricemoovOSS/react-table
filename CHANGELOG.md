# Changelog

All notable changes to `@pricemoov/react-table` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **WAI-ARIA Grid semantics** on the table tree (`role="grid"`, `gridcell`, `columnheader`,
  `aria-rowcount` / `aria-colcount` / `aria-rowindex` / `aria-colindex`,
  `aria-multiselectable`, `aria-selected`, `aria-expanded`, `aria-colspan`).
- **Keyboard navigation** following the W3C ARIA APG Grid pattern: arrow keys,
  Home / End / Ctrl+Home / Ctrl+End, PageUp / PageDown, Enter / Space (sub-row toggle).
  Roving tabIndex, single tab stop. Off-window cells are scrolled into view automatically.
- New props on `<Table>`: `disableKeyboardNavigation`, `keyboardPageSize`, `ariaLabel`,
  `ariaLabelledBy`.
- New imperative method on `ITableHandle`: `getOpenedTrees()`.
- New standalone hook: `useGridKeyboardNavigation`.
- New hook option on `useVirtualizer`: `overscan`.
- `:focus-visible` outline on cells (WCAG 2.4.7 compliant).
- Documentation site under `docs/` (Markdown).

### Changed

- License relicensed from **Apache-2.0 to MIT** to align with the React/JS ecosystem standard.
- All class components rewritten as **function components** with `forwardRef` +
  `useImperativeHandle`. Public API kept stable.
- `useVirtualizer` extracted as a public, framework-agnostic hook.
- `<Scroller>` and `<Virtualizer>` exposed via `forwardRef` returning `IScrollerHandle`
  and `IVirtualizerHandle` respectively.
- Sass migrated from `@import` to `@use` / `@forward` (Dart Sass 3.0 ready).
- Storybook 6 → 9 (Vite framework). Stories migrated to CSF3 with autodocs.
- Test stack: Enzyme replaced by React Testing Library. 0 snapshot, all DOM-based.
- TypeScript 4.8 → 5.x with stricter typing (`strictNullChecks`).
- Build: `node-sass` → `sass` (Dart Sass).

### Performance

- **rAF coalescing** on scroll events — collapses bursts of scroll events into one
  reconciliation per animation frame.
- **Structural sharing** on `elevatedRowIndexes` / `elevatedColumnIndexes` returned by
  `useVirtualizer` — same reference when content is unchanged, keeping `<Row>` memoization
  on `===` instead of deep equality.
- **Stable callback identities** in `<ElementaryTable>` (`getVisibleRows`,
  `getRowTreeLength`) and `<Row>` (`updateOpenedCell`, `onSubRowOpen`, `onSubRowClose`,
  `toggleCell`, `toggleFirstCell`) via the read-through-ref pattern. Fixes the
  pre-existing bug where every cell re-rendered on every scroll because of unstable
  function props.
- `rowStyle` for elevated rows is **cached by `absolutePosition` value** — same reference
  across renders.
- **CSS containment** (`contain: layout paint`) on the cell wrapper.
- `Cell` memoization uses **shallow style compare** instead of `lodash.isEqual` (~20× faster).
- `getMappingCellsWithColspan` now uses a `WeakMap` cache (scales beyond a single cached call).
- Scroll position is **preserved** across input changes (regression fix from earlier v3 builds).

### Fixed

- Variance regression introduced by tightening generic defaults — restored to keep
  `IRow<IDataCoordinates>` covariant for consumers.
- Reduce accumulators are now typed (no implicit-any errors under TS 5 strict).
- Storybook displays virtualized tables again after the keyboard wrapper was added
  (the wrapper carries `height: 100%; width: 100%` so `<ResponsiveContainer>` measures
  correctly).
