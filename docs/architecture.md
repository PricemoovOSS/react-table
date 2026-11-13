# Architecture

This page documents the layering, how the window is laid out, the data flow at scroll-time, and the design
decisions that shape the public API.

## Layering

```
+----------------------------------------------------------+
|  <Table>                                                 |  Domain layer
|    └─ TableContent (memoized, one visible window)        |  - opened trees (useOpenedTrees)
|         └─ <SelectionHandler> (when isSelectable)        |  - column ↔ id mapping
|              └─ <ElementaryTable>                        |  - groups
|                   ├─ <GroupRows>                         |  - selection
|                   └─ <Row> ──▶ <Cell>                    |
+----------------------------------------------------------+
                       wrapped, when isVirtualized, by
+----------------------------------------------------------+
|  <ResponsiveContainer> (when no fixed width/height)      |  Sizing layer
|    └─ <Virtualizer>                                      |
|         └─ <Scroller>                                    |  Scroll layer
|              └─ TableContent (the same)                  |
+----------------------------------------------------------+

Pure, framework-agnostic core
+----------------------------------------------------------+
|  src/components/utils/table.tsx                          |
|  - getVirtualizerCache                                   |
|  - getVisibleItemIndexes (interpolation search + cache)  |
|  - getElevatedIndexes                                    |
|  - getIndexScrollMapping                                 |
|  - addSequentialIndexesToFixedIndexList                  |
|                                                          |
|  src/hooks/useVirtualizer.ts                             |
|  - composes the helpers above                            |
+----------------------------------------------------------+
```

## How the window is laid out

The table does not move with the scroll. `<Scroller>` keeps it stuck in the window (`position: sticky`) next
to an empty element that has the size of the whole data and creates the scroll range. Scrolling only changes
**which** rows and columns are rendered, one whole row or column at a time: headers, fixed items and cells are
always aligned, without any offset to compute.

- Rows fixed at the top and columns fixed on the left are the first ones rendered.
- Rows fixed at the bottom and columns fixed on the right are taken out of the flow (`position: absolute`)
  with a `bottom` / `right` equal to the size of the fixed items after them. They carry the class
  `elevated-absolute`, and the first column of them `elevated-absolute-edge`; the last item fixed at the start
  carries `elevated-start`. The reliefs are drawn from these classes (see [Theming](./theming.md)), never
  from a sibling selector: the neighbours of a fixed column change at every horizontal scroll step, and a
  sibling selector makes the browser restyle the fixed cells each time.
- A group of columns never spans both the flow and the columns fixed on the right: the fixed ones get their
  own group cells, placed like them.
- The window renders the items it has room for, the last one possibly cut by the edge. It never renders an
  item that would start right after the available space.

## Data flow on scroll

```
User scrolls
        │
        ▼
<Scroller> onScroll → IOnScroll (position, directions, edges reached)
        │
        ▼
<Virtualizer> processes the event at once: which axes moved?
        │
        ▼
useVirtualizer.computeRowsState(scrollTop)
useVirtualizer.computeColumnsState(scrollLeft)
        │
        │   ── returns null if the visible window did not change → no state update, no render
        ▼
state update (only if the window changed), inside flushSync
        │
        │   ── the render happens inside the scroll event, before the paint of its frame
        ▼
<ElementaryTable> renders only the rows that match visibleRowIndexes
        │
        ▼
<Row> (memoized) re-renders only when its own props differ
        │
        ▼
<Cell> (memoized) re-renders only when its own props differ
        │
        ▼
onScroll, onHorizontallyScroll, onVerticallyScroll are called, in that order
```

The fast path on a scroll that doesn't reveal new items: **0 component re-renders**. The slow path: a
vertical step renders the entering row only; a horizontal step renders every row, and one new cell per row.
These budgets are locked by [`test/it-tests/render-budget.test.tsx`](../test/it-tests/render-budget.test.tsx).

### The frame that shows a scroll step

The browser dispatches one scroll event per element and per frame, before it paints that frame. The window
is computed in the event and rendered there synchronously (`flushSync`), so the frame that paints a scroll
position also paints the rows and columns of that position. Left to its scheduler, React would render after
the paint: the content would follow the scrollbar one frame late.
`virtualizerProps.synchronousScrollRendering: false` gives that scheduling back, for an application that
prefers its own updates to come first. The scroll handlers are called after the render, in the same event;
what they update is scheduled by React as usual.

A scroll asked by program (`goToRowIndex`, `goToColumnIndex`, `goToColumnId`, `initialScroll`) moves the
window without waiting for the event: the handlers are called when the event comes. In jsdom, which sends
no scroll event for a scroll made by a script, the window moves all the same.

### What a row and a cell cost when they enter the window

Rows and cells are mounted at every scroll step, so their first render is kept short:

- what the cells of a column share (style, class, selectable, loading) is computed once per column and row
  height, not once per cell; the cells of a column receive the same `style` object from one render to the next;
- a cell creates its event handlers only if it needs some (selection, sub rows, keyboard navigation);
- the mapping of spanning cells is built only for a row that has some;
- `React.memo` comparators allocate nothing.

`test/browser/heavy-cells.spec.ts` checks, in a real browser and with heavy interactive cells, that a step
renders the entering cells only and in which frame they are shown.

### What a change of data costs

New `rows` reach the table as a new array. What is derived from it is derived from what changed:

- the maps between a row and its place among the displayed rows (`getAllIndexesMap`) are built in one pass,
  and only when the number of rows or the opened rows change — not when values do;
- the virtualization cache is rebuilt when the number of rows or columns, their sizes, or the fixed and
  hidden items change — not when values do, nor when `columns` / `rowsProps` come back with the same content;
- a row that is the same object as before is not rendered; a cell whose props are the same is not rendered;
- rows and cells are keyed by their `id`: an insertion moves components, it does not rebuild them.

`test/it-tests/data-updates.test.tsx` locks these costs and replays random sequences of insertions, removals
and updates; `test/browser/live-data.spec.ts` checks geometry and scroll after each change in a browser.

## Cache regeneration

`useVirtualizer` recomputes its internal cache (`getVirtualizerCache`) whenever any of its inputs change — viewport size, total counts, fixed/hidden indexes, custom sizes, padding. It runs a two-pass algorithm to settle on whether each axis needs the **opposite** scrollbar's thickness as padding.

The lists of fixed and hidden indexes are compared by content (`useStableValue`): an application can write
`virtualizerProps` and its arrays inline, the cache is only rebuilt when a value changes. A scroll never
rebuilds it.

When the cache regenerates:

- The hook tracks the **last applied scroll position** in a ref (not state).
- The visible window is recomputed at that position — preserving what the user was looking at.
- The window and the elevations are compared with the previous ones: nothing is rendered when both are
  unchanged, and an unchanged part keeps its reference.

This is why scrolling, then adding a row, doesn't jump back to the top.

## Memoization model

| Layer            | Strategy                                                                                                                                                                                                                                                                                             |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<Cell>`         | `React.memo` with a custom comparator: shallow-equal on most props, **shallow-equal on `style`** too — CSS property objects are flat by nature, ~20× faster than deep equality.                                                                                                                      |
| `<Row>`          | `React.memo` with a custom comparator: shallow-equal on most props, deep-equal on `selectedCells` / `elevatedRowIndexes` / `elevatedColumnIndexes`. When the row has no opened sub-tree, `visibleRowIndexes` is excluded from the comparison since it only impacts subtrees.                         |
| `TableContent`   | `React.memo`. It receives the visible window as flat props (`visibleRowIndexes`, `cellWidth`…): a render of the application that changes neither the data nor the window stops there.                                                                                                                |
| `<Table>` handle | Created once. Its methods read the current rows and trees through a ref, so the `ref` of the table — and everything that depends on it, like `TableInteractionsManager` — is not refreshed when the data changes.                                                                                    |
| `<Virtualizer>`  | None — it's a thin shell. The expensive part lives in `useVirtualizer`'s `useMemo`.                                                                                                                                                                                                                  |
| `useVirtualizer` | `useMemo` for the cache, `useCallback` for handlers, refs (not state) for the last scroll position. **Structural sharing** on `elevated*Indexes`: when the freshly computed elevated descriptor is content-equal to the previous, the previous reference is returned, keeping `<Row>` memo on `===`. |

## Performance optimizations

The library applies several optimizations to keep scroll fluid even on rich grids
(thousands of cells, custom cell renderers, MUI components):

### Scroll path

1. **A scroll event costs nothing while the window stays the same.** `<Virtualizer>` computes
   the window of the new position and compares it with the current one: a scroll inside the same
   row and column changes no state. Browsers send one scroll event per element and per frame, so
   the event is processed as it comes, without a frame or a timer of its own.
2. **Stable callbacks** at the `<ElementaryTable>` and `<Row>` level via the
   read-through-ref pattern. `getVisibleRows`, `getRowTreeLength`, `toggleCell`,
   `updateOpenedCell`, `onSubRowOpen` and `onSubRowClose` keep the same identity across
   renders. Without this, every vertical scroll re-rendered every cell because
   `toggleCell` had a new identity → `<Cell>` memoization broke on `onCallOpen`.
3. **`rowStyle` cache by `absolutePosition`** in `<ElementaryTable>`: rows fixed at the
   bottom (elevation `absolute`) reuse the same `{ bottom: N }` reference.

### Cache

- The `<Row>` colspan mapping is built only for a row with spanning cells, and cached in a
  `WeakMap<ICell[], …>`.
- `getVisibleItemIndexes` keeps a per-scroll-bucket cache of visible indexes, so scrolling
  back and forth across the same area is `O(1)`.

### Browser-level

- `:focus-visible` (not `:focus`) avoids a focus outline on mouse clicks but shows it on
  keyboard navigation — consistent with WCAG 2.4.7.

## Scroll position preservation

When props change, the hook recomputes the window at the last applied scroll position, kept in a ref. The table does not jump back to the top.

The regression test lives in [`test/hooks/useVirtualizer.test.tsx`](../test/hooks/useVirtualizer.test.tsx) under `preserves scroll position when inputs change`.

## Performance characteristics

| Operation                        | Cost                                                                                               |
| -------------------------------- | -------------------------------------------------------------------------------------------------- |
| Visible window after a scroll    | `O(log n)` interpolation search + `O(visible)` index assembly, cached per scroll bucket            |
| Cache rebuild on prop change     | `O(rowsLength + columnsLength)` — never on scroll, never for an inline array with the same content |
| Initial mount                    | `O(rowsLength + columnsLength)`                                                                    |
| `<Cell>` / `<Row>` memo decision | `O(props)` shallow + `O(small constant)` deep on listed fields                                     |

The cache also keeps a **per-scrollIndex cache** of visible indexes, so scrolling back and forth across the same area is `O(1)`.

## Why expose `useVirtualizer`?

To open the internal engine for layouts other than tables — virtualized lists, grids over canvas, masonry-like layouts. The `<Table>` component remains the easy path for the common case; `useVirtualizer` is the escape hatch.

## Things that are intentionally simple

- **No headless mode for the table itself.** `<Table>` is currently coupled to a
  `<table>` DOM and to MUI's `IconButton` / `Skeleton` / `Icon` / `Menu`. The improvement
  plan tracks moving toward a presentation-agnostic `useTableModel` hook.
- **No async/lazy data.** The full row tree is materialized in memory. Up to roughly 1M
  cells in practice; beyond that, pre-aggregation or a lazy fetch layer (planned in
  [roadmap P5](./roadmap.md#p5--innovation-future)) is required.
- **No native sort/filter primitives.** Transform `rows` upstream. The planned
  `useTableModel` hook will expose `sort` / `filter` plugins.

## How it is tested

| Level                             | Where                                                         | What it guards                                                                                                                                                                                         |
| --------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Unit and integration, jsdom       | `test/components`, `test/hooks`, `test/it-tests`, `test/a11y` | Behaviour of each component, the keyboard logic, the usage of a data application (`application-usage.test.tsx`)                                                                                        |
| Rendering budget                  | `test/it-tests/render-budget.test.tsx`                        | How many rows and cells one interaction may render, and that a scroll does not rebuild the cache                                                                                                       |
| Structure                         | `test/it-tests/dom-structure.test.tsx`                        | The rendered rows, cells, classes and inline positions for combinations of fixed, hidden, grouped and opened items, against a recorded reference                                                       |
| Browser (Playwright on Storybook) | `test/browser`                                                | What jsdom cannot see: alignment, fixed items against their edge, group headers above their columns, reliefs read on screenshots, sizing by the container, focus across rows that are not rendered yet |
