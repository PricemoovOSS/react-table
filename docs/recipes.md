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
import { Table, TableSelectionMenu, IMenuAction } from "@pricemoov/react-table";

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
import { Table, ITableHandle } from "@pricemoov/react-table";

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
import { EditableCell, IMask } from "@pricemoov/react-table";

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

## Tune keyboard navigation

Default keyboard navigation is already on. To customize it:

```tsx
<Table
  {...props}
  // Step ~viewport-rows on PageDown/PageUp instead of the 10-row default.
  keyboardPageSize={20}
/>
```

Disable it entirely on read-only or non-interactive grids:

```tsx
<Table {...props} disableKeyboardNavigation />
```

When disabled, the wrapper drops `tabIndex=0`, the grid is not a tab stop, and arrow keys
no longer move focus. Cells keep their ARIA roles for screen readers.
