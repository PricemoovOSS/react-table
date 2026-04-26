# Architecture

This page documents the layering, the data flow at scroll-time, and the design decisions that shape the public API.

## Layering

```
+----------------------------------------------------------+
|  <Table>                                                 |  Domain layer
|    └─ <SelectionHandler> (when isSelectable)             |  - tree (openedTrees)
|         └─ <ElementaryTable>                             |  - column ↔ id mapping
|              └─ <Row> ──▶ <Cell>                         |  - selection
+----------------------------------------------------------+
                       wrapped, when isVirtualized, by
+----------------------------------------------------------+
|  <ResponsiveContainer> (when no fixed width/height)      |  Sizing layer
|    └─ <Virtualizer>                                      |
|         └─ <Scroller>                                    |  Scroll layer
|              └─ <ElementaryTable> (the same)             |
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

## Data flow on scroll

```
User scrolls (or scrollTo* called)
        │
        ▼
<Scroller> onScroll → IOnScroll
        │
        ▼
<Virtualizer> getScrollAxes → vertical? horizontal?
        │
        ▼
useVirtualizer.computeRowsState(scrollTop)
useVirtualizer.computeColumnsState(scrollLeft)
        │
        │   ── returns null if the visible window did not change → no setState, no render
        ▼
setRowsState / setColumnsState (only if window changed)
        │
        ▼
<Virtualizer> re-renders with new visibleRowIndexes / visibleColumnIndexes
        │
        ▼
<ElementaryTable> renders only the rows that match visibleRowIndexes
        │
        ▼
<Row> (memoized) re-renders only when its own props differ
        │
        ▼
<Cell> (memoized) re-renders only when its own props differ
```

The fast path on a scroll that doesn't reveal new items: **0 component re-renders**. The slow path: only the affected rows/cells are reconciled.

## Cache regeneration

`useVirtualizer` recomputes its internal cache (`getVirtualizerCache`) whenever any of its inputs change — viewport size, total counts, fixed/hidden indexes, custom sizes, padding. It runs a two-pass algorithm to settle on whether each axis needs the **opposite** scrollbar's thickness as padding.

When the cache regenerates:

- The hook tracks the **last applied scroll position** in a ref (not state).
- The visible window is recomputed at that position — preserving what the user was looking at.
- `shallowSameIndexes` detects when the resulting window is identical to the previous one and avoids a re-render.

This is why scrolling, then adding a row, doesn't jump back to the top.

## Memoization model

| Layer            | Strategy                                                                                                                                                                                                                                                                                             |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<Cell>`         | `React.memo` with a custom comparator: shallow-equal on most props, **shallow-equal on `style`** too — CSS property objects are flat by nature, ~20× faster than deep equality.                                                                                                                      |
| `<Row>`          | `React.memo` with a custom comparator: shallow-equal on most props, deep-equal on `selectedCells` / `elevatedRowIndexes` / `elevatedColumnIndexes`. When the row has no opened sub-tree, `visibleRowIndexes` is excluded from the comparison since it only impacts subtrees.                         |
| `<Virtualizer>`  | None — it's a thin shell. The expensive part lives in `useVirtualizer`'s `useMemo`.                                                                                                                                                                                                                  |
| `useVirtualizer` | `useMemo` for the cache, `useCallback` for handlers, refs (not state) for the last scroll position. **Structural sharing** on `elevated*Indexes`: when the freshly computed elevated descriptor is content-equal to the previous, the previous reference is returned, keeping `<Row>` memo on `===`. |

## Performance optimizations

The library applies several optimizations to keep scroll fluid even on rich grids
(thousands of cells, custom cell renderers, MUI components):

### Scroll path

1. **`requestAnimationFrame` coalescing** in `<Virtualizer>`. Trackpads emit 100+ scroll
   events per second; the visible window can change at most once per frame. The handler
   keeps only the latest scroll position and processes it on the next animation frame.
   Pending rAF is cancelled on unmount and on each new event.
2. **Stable callbacks** at the `<ElementaryTable>` and `<Row>` level via the
   read-through-ref pattern. `getVisibleRows`, `getRowTreeLength`, `toggleCell`,
   `updateOpenedCell`, `onSubRowOpen` and `onSubRowClose` keep the same identity across
   renders. Without this, every vertical scroll re-rendered every cell because
   `toggleCell` had a new identity → `<Cell>` memoization broke on `onCallOpen`.
3. **`rowStyle` cache by `absolutePosition`** in `<ElementaryTable>`: rows fixed at the
   bottom (elevation `absolute`) reuse the same `{ bottom: N }` reference.

### Cache

- The `<Row>` colspan mapping is cached in a `WeakMap<ICell[], …>` — multiple rows that
  share the same `cells` array share the cache.
- `getVisibleItemIndexes` keeps a per-scroll-bucket cache of visible indexes, so scrolling
  back and forth across the same area is `O(1)`.

### Browser-level

- **CSS containment** (`contain: layout paint`) on `.table-overflow-wrapper` confines
  layout/paint passes to each cell's rectangle when the visible window changes.
- `:focus-visible` (not `:focus`) avoids a focus outline on mouse clicks but shows it on
  keyboard navigation — consistent with WCAG 2.4.7.

## Scroll position preservation

This is the bug-fix that triggered the v3.1 split from earlier v3 builds. Old behavior: when props change, the visible window resets to scrollTop=0 → the table jumps to the top. New behavior: the hook remembers the last applied scroll position via a ref and recomputes the window at that position when the cache invalidates.

The regression test lives in [`test/hooks/useVirtualizer.test.tsx`](../test/hooks/useVirtualizer.test.tsx) under `preserves scroll position when inputs change`.

## Performance characteristics

| Operation                        | Cost                                                                                    |
| -------------------------------- | --------------------------------------------------------------------------------------- |
| Visible window after a scroll    | `O(log n)` interpolation search + `O(visible)` index assembly, cached per scroll bucket |
| Cache rebuild on prop change     | `O(rowsLength + columnsLength)`                                                         |
| Initial mount                    | `O(rowsLength + columnsLength)`                                                         |
| `<Cell>` / `<Row>` memo decision | `O(props)` shallow + `O(small constant)` deep on listed fields                          |

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

## What's done

- **WAI-ARIA Grid semantics + keyboard navigation** following the W3C ARIA APG. See
  [accessibility docs](./accessibility.md).
- **Function components** everywhere; no class components.
- **`useVirtualizer` extracted** as a public hook for non-table layouts.
- **Performance** — see the section above.
