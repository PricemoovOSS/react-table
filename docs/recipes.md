# Recipes

Practical snippets for the most common scenarios. Each recipe is self-contained and runs against the public API only.

- [Virtualize a 100k-row table](#virtualize-a-100k-row-table)
- [Fixed rows & columns](#fixed-rows--columns)
- [Hide rows or columns dynamically](#hide-rows-or-columns-dynamically)
- [Custom row heights / column widths](#custom-row-heights--column-widths)
- [Sub-rows (tree)](#sub-rows-tree)
- [Span column (single-toggle tree)](#span-column-single-toggle-tree)
- [Cell selection with a custom context menu](#cell-selection-with-a-custom-context-menu)
- [Scroll to an item programmatically](#scroll-to-an-item-programmatically)
- [Custom cell content (editable cells, badges…)](#custom-cell-content-editable-cells-badges)
- [Listen to scroll](#listen-to-scroll)
- [Read the current opened sub-rows](#read-the-current-opened-sub-rows)
- [Accessible label on the grid](#accessible-label-on-the-grid)
- [Tune keyboard navigation](#tune-keyboard-navigation)

---

## Virtualize a 100k-row table

```tsx
<Table id="big" rows={rows} isVirtualized virtualizerProps={{ height: 600, width: 1200 }} />
```

Without explicit `height`/`width`, the table fills its parent thanks to a built-in `<ResponsiveContainer>`:

```tsx
<div style={{ height: "100vh", width: "100%" }}>
  <Table id="big" rows={rows} isVirtualized virtualizerProps={{ fixedRows: [0] }} />
</div>
```

## Fixed rows & columns

```tsx
<Table
  id="t"
  rows={rows}
  isVirtualized
  virtualizerProps={{
    height: 500,
    width: 1000,
    fixedRows: [0], // header pinned at the top
    fixedColumns: [0, 1], // first two columns pinned at the left
  }}
/>
```

You can pin rows/columns **at the end** too: include their index in `fixedRows` / `fixedColumns`. Indexes are interpreted relative to the rendered tree (i.e. `0` is the absolute first item).

## Hide rows or columns dynamically

```tsx
const [hiddenColumns, setHiddenColumns] = useState<number[]>([]);

<Table id="t" rows={rows} isVirtualized virtualizerProps={{ height: 500, width: 1000, hiddenColumns }} />;
```

Hidden indexes are excluded from layout (no DOM, no horizontal/vertical space). Toggling them preserves the user's scroll position.

## Custom row heights / column widths

Per-cell overrides go on the row/column themselves :

```tsx
const rows: IRow[] = [
  { id: "header", isHeader: true, cells: [...] },           // default DEFAULT_ROW_HEIGHT (56)
  { id: "compact", size: 32, cells: [...] },                // overridden
];

<Table
  id="t"
  rows={rows}
  columns={{
    0: { size: 200 },     // first column is 200px
    3: { size: 120 },
  }}
  isVirtualized
  virtualizerProps={{ height: 500, width: 1000 }}
/>
```

> The virtualizer knows about custom sizes through `customCellsHeight`/`customCellsWidth`. `<Table>` derives them automatically from `rowsProps` and `columns`.

## Sub-rows (tree)

```tsx
const rows: IRow[] = [
  {
    id: "back",
    cells: [
      { id: "lang", value: "Languages" },
      {
        id: "list",
        value: "Click to expand",
        subItems: [
          { id: "py", cells: [{ id: "n", value: "Python" }] },
          { id: "go", cells: [{ id: "n", value: "Go" }] },
          { id: "rs", cells: [{ id: "n", value: "Rust" }] },
        ],
      },
    ],
  },
];

<Table id="t" rows={rows} initialOpenedTrees={{ 0: { rowIndex: 0, columnIndex: 1 } }} />;
```

Cells with `subItems` get a chevron to expand/collapse. `initialOpenedTrees` opens specific sub-trees on mount.

## Span column (single-toggle tree)

When `isSpan` is enabled, the first openable sub-tree of each row is exposed via a left-side span column. Clicking it expands/collapses **the first cell that has subItems**.

```tsx
<Table id="t" rows={rows} isSpan />
```

Each row may customize the span column:

```tsx
{ id: "row1", rowSpanProps: { title: "Q4", color: "#0082c3" }, cells: [...] }
```

## Cell selection with a custom context menu

```tsx
import { Table, TableSelectionMenu, IMenuAction } from "@pricemoov-oss/react-table";

const actions: IMenuAction[] = [
  { id: "copy", title: "Copy", component: ({ onClose }) => <CopyDialog onClose={onClose} /> },
  { id: "edit", title: "Edit", component: ({ onClose }) => <EditDialog onClose={onClose} /> },
];

const Menu = (props) => <TableSelectionMenu {...props} actions={actions} />;

<Table id="t" rows={rows} selectionProps={{ menuComponent: Menu }} />;
```

Disable extension on one axis:

```tsx
<Table
  id="t"
  rows={rows}
  selectionProps={{ isDisabledVerticalSelection: true }} // row-only selection
/>
```

## Scroll to an item programmatically

```tsx
import { Table, ITableHandle } from "@pricemoov-oss/react-table";

const tableRef = React.useRef<ITableHandle>(null);

<button onClick={() => tableRef.current?.goToColumnId("revenue_q4")}>
  Jump to Q4
</button>
<Table ref={tableRef} {...props} />
```

| Method                                   | Description                                                                           |
| ---------------------------------------- | ------------------------------------------------------------------------------------- |
| `goToColumnIndex(i)`                     | Scroll horizontally so that column `i` is visible (clamped to `[0, columnsLength-1]`) |
| `goToRowIndex(i)`                        | Scroll vertically so that row `i` is visible (clamped)                                |
| `goToColumnId(id)`                       | Same, by column header `id` (no-op if id unknown)                                     |
| `getColumnIndex(id)`                     | Resolve a header id to its index                                                      |
| `getColumnId(i)`                         | Resolve an index to its header id                                                     |
| `getCell({ rowIndex, cellIndex })`       | Read a cell from the current data tree                                                |
| `openTrees(trees)` / `closeTrees(trees)` | Programmatically expand/collapse                                                      |
| `getOpenedTrees()`                       | Read the current open-state snapshot                                                  |

## Custom cell content (editable cells, badges…)

```tsx
import { EditableCell, IMask } from "@pricemoov-oss/react-table";

const mask: IMask = { decimals: 2, is_percentage: false, is_negative: false };

<Table
  id="t"
  rows={[
    {
      id: "r1",
      cells: [
        {
          id: "amount",
          cellContent: EditableCell,
          cellContentProps: {
            mask,
            initial_value: 0,
            value: 12.34,
            isEdited: false,
            formatValue: (v) => v?.toFixed(2) ?? "-",
            onConfirmValue: (v) => console.log("confirmed:", v),
          },
        },
      ],
    },
  ]}
/>;
```

Any React component is accepted. The component receives `id`, `index`, `rowIndex`, `relativeRowIndex`, `isSelected`, `dataCoordinates`, `loading` and the spread of `cellContentProps`.

The library ships four ready-made cells: `EditableCell`, `HeaderCell`, `CellWithIcon`, `Bubble`.

## Listen to scroll

```tsx
<Table
  id="t"
  rows={rows}
  isVirtualized
  virtualizerProps={{
    height: 500,
    width: 1000,
    onScroll: ({ scrollValues, newRowsState, rowsCursor }) => {
      // rowsCursor is the first non-fixed visible row absolute index
      console.log("cursor row:", rowsCursor);
    },
    // Or the axis-specific variants:
    onVerticallyScroll: (...) => {},
    onHorizontallyScroll: (...) => {},
  }}
/>
```

`scrollOrigin` distinguishes user-initiated scroll (`"native"`) from programmatic scroll (`"external"`). Useful to debounce auto-fetch logic.

## Read the current opened sub-rows

```tsx
const tableRef = React.useRef<ITableHandle>(null);

const dump = () => console.log(tableRef.current?.getOpenedTrees());

<Table
  ref={tableRef}
  id="t"
  rows={rows}
  initialOpenedTrees={{}}
  onOpenedTreesUpdate={(trees) => console.log("opened:", trees)}
/>;
```

Use `onOpenedTreesUpdate` for reactive logic, `getOpenedTrees()` for one-shot reads.

## Accessible label on the grid

Screen readers announce the grid's role and dimensions when it receives focus. Give it an
accessible name via either a sibling heading (recommended) or `ariaLabel` / `ariaLabelledBy`:

```tsx
// Option 1 — referenced heading
<h2 id="q4-revenue-title">Q4 Revenue</h2>
<Table {...props} ariaLabelledBy="q4-revenue-title" />

// Option 2 — direct label, if no heading is available
<Table {...props} ariaLabel="Q4 Revenue by region" />
```

A short label beats a long one. _"Q4 Revenue"_ is enough — screen readers append _"grid,
50 rows, 10 columns"_ automatically.

See [accessibility.md](./accessibility.md) for the full ARIA / keyboard reference.

## Keyboard navigation

Off by default. Turn it on to move between cells with the arrow keys, Home / End and PageUp / PageDown:

```tsx
<Table
  {...props}
  keyboardNavigation
  // Rows stepped on PageDown / PageUp. Default: 10.
  keyboardPageSize={20}
/>
```

Keys typed in a field or a button inside a cell are left to that element; Escape returns to the cell.

## Column groups

```tsx
<Table
  {...props}
  groups={[
    { id: "identity", label: "Identity" },
    {
      id: "prices",
      label: "Prices",
      subGroups: [
        { id: "current", label: "Current" },
        { id: "next", label: "Next" },
      ],
    },
  ]}
  columns={{ 0: { groupId: "identity" }, 1: { groupId: "current" }, 2: { groupId: "next" } }}
  groupsProps={{ rowsOptions: { size: 30 } }}
/>
```

The group headers are recomputed from the visible columns: they follow the horizontal scroll, and the group
of a column fixed on the right stays above it. A custom cell goes in `groupsProps.CustomGroupCell`; apply the
`className` and `style` it receives on its `<th>`.

## Load the next page when the bottom is reached

```tsx
const loadNextPage = React.useCallback(
  ({ scrollValues: { maxBottomReached, directions } }: OnVerticallyScrollProps) => {
    if (maxBottomReached && directions.includes(ScrollDirection.down) && hasNext && !isLoading) loadMore();
  },
  [hasNext, isLoading, loadMore],
);

<Table {...props} isVirtualized virtualizerProps={{ fixedRows: [0], onVerticallyScroll: loadNextPage }} />;
```

`virtualizerProps.scrollEndThreshold` (5 pixels by default) sets how close to the bottom the scroll must be:
raise it to ask for the page earlier.

## Insert, remove and update rows and columns

Give the table its new `rows` (and `columns` options): there is no call to make to tell it what changed.
What makes a change cheap is what the application hands back for the part that did **not** change.

```tsx
// one row updated: every other row is the object the table already had
setRows((rows) => rows.map((row) => (row.id === id ? { ...row, cells: withValue(row.cells, columnId, value) } : row)));
```

| Change                                         | What the table renders                                                     |
| ---------------------------------------------- | -------------------------------------------------------------------------- |
| A value updated, same cell objects around      | That cell                                                                  |
| A row updated                                  | The cells of the row that are new objects                                  |
| A column updated                               | One cell per displayed row                                                 |
| A row out of the window updated                | Nothing                                                                    |
| A row inserted or removed under the window     | Nothing; the scroll range follows                                          |
| A row inserted or removed above the window     | The cells of the window once: each one now belongs to another row index    |
| A column inserted or removed before the window | The cells of the window once: each one now belongs to another column index |

- **Ids make the difference.** Rows and cells are matched by `id`: the state of a cell content (an input
  being edited, an opened menu) follows its row when rows are inserted or removed above it. Reused or
  index-based ids move that state to another row.
- **The scroll position is kept.** After an insertion above the window, the window shows the same indexes,
  so the rows that moved in. When the content gets shorter than the scroll position, the browser brings the
  scroll back to the new end and the window follows; it never stays empty.
- **A cell that is a new object is rendered**, even with the same content: `cellContentProps` and
  `dataCoordinates` are compared by identity. Keep the cell objects of what did not change (see
  `toTableRows` in `stories/stories-components/live-data.tsx`), or keep these two objects stable.
- **Options given by index follow the indexes, not the data**: `columns`, `rowsProps`, `fixedColumns`,
  `hiddenColumns`, opened rows. Rebuild them with the data — the same content is recognised and costs
  nothing. Through `TableInteractionsManager`, columns are pinned and hidden by **id** and follow their
  column on their own.
- **Opened rows are addressed by row index.** When rows are inserted or removed above an opened row, move
  its tree (`getOpenedTrees`, `closeTrees`, `openTrees`) once the new rows are in the table; a tree whose
  row has no sub rows any more is dropped. `shiftTrees` in the same story file does it.

The cost of a change does not depend on the number of rows: updating one value among 20 000 rows computes
nothing over the rows. The "Recipes/Live data" stories let you try every case, with a meter of what each
change renders.

## Share the state of the table with a toolbar

`TableInteractionsManager` holds the hidden and fixed columns, the hidden rows and the columns cursor, and
gives access to the handle of the table. Pass `tableRef` as the `ref` of the table:

```tsx
function PricesTable() {
  const { tableRef, fixedColumnsIndexes, hiddenColumnsIndexes, hiddenRowIndexes, onHorizontallyScroll } =
    useTableInteractionsManager();
  return (
    <Table
      {...props}
      ref={tableRef}
      isVirtualized
      virtualizerProps={{
        fixedRows: [0],
        fixedColumns: [0, ...fixedColumnsIndexes],
        hiddenColumns: hiddenColumnsIndexes,
        hiddenRows: hiddenRowIndexes,
        onHorizontallyScroll,
      }}
    />
  );
}

function PinButton({ columnId }: { columnId: string }) {
  const { fixedColumnsIds, updateFixedColumnsIds } = useTableInteractionsManager();
  return <button onClick={() => updateFixedColumnsIds([...fixedColumnsIds, columnId])}>Pin</button>;
}

<TableInteractionsManager toggleableColumns={columns} initialConfig={{ hiddenColumnsIds: [] }}>
  <PinButton columnId="total" />
  <PricesTable />
</TableInteractionsManager>;
```

The id of a column is the `id` of its cell in the first row. The **Recipes / Application table** story of
Storybook is a complete example: groups, pinned columns, paging, rows opened from a toolbar.
