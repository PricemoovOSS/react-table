# `useVirtualizer` hook

`useVirtualizer` is the same engine that powers `<Table>` and `<Virtualizer>`, exposed as a pure hook so you can virtualize **any** layout — a list, a canvas, a custom DOM tree.

## Signature

```ts
function useVirtualizer(props: IUseVirtualizerProps): IUseVirtualizerResult;
```

### Inputs

| Field                                   | Type                  | Default                      | Description                                                                                              |
| --------------------------------------- | --------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------- |
| `width`, `height`                       | `number`              | required                     | Visible viewport.                                                                                        |
| `rowsLength`, `columnsLength`           | `number`              | required                     | Total number of items in each axis.                                                                      |
| `fixedRows`, `fixedColumns`             | `number[]`            | `[]`                         | Indexes pinned at the start or end.                                                                      |
| `hiddenRows`, `hiddenColumns`           | `number[]`            | `[]`                         | Indexes excluded from layout.                                                                            |
| `rowsCount`, `columnsCount`             | `number`              | derived from `min*Size`      | Force a number of items per viewport (overrides the natural fit).                                        |
| `minRowHeight`                          | `number`              | `56`                         | Used when items have no custom size.                                                                     |
| `minColumnWidth`                        | `number`              | `100`                        | Same, for columns.                                                                                       |
| `customCellsHeight`, `customCellsWidth` | `CustomSizesElements` | empty                        | Per-index size overrides + their fixed/scrollable counts.                                                |
| `verticalPadding`, `horizontalPadding`  | `number`              | `0`                          | Pre-allocated padding (e.g. for sticky headers).                                                         |
| `scrollbarSize`                         | `number`              | computed once at module load | Override if you draw your own scrollbars.                                                                |
| `overscan`                              | `number`              | `0`                          | Number of items to pre-render before/after the visible window. Higher = smoother scrolling, more memory. |

### Outputs

```ts
interface IUseVirtualizerResult {
  // The current visible window (clamped to data length, applies overscan)
  visibleRowIndexes: number[];
  visibleColumnIndexes: number[];
  elevatedRowIndexes: IElevateds;
  elevatedColumnIndexes: IElevateds;

  // Fixed indexes that are visible in the current window
  visibleFixedRowIndexes: number[];
  visibleFixedColumnIndexes: number[];

  // Layout
  cellHeight: number; // computed default item height
  cellWidth: number; // computed default item width
  virtualHeight: number; // total scrollable height
  virtualWidth: number; // total scrollable width

  // Drive new visible windows from the current scroll position.
  // Returns null if the window did not change (avoid re-renders).
  computeRowsState: (scrollTop: number) => { visibleRowIndexes; elevatedRowIndexes } | null;
  computeColumnsState: (scrollLeft: number) => { visibleColumnIndexes; elevatedColumnIndexes } | null;

  // First non-fixed visible row/column indexes (useful for sync banners or "go to current cell" UIs)
  getCursors: (rows, columns) => { rowsCursor: number; columnsCursor: number };

  // Translate an item index → a scroll position you can hand to your scroller
  getScrollLeftForColumnIndex: (i: number) => number | undefined;
  getScrollTopForRowIndex: (i: number) => number | undefined;
}
```

## A virtualized list (no `<Table>`)

```tsx
import * as React from "react";
import { useVirtualizer, Scroller, IScrollerHandle, getScrollAxes, bindScrollerToVirtualizer } from "@pricemoov/react-table";

type Item = { id: string; label: string };

export function VirtualList({ items }: { items: Item[] }) {
  const scrollerRef = React.useRef<IScrollerHandle>(null);
  const v = useVirtualizer({
    width: 400,
    height: 500,
    rowsLength: items.length,
    columnsLength: 1,
    minRowHeight: 40,
    overscan: 5,
  });
  const handlers = bindScrollerToVirtualizer(scrollerRef, v.getScrollLeftForColumnIndex, v.getScrollTopForRowIndex);

  return (
    <>
      <button onClick={() => handlers.scrollToRowIndex(items.length - 1)}>Go to end</button>
      <Scroller
        ref={scrollerRef}
        width={400}
        height={500}
        virtualWidth={v.virtualWidth}
        virtualHeight={v.virtualHeight}
        onScroll={(s) => {
          if (getScrollAxes(s).vertical) v.computeRowsState(s.scrollTop);
        }}
      >
        <ul style={{ padding: 0, margin: 0, listStyle: "none" }}>
          {v.visibleRowIndexes.map((i) => (
            <li key={items[i].id} style={{ height: v.cellHeight }}>
              {items[i].label}
            </li>
          ))}
        </ul>
      </Scroller>
    </>
  );
}
```

## A 2D virtualized grid

```tsx
const v = useVirtualizer({
  width: 800,
  height: 500,
  rowsLength: rowsCount,
  columnsLength: colsCount,
  fixedRows: [0],
  fixedColumns: [0],
  overscan: 2,
});

const onScroll = (s) => {
  const axes = getScrollAxes(s);
  if (axes.vertical) v.computeRowsState(s.scrollTop);
  if (axes.horizontal) v.computeColumnsState(s.scrollLeft);
};

return (
  <Scroller width={800} height={500} virtualWidth={v.virtualWidth} virtualHeight={v.virtualHeight} onScroll={onScroll}>
    <div style={{ position: "relative" }}>
      {v.visibleRowIndexes.map((rowIdx) =>
        v.visibleColumnIndexes.map((colIdx) => <Cell key={`${rowIdx}-${colIdx}`} row={rowIdx} col={colIdx} />),
      )}
    </div>
  </Scroller>
);
```

## Performance notes

- The hook **preserves the user's scroll position** when its inputs change (e.g. `rowsLength` grows, `fixedRows` is updated). It re-computes the visible window at the position the user is actually looking at, not at 0.
- Internal default arrays are frozen so consumers that don't memoize their `[]` literals don't break the cache memoization in unrelated paths.
- `computeRowsState` / `computeColumnsState` return `null` if the window did not change — the bundled `<Virtualizer>` uses this to skip re-renders.
- `overscan` is applied symmetrically and never duplicates fixed indexes.

## Companion exports

```ts
// True/false per axis from a scroll event
function getScrollAxes(scroll: IOnScroll): { vertical: boolean; horizontal: boolean };

// Build scrollToColumnIndex/scrollToRowIndex bound to a Scroller ref
function bindScrollerToVirtualizer(
  scroller: { current: IScrollerHandle | null },
  getScrollLeftForColumnIndex: (i: number) => number | undefined,
  getScrollTopForRowIndex: (i: number) => number | undefined,
): {
  scrollToColumnIndex: (i: number) => boolean;
  scrollToRowIndex: (i: number) => boolean;
};
```
