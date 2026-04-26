# Roadmap

> Tracker for the modernization plan agreed for v3.x → v4.x. MUI is conserved as a peer dependency.

## P0 — Foundations

- [x] **ARIA grid + keyboard navigation** (v3.1)
      `role="grid"`, `role="gridcell"`, `role="columnheader"`, `aria-rowcount` / `aria-colcount`,
      `aria-rowindex` / `aria-colindex`, `aria-selected`, `aria-expanded`. Roving `tabIndex`
      pattern with arrow / Home / End / Ctrl+Home/End / PageUp / PageDown. See
      [accessibility docs](./accessibility.md).
- [ ] **Stricter typing of the data payload**
      `Table<TData>` propagates `TData` to `dataCoordinates`, `selectedCells`, the menu component. Re-paramaterize `cellContent` so `cellContentProps` is type-safe per cell.
- [x] **Fix the build under TS 5 strict** (variance, reduce accumulators).

## P1 — Modern data model

- [ ] **`data` + `columns` separation**
      Replace `IRow[]` with `data: TRow[]` + `columns: ColumnDef<TRow>[]`. Provide a `legacyRowsToData(rows)` helper for backwards compat.
- [ ] **Controlled / uncontrolled props on every state**
      `openedTrees` / `defaultOpenedTrees` / `onOpenedTreesChange`. Same for `selectedCells`, `hiddenColumns`, `hiddenRows`, `fixedRows`, `fixedColumns`.
- [ ] **Flatten `virtualizerProps`**
      `<Table fixedRows fixedColumns height width />` directly. Keep the nested object as a deprecated alias.

## P2 — Headless mode

- [ ] **`useTableModel` hook**
      Owns the tree, selection, fixed/hidden indexes, indexes mapping. Render is left to the consumer. The current `<Table>` becomes a presentation layer over `useTableModel` + `useVirtualizer`.
- [ ] **Optional `sort` / `filter` plugins** in `useTableModel`.

## P3 — Quality

- [ ] **Scenario-based test suites**: rendering 100k rows, scroll-to fixed row, opening a sub-row mid-scroll, selection rectangle with menu.
- [ ] **Playwright + benchmark in CI**: scroll FPS over 100k rows, regression budget per PR.

## P4 — Documentation & releases

- [x] **Documentation site (Markdown for now)**.
- [ ] **Storybook on GitHub Pages**.
- [ ] **`changesets` / `release-please`** for the changelog.
- [ ] **Single package name** — pick `@pricemoov/react-table` **or** `@pricemoov-oss/react-table`, not both.

## P5 — Innovation (future)

- [ ] **Async / lazy data**: `useTableModel({ getRow: async i => fetch(...) })` + skeleton placeholder.
- [ ] **Column / row resizing via drag**: `useColumnResize`.
- [ ] **Drag-to-reorder columns**.
- [ ] **Sass migration** from `@import` to `@use`.

## What's already done in v3.1

- **Stack** — React 18, TypeScript 5, Storybook 9 (Vite), Jest 29 + RTL 15, Dart Sass.
- **Architecture** — all class components → function components with `forwardRef` +
  `useImperativeHandle`. `useVirtualizer` extracted as a public hook with `overscan`.
- **License** — relicensed Apache-2.0 → MIT (React-style permissive).
- **Accessibility** — WAI-ARIA Grid + W3C APG keyboard navigation, focus indicator,
  hidden-index skip, sub-row toggle via Enter/Space, standalone
  `useGridKeyboardNavigation` hook. See [accessibility.md](./accessibility.md).
- **Performance** — rAF coalescing on scroll, structural sharing on elevated descriptors,
  stable callbacks across `<ElementaryTable>` / `<Row>` (fixes the _"every cell re-renders
  on every scroll"_ bug), `rowStyle` cache, CSS containment, manual shallow style compare
  on cells (~20× vs `lodash.isEqual`), `WeakMap` cache on colspan mappings. Scroll
  position preserved across input changes.
- **API hardening** — public ref handles (`ITableHandle`, `IVirtualizerHandle`,
  `IScrollerHandle`), `getOpenedTrees()`, no `defaultProps` left.
- **Tests** — 284 tests, 0 snapshots, all RTL. Dedicated `test/a11y/` suite for ARIA +
  keyboard.
- **Documentation** — README + 8 doc pages + CHANGELOG.
