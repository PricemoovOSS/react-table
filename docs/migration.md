# Migrating from 4.x to 5.0

5.0 rewrites the components as function components and fixes the layout of the fixed items. What a table
renders is the same as in 4.0.2, except for the points below.

## What you have to change

### References

`Table`, `Virtualizer` and `Scroller` are no longer classes. A `ref` gives a handle with the public methods,
not an instance:

```tsx
// 4.x
const table = React.useRef<Table>(null);
// 5.0
const table = React.useRef<ITableHandle>(null);
```

The methods keep their names: `openTrees`, `closeTrees`, `goToColumnIndex`, `goToRowIndex`, `goToColumnId`,
`getColumnIndex`, `getColumnId`, `getCell`. `getOpenedTrees` is new. Reading `table.current.state` or
`table.current.props` no longer works.

The handle is created once: it does not change when the rows change. `useTableInteractionsManager().tableRef`
is still what you pass as `ref`.

### Custom group cell

The group of a column fixed on the right now has its own cell, placed above the column. A custom group cell
must apply the `style` it receives, in addition to `className`:

```tsx
<th className={className} colSpan={group.size} style={style}>
```

A group that covers both scrolling columns and columns fixed on the right is rendered as two cells.

### Styles

- Columns fixed on the right now have a relief on every row, drawn by the table. If your stylesheet drew
  one, remove it — or keep yours and set `--rt-elevation-color: transparent`.
- A custom group cell that computes its own width has to count the columns of its own cell only
  (`group.size` of them): a group partly fixed on the right is rendered as two cells. The cell above the
  fixed columns takes its width from `group.fixedEnd.width`.
- The table can draw the column separators: `--rt-column-separator-color`. See [Theming](./theming.md).
- The class `elevated-end` is not set any more (it was already the case in 4.0.2): rules that target it
  never apply.

### Tests and snapshots

- Rows carry `role="row"` and `aria-rowindex`, cells `aria-colindex` (and `aria-colspan` when they span
  columns), the table `aria-rowcount` / `aria-colcount`, the responsive container
  `data-testid="responsive-container"`: snapshots of the rendered table change.
- New classes: `elevated-absolute-edge` on the first column fixed on the right, on every row;
  `elevated-start-edge` on the group cell above the last column fixed on the left. A group cell above columns
  fixed on the right carries `elevated-absolute` and receives a `style`.
- A window that fits exactly N columns (or rows) renders N of them. 4.x rendered one more, which nobody could
  see: counts of rendered cells change in that case.
- A cell without selection, sub rows nor keyboard navigation has no mouse handler any more: a test that
  spied on them through the cell element has nothing to call.
- The handle given to the `ref` of the table is the same object for the life of the table. It reads the
  current rows, also while they are being rendered.
- `rows` and the options are read as values that do not change: give a new array or object when their
  content changes. Rows appended to the same array are still seen at the next render (by their number); a
  row replaced inside the same array is not — 4.x rendered everything at each render of the parent and saw it.

## What changes without action

| Behaviour                                        | 4.x                                                                        | 5.0                                                                                |
| ------------------------------------------------ | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `onOpenedTreesUpdate`                            | Called with a stale state when two changes were requested in the same tick | Called once per change, after the render, each change building on the previous one |
| Removing `groups` at runtime                     | Row height updated one render late                                         | Updated at once                                                                    |
| `virtualizerProps` and its arrays written inline | Recomputed the window at every render of the parent                        | Compared by content: no work when nothing changed                                  |
| Frame that shows a scroll step                   | The one after the scroll event                                             | The one of the scroll event (`synchronousScrollRendering`, on by default)          |
| `initialScroll`, `goToRowIndex`, `goToColumnId`… | The window moved at the next update of the table                           | The window moves at once                                                           |

## New, off by default

- `keyboardNavigation`: arrow keys, Home / End, PageUp / PageDown between cells, with grid semantics.
  See [Accessibility](./accessibility.md).
- `virtualizerProps.scrollEndThreshold`: how close to the bottom or right edge the scroll handlers report
  `maxBottomReached` / `maxRightReached` (5 pixels by default).
- CSS custom properties for colors, reliefs and separators.

## New, on by default

- ES modules: bundlers that read the `module` field (Vite, webpack, Rollup) now load `dist/esm` and
  tree-shake it. Node and jest keep loading CommonJS through `main`. Nothing to change in the imports.

- `virtualizerProps.synchronousScrollRendering`: the new window is rendered inside the scroll event
  (`flushSync`). Set it to `false` if your application needs React to schedule that render.

## Types

| 4.x                                                              | 5.0                                                                                                                             |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `React.RefObject<Table>`                                         | `React.RefObject<ITableHandle>`                                                                                                 |
| `IState` (table state)                                           | removed                                                                                                                         |
| `useTableInteractionsManager().tableRef: (table: Table) => void` | `(table: ITableHandle \| null) => void`                                                                                         |
| —                                                                | `ITableHandle`, `IVirtualizerHandle`, `IScrollerHandle`, `IUseVirtualizerProps`, `IUseVirtualizerResult`, `GroupFixedEndLayout` |
