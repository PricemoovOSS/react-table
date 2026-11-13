# Roadmap

What 5.0 delivers, and what is left. MUI stays a peer dependency.

## Done in 5.0

- **Function components** with handles (`ITableHandle`, `IVirtualizerHandle`, `IScrollerHandle`);
  `useVirtualizer` usable alone.
- **Layout of the fixed items**: group headers of the columns fixed on the right, reliefs on both sides and
  on every kind of row, no item rendered where nobody can see it.
- **Rendering**: a vertical scroll step renders the entering row only, a scroll never rebuilds the
  virtualization cache, inline `virtualizerProps` cost nothing, the handle of the table is stable.
- **Theming** with CSS custom properties; replaceable group cell and sub-rows toggle.
- **Accessibility**: positions announced in the whole table; opt-in keyboard navigation with grid semantics,
  which leaves the keys of the content of a cell alone and keeps the focus across rows that are not rendered.
- **Tests**: rendering budgets, structure reference, browser tests on Storybook, usage of a data application.
- **Tooling**: React 18, TypeScript 5 strict on sources, stories and tests, Storybook 9 (Vite), Jest 29 with
  React Testing Library, Playwright, Dart Sass, stylelint.

## Next

- [ ] **Controlled state**: `openedTrees` / `onOpenedTreesChange`, `selectedCells` / `onSelectionChange`,
      next to the current initial values and handle methods.
- [ ] **Relief only when something is scrolled under the fixed items**, as an option.
- [ ] **Keyboard**: bring a cell into view with the smallest scroll instead of aligning it at the start;
      enter the content of a cell with Enter or F2; configurable keys.
- [ ] **Labels**: texts of the default sub-rows toggle as properties.
- [ ] **Loading placeholder** as a replaceable component, so that the cells need no MUI at all.
- [ ] **Split a group at the edge of the left fixed columns**, like on the right.
- [ ] **`focusCell`** on the handle of the table.
- [ ] **Stricter typing of the data payload**: `Table<TData>` down to `dataCoordinates` and `cellContentProps`.
- [ ] **Audit with a screen reader.**

## Later

- [ ] `data` + `columns` model next to `rows`, headless `useTableModel` hook, sort and filter plugins.
- [ ] Flat `virtualizerProps` (`<Table fixedRows fixedColumns />`).
- [ ] Lazy rows, column resizing and reordering.
- [ ] Storybook published, release notes generated from the commits.
