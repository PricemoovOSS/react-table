# FAQ & gotchas

## My virtualized table is empty / has zero size

`isVirtualized` requires a non-zero viewport. Either pass `virtualizerProps.{width,height}`:

```tsx
<Table {...} isVirtualized virtualizerProps={{ width: 1000, height: 500 }} />
```

…or place the table inside a sized parent so the auto-`<ResponsiveContainer>` measures something:

```tsx
<div style={{ height: "100vh", width: "100%" }}>
  <Table {...} isVirtualized />
</div>
```

A parent with `height: auto` collapses to `0` → `<ResponsiveContainer>` won't render its children.

## Scrolling, then adding a row, jumps back to the top

This was a v3.0 bug; fixed in v3.1+. If you observe it again, open an issue with a repro — and double-check you're on `@pricemoov/react-table >= 3.1`.

## `cellContent` re-renders on every scroll

Make sure `cellContentProps` is referentially stable across renders (use `useMemo`/`useCallback` for inline objects/functions). The `<Cell>` memo compares `cellContentProps` by reference.

## `rows` re-creates on every render → terrible perf

Same idea: don't construct the `IRow[]` array inline. Lift it to module scope when static, or `useMemo` it when derived.

## I get `Cannot read properties of undefined (reading 'state')` upgrading from v3.0

`<Table>` is now a function component; `instance.state.openedTrees` is gone. Use the imperative handle:

```tsx
const tableRef = useRef<ITableHandle>(null);
tableRef.current?.getOpenedTrees(); // snapshot
```

…or react to `onOpenedTreesUpdate`.

## My custom cell component receives `dataCoordinates: any`

`Table<T>` is generic and propagates `T` to `dataCoordinates`. Type your table:

```tsx
<Table<MyDataCoords> id="t" rows={rows} ... />
```

## I want to drive the scroll from outside

Two options:

1. **High level** — use the table's imperative API:
   ```tsx
   tableRef.current?.goToColumnIndex(42);
   tableRef.current?.goToColumnId("revenue_q4");
   tableRef.current?.goToRowIndex(0);
   ```
2. **Low level** — use `<Scroller>` directly, or build your own scroll container by combining `useVirtualizer` + your DOM.

## How do I sort/filter?

Today the lib does not include sort/filter primitives — transform your `rows` upstream. The [improvement plan](./roadmap.md) includes a `useTableModel` hook that will accept sort/filter functions.

## Does it work with React 19?

The peer dep is `react@^18.2`. React 19 will likely work (no use of legacy lifecycle methods or string refs after the v3.1 modernization), but it's not officially supported until the peer range is widened.

## Does it work with SSR?

Partially. `getScrollbarSize()` reads from the DOM at module load and would crash on Node. There's no production-grade SSR usage today; the recommended pattern is to render `<Table>` only on the client.

## I see `DEPRECATION WARNING: Sass @import rules are deprecated`

Should not happen as of v3.1 — the styles use `@use` / `@forward` (Dart Sass ≥ 1.77).
If you see one, you're on an old build. Run `npm run build` to refresh `dist/`.

## Tab focuses the grid container, not the first cell. Is that a bug?

No, that's the W3C APG Grid pattern: a single tab stop. Pressing Tab focuses the grid
wrapper (which has `tabIndex={0}`), and the wrapper synchronously delegates focus to the
**active cell** — the last focused, or the first body cell on initial entry. From there,
arrow keys take over. See [accessibility.md](./accessibility.md).

## My screen reader doesn't announce the grid by name

Add an accessible name. Either reference a heading via `ariaLabelledBy`:

```tsx
<h2 id="grid-title">Q4 revenue</h2>
<Table {...props} ariaLabelledBy="grid-title" />
```

…or pass `ariaLabel="…"` directly. axe-core will warn until the grid has a name.

## Pressing arrow keys does nothing on a focused button inside a cell

Expected. When focus is on an element inside the cell (an `<input>`, a `<button>`),
arrow keys are scoped to that element. To re-enable grid navigation, blur the focused
control (Esc usually works) — focus returns to the cell, then arrows move across cells.

## How do I focus a cell programmatically?

Two options:

1. From inside `<Table>` — there's no public method (yet). The roadmap tracks adding
   `tableRef.current.focusCell(row, col)`.
2. From outside, with `useGridKeyboardNavigation` standalone:
   ```tsx
   const { focusCell } = useGridKeyboardNavigation(wrapperRef, { … });
   focusCell(5, 2); // moves DOM focus to cell at row 5, col 2 (scrolls if needed)
   ```
