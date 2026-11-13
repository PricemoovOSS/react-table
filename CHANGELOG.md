# Changelog

All notable changes to `@pricemoov-oss/react-table` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [5.0.0] — unreleased

Upgrade guide: [docs/migration.md](docs/migration.md).

### Breaking

- `Table`, `Virtualizer` and `Scroller` are function components: a `ref` gives a handle (`ITableHandle`,
  `IVirtualizerHandle`, `IScrollerHandle`) instead of a class instance. The type `IState` is removed.
- The group of a column fixed on the right has its own group cell, placed above the column. A custom group
  cell must apply the `style` it receives.
- Columns fixed on the right have a relief on every row, drawn by the table.
- A window that fits exactly N rows or columns renders N of them, not N + 1.
- Rows carry `role="row"` and `aria-rowindex`, cells `aria-colindex`, the table `aria-rowcount` and
  `aria-colcount`.
- A cell without selection, sub rows nor keyboard navigation has no mouse handler.
- `react-resize-detector` is no longer a dependency; `@mui/styles` and `@mui/icons-material` are no longer
  peer dependencies (the library imports neither). `@mui/material` 6 is accepted next to 5.
- License: MIT (was Apache-2.0).

### Added

- `keyboardNavigation` (off by default): arrow keys, Home / End, Ctrl+Home / Ctrl+End, PageUp / PageDown
  between cells, Enter / Space to open sub rows, Escape to leave the content of a cell, with grid semantics.
  `keyboardPageSize`, `ariaLabel`, `ariaLabelledBy`. Standalone hook `useGridKeyboardNavigation`.
- CSS custom properties for reliefs, separators and colors (`--rt-*`), including optional column separators.
  See [docs/theming.md](docs/theming.md).
- `virtualizerProps.scrollEndThreshold`: how close to an edge the scroll handlers report it as reached.
- `virtualizerProps.synchronousScrollRendering` (on by default): the new window is rendered inside the
  scroll event, and painted with the scroll position that caused it.
- Class `elevated-absolute-edge` on the first column fixed on the right, on every row.
- ES modules build (`module` field, `dist/esm`) next to CommonJS, and `sideEffects` limited to the
  stylesheet: bundlers tree-shake the library. `yarn test:size` keeps its weight under a budget in CI.
- `ITableHandle.getOpenedTrees()`.
- `useVirtualizer` hook, usable without `Table`.
- `GroupCellProps.style`, `GroupBranch.fixedEnd`, `GroupBranch.isFixedStartEdge`, `getVisibleGroups`.
- Browser tests (`yarn test:browser`), rendering budgets and a reference of the rendered structure.
- Storybook reorganised: introduction, column groups, sub rows, theming, combinations, application recipe,
  heavy interactive cells (several hundred rows and columns, with a meter of what each interaction renders),
  live data (rows and columns inserted, removed and updated while displayed).

### Fixed

- A column pinned by id through `TableInteractionsManager` stayed on its former index when columns were
  inserted or removed before it: another column got pinned. The table now tells the manager when its
  columns change (`ITableHandle.onColumnsChange`), and the manager resolves the ids again.
- The last column kept the end padding that fills a table narrower than its window after it stopped being
  the last one or the table stopped being narrower: the column was too wide and the table overflowed.
- Two tables narrower than their window, scrolled in turn, rendered all their rows at each step: each one
  now keeps its own columns.
- The scroll range counted twice the sizes given to scrolling rows and columns: a part of the scroll bar had
  no effect.
- `goToRowIndex`, `goToColumnIndex`, `goToColumnId` and `initialScroll` stopped `scrollEndThreshold` pixels
  before the end: the last row or column could stay out of the window.
- A window too small for one row or column rendered every row or column of the data.
- A fixed index repeated in `fixedRows` / `fixedColumns` rendered its item twice; one beyond the data left an
  empty space in the window.
- A column whose `groupId` is not in `groups` shifted every group on its right by one column: it now goes
  with the columns without group.

- The header of a group whose column is fixed on the right was rendered outside the window and made the
  group row taller.
- Columns fixed on the right had no relief; group rows had none for the columns fixed on the left.
- Removing `groups` updated the height of the rows one render late.
- Two tree changes requested in the same tick: the second one replaced the first.
- A fresh `yarn install` broke jest (`strip-ansi`, `string-width` and `wrap-ansi` resolved to their ES module
  versions).

### Changed

- A vertical scroll step renders the entering row only; a render of the parent with the same data renders
  nothing; the virtualization cache is not rebuilt on scroll. `virtualizerProps` and its arrays can be
  written inline.
- A scroll step is shown one frame earlier: in the frame of the scroll event.
- A row or a cell that enters the window costs less: the layout of a column is computed once and not once
  per cell, event handlers are created only for the cells that need some, the comparators of `Row` and `Cell`
  allocate nothing.
- A change of data costs what it changes, not the size of the table: the index maps are built in one pass,
  and only when rows are inserted, removed or opened; updating a value among 20 000 rows went from 54 ms
  to under 1 ms. `columns` and `rowsProps` rebuilt with the same content are recognised.
- `syncOpenedTreesWithRows` returns the trees it was given when none is dropped, and no longer modifies them.
- `onOpenedTreesUpdate` is called after the render is committed, once per requested change.
- The handle given to `ref` is created once and does not change with the data.
- Toolchain: React 18, TypeScript 5, Storybook 9 (Vite), Jest 29 with React Testing Library, Playwright,
  Dart Sass, stylelint. The sources, the stories and the tests type-check in strict mode.

## [4.0.2]

- Keep the Storybook builder out of the runtime dependencies.

## [4.0.0] – [4.0.1]

- Package renamed to `@pricemoov-oss/react-table`.
- Column groups, custom scrollbar size, `useVirtualizerManager`, custom sub-rows toggle, opened trees kept
  in sync with the rows.
