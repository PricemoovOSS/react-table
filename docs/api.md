# API reference

> Source of truth: the `.d.ts` files generated under `dist/`. This page summarizes the public surface; for exhaustive shapes import the types and let your IDE inspect them.

## Table of contents

- [`<Table>`](#table)
- [`ITableHandle`](#itablehandle) — imperative API
- [`<Virtualizer>`](#virtualizer)
- [`IVirtualizerHandle`](#ivirtualizerhandle)
- [`<Scroller>`](#scroller)
- [`IScrollerHandle`](#iscrollerhandle)
- [`<ResponsiveContainer>`](#responsivecontainer)
- [Selection](#selection)
- [Styled cells](#styled-cells)
- [Table-interactions-manager](#table-interactions-manager)
- [Hooks](#hooks)
- [Constants](#constants)

---

## `<Table>`

```tsx
import { Table, ITableProps } from "@pricemoov/react-table";
```

| Prop                        | Type                                              | Default | Description                                                                                     |
| --------------------------- | ------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------- |
| `id`                        | `string`                                          | —       | Table identifier — used as a prefix for cell `data-testid`s.                                    |
| `rows`                      | `IRow[]`                                          | —       | Tree of rows. The first row may be marked `isHeader`.                                           |
| `columns`                   | `Record<number, IColumn>`                         | `{}`    | Per-column overrides keyed by index (size, style, className…).                                  |
| `rowsProps`                 | `Record<number, IRowOptions>`                     | `{}`    | Per-row overrides keyed by absolute index (size, …).                                            |
| `globalRowProps`            | `IRowOptions`                                     | —       | Defaults applied to every row.                                                                  |
| `globalColumnProps`         | `IColumnOptions`                                  | —       | Defaults applied to every column.                                                               |
| `isHeader`                  | `boolean`                                         | `false` | (per row) flags the row as a header → renders `<th>` cells.                                     |
| `isVirtualized`             | `boolean`                                         | `false` | Enables 2D virtualization. Requires either `virtualizerProps.{width,height}` or a sized parent. |
| `virtualizerProps`          | `IVirtualizerOptionalProps & { width?, height? }` | `{}`    | See [`<Virtualizer>`](#virtualizer).                                                            |
| `responsiveContainerProps`  | `{ className? }`                                  | `{}`    | Forwarded to the auto-`<ResponsiveContainer>` wrapper.                                          |
| `isSelectable`              | `boolean`                                         | `true`  | Enables the `<SelectionHandler>` wrapper.                                                       |
| `selectionProps`            | `ISelectionHandlerOptionalProps`                  | —       | Selection options + `menuComponent`.                                                            |
| `isSpan`                    | `boolean`                                         | `false` | Adds a span column on the left to toggle the first openable sub-tree.                           |
| `initialOpenedTrees`        | `ITrees`                                          | `{}`    | Sub-trees opened on mount. Uncontrolled.                                                        |
| `onOpenedTreesUpdate`       | `(trees: ITrees) => void`                         | —       | Notified each time a tree opens or closes.                                                      |
| `disableKeyboardNavigation` | `boolean`                                         | `false` | Disable the built-in keyboard navigation. See [accessibility docs](./accessibility.md).         |
| `keyboardPageSize`          | `number`                                          | `10`    | Number of rows stepped on PageUp / PageDown.                                                    |
| `ariaLabel`                 | `string`                                          | —       | Accessible name for the grid wrapper. Mutually exclusive with `ariaLabelledBy`.                 |
| `ariaLabelledBy`            | `string`                                          | —       | Id of an existing element that labels the grid (`aria-labelledby`).                             |

### Imperative API — `ITableHandle`

```tsx
const tableRef = useRef<ITableHandle>(null);
<Table ref={tableRef} {...props} />;
```

| Method            | Signature                             | Description                                                               |
| ----------------- | ------------------------------------- | ------------------------------------------------------------------------- |
| `goToColumnIndex` | `(i: number) => void`                 | Scroll so that column `i` is visible (clamped to `[0, columnsLength-1]`). |
| `goToRowIndex`    | `(i: number) => void`                 | Scroll so that row `i` is visible (clamped).                              |
| `goToColumnId`    | `(id: string) => void`                | Same, by header id; no-op if unknown.                                     |
| `getColumnIndex`  | `(id: string) => number \| undefined` | Header id → index.                                                        |
| `getColumnId`     | `(i: number) => string \| undefined`  | Index → header id.                                                        |
| `getCell`         | `(coords: ICellCoordinates) => ICell` | Get a cell from the current data tree.                                    |
| `openTrees`       | `(trees: ITrees) => void`             | Programmatically expand sub-trees.                                        |
| `closeTrees`      | `(trees: ITrees) => void`             | Programmatically collapse sub-trees.                                      |
| `getOpenedTrees`  | `() => ITrees`                        | Snapshot of currently open sub-trees.                                     |

---

## `<Virtualizer>`

Lower-level component used internally by `<Table>`. Use it when you want to virtualize anything that's **not** a `<table>` (a list, a canvas, a custom DOM tree).

```tsx
<Virtualizer height={500} width={800} rowsLength={10000} columnsLength={1}>
  {({ visibleRowIndexes, cellHeight }) => (
    <ul>
      {visibleRowIndexes.map((i) => (
        <li key={i} style={{ height: cellHeight }}>
          {items[i].label}
        </li>
      ))}
    </ul>
  )}
</Virtualizer>
```

| Prop                                         | Type                                                | Default                   |
| -------------------------------------------- | --------------------------------------------------- | ------------------------- |
| `width`, `height`                            | `number`                                            | required                  |
| `rowsLength`, `columnsLength`                | `number`                                            | required                  |
| `children`                                   | `(props: IVirtualizerChildrenProps) => JSX.Element` | required                  |
| `fixedRows`, `fixedColumns`                  | `number[]`                                          | `[]`                      |
| `hiddenRows`, `hiddenColumns`                | `number[]`                                          | `[]`                      |
| `rowsCount`, `columnsCount`                  | `number`                                            | derived                   |
| `minRowHeight`                               | `number`                                            | `DEFAULT_ROW_HEIGHT` (56) |
| `minColumnWidth`                             | `number`                                            | `MIN_COLUMN_WIDTH` (100)  |
| `customCellsHeight`, `customCellsWidth`      | `CustomSizesElements`                               | empty                     |
| `verticalPadding`, `horizontalPadding`       | `number`                                            | `0`                       |
| `initialScroll`                              | `{ columnIndex?, rowIndex? }`                       | `{}`                      |
| `onScroll`                                   | `(props: OnScrollProps) => void`                    | —                         |
| `onVerticallyScroll`, `onHorizontallyScroll` | per-axis variants                                   | —                         |

### `IVirtualizerHandle`

```ts
interface IVirtualizerHandle {
  scrollToColumnIndex: (i: number) => boolean;
  scrollToRowIndex: (i: number) => boolean;
}
```

---

## `<Scroller>`

Pure scrollable container. Tracks scroll origin (native vs. programmatic), reports per-axis edge reached, and exposes imperative scroll-to.

| Prop                            | Type                          | Description                                                                                                           |
| ------------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `width`, `height`               | `number`                      | Visible viewport.                                                                                                     |
| `virtualWidth`, `virtualHeight` | `number`                      | Total content size — drives the scrollbar.                                                                            |
| `horizontalPartWidth`           | `number`                      | Used to keep the relative scroll position stable when `virtualWidth` shrinks/grows because columns were hidden/shown. |
| `ignoredHorizontalParts`        | `number[]`                    | Tracked alongside `horizontalPartWidth`.                                                                              |
| `onScroll`                      | `(scroll: IOnScroll) => void` | Fired on every native or programmatic scroll.                                                                         |

### `IScrollerHandle`

```ts
interface IScrollerHandle {
  scrollToLeft: (left: number) => boolean; // returns true if it actually moved
  scrollToTop: (top: number) => boolean;
  getScrollValues: () => IOnScroll;
}
```

### `IOnScroll`

```ts
interface IOnScroll {
  directions: ScrollDirection[]; // up/down/left/right since last event
  scrollOrigin: ScrollOrigin; // "native" | "external"
  scrollTop: number;
  scrollLeft: number;
  maxTopReached: boolean;
  maxBottomReached: boolean;
  maxLeftReached: boolean;
  maxRightReached: boolean;
}
```

---

## `<ResponsiveContainer>`

Render-prop that observes its host `<div>` with `ResizeObserver` and forwards the measured size. Children render only once a non-zero size is available.

```tsx
<ResponsiveContainer>
  {({ width, height }) => <Virtualizer width={width} height={height} ... />}
</ResponsiveContainer>
```

---

## Selection

```tsx
import { SelectionHandler, ContextMenuHandler, TableSelectionMenu } from "@pricemoov/react-table";
```

`<SelectionHandler>` is the building block — it tracks selected cells through mouse events. `<TableSelectionMenu>` renders a menu with custom `IMenuAction`s anchored to the right-clicked cell.

```ts
interface IMenuAction {
  id: string;
  title: string;
  component: React.ComponentType<{ onClose(): void; selectedCells: ISelectedCells }>;
  menuItem?: React.ComponentType<{ children: React.ReactNode }>;
}

interface ISelectionHandlerOptionalProps {
  isDisabledVerticalSelection?: boolean;
  isDisabledHorizontalSelection?: boolean;
  menuComponent?: React.ComponentType<IMenuProps>;
}
```

---

## Styled cells

| Component                                                                     | Use                                                            |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `<Bubble badge type={info\|success\|warning\|error}>`                         | Decorative SVG bubble for badges.                              |
| `<HeaderCell title value badge isCurrent>`                                    | Two-line header with optional badge + bubble when `isCurrent`. |
| `<CellWithIcon value iconName tooltipTitle? onClick?>`                        | Text + (optional) action icon button.                          |
| `<EditableCell value initial_value mask formatValue onConfirmValue isEdited>` | Numeric editable cell with masking + percentage support.       |

Each one is a regular React component that you can pass as `cellContent` of an `ICell`.

---

## Table-interactions-manager

A higher-level wrapper that provides a context with row/column toggling controllers and a scroll cursor.

```tsx
import {
  TableInteractionsManager,
  TableInteractionsContext,
  ColumnVisibilityController,
  CellDimensionController,
  FixedColumnController,
  FixedRowController,
  ColumnIdScrollController,
  useTableInteractionsManager,
} from "@pricemoov/react-table";
```

Wrap your table with `<TableInteractionsManager>` and bind the controllers to the dispatched state via the context. See the Storybook stories under `Table interactions manager` for full examples.

---

## Hooks

```ts
import { useVirtualizer, useGridKeyboardNavigation, useComponent } from "@pricemoov/react-table";
```

### `useVirtualizer`

Pure virtualization engine (the same one that powers `<Virtualizer>`). Suited for any
layout that's not a `<table>` — lists, canvases, custom DOM. See
[the dedicated page](./use-virtualizer.md) for the full reference.

```ts
function useVirtualizer(props: IUseVirtualizerProps): IUseVirtualizerResult;
```

### `useGridKeyboardNavigation`

Standalone keyboard navigation for any DOM that exposes cells with
`data-cell-row` / `data-cell-col` attributes. Implements the W3C ARIA APG Grid pattern.

```ts
function useGridKeyboardNavigation(
  containerRef: React.RefObject<HTMLElement | null>,
  options?: IGridKeyboardNavigationOptions,
): IGridKeyboardNavigationResult;
```

| Option          | Type                 | Default    | Description                                                                                                                                      |
| --------------- | -------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `totalRows`     | `number`             | `Infinity` | Total row count (full grid, not visible window). Used for boundary clamping.                                                                     |
| `totalColumns`  | `number`             | `Infinity` | Total column count.                                                                                                                              |
| `pageSize`      | `number`             | `10`       | Step size on PageUp / PageDown.                                                                                                                  |
| `hiddenRows`    | `number[]`           | `[]`       | Row indexes to skip during navigation (kept in sync with `hiddenRows` prop).                                                                     |
| `hiddenColumns` | `number[]`           | `[]`       | Column indexes to skip.                                                                                                                          |
| `scrollToCell`  | `(row, col) => void` | —          | Called when the target cell is off the visible window. Bring it in via your scroll API; the hook re-tries the focus on the next animation frame. |
| `disabled`      | `boolean`            | `false`    | Turn the hook into a no-op.                                                                                                                      |

The hook returns:

```ts
{
  // Spread on your grid wrapper.
  containerProps: {
    tabIndex: 0;
    onKeyDown;
    onFocus;
  }
  // Move focus imperatively. Returns `true` if the cell was found in the DOM (or the
  // scroll request was issued for an off-window cell).
  focusCell: (row: number, col: number) => boolean;
}
```

See [accessibility docs](./accessibility.md#standalone-hook) for a full example.

### `useComponent`

Internal helper used by `<TableInteractionsManager>` to expose its mutable ref. Most
consumers don't need to call this directly.

---

## Constants

| Constant               | Value                                            |
| ---------------------- | ------------------------------------------------ |
| `DEFAULT_ROW_HEIGHT`   | `56`                                             |
| `MIN_COLUMN_WIDTH`     | `100`                                            |
| `DEFAULT_COLUMN_WIDTH` | `"auto"`                                         |
| `DEFAULT_COLSPAN`      | `1`                                              |
| `MAX_ROW_LEVEL`        | `2` (must match `$max-row-level` in `_row.scss`) |
| `ROW_SPAN_WIDTH`       | `110`                                            |
| `RowHeight`            | `{ small: 60, medium: 80, large: 100 }`          |
| `ColumnWidth`          | `{ small: 90, medium: 160, large: 230 }`         |
| `MouseClickButtons`    | `{ left: "left", right: "right" }`               |
