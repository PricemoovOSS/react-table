# Accessibility

A table is always a table for assistive technologies. Keyboard navigation between cells, and the grid
semantics that go with it, are turned on with `keyboardNavigation`.

## Without keyboard navigation (default)

The table is a native `<table>`: rows, header cells and cells keep their native roles. Because only the
visible window is in the page, the table also announces positions in the whole data:

| Element        | Attributes                                                                           |
| -------------- | ------------------------------------------------------------------------------------ |
| `<table>`      | `aria-rowcount`, `aria-colcount`, `aria-label` or `aria-labelledby` if you give them |
| `<tr>`         | `aria-rowindex` (1-based, in the whole table)                                        |
| `<th>`, `<td>` | `aria-colindex` (1-based, in the whole table), `aria-colspan` when it spans columns  |

The button that opens the sub rows of a cell is in the tab order and carries `aria-expanded`.
Everything interactive you render in a cell is reached with Tab, as in any page.

Give the table a name:

```tsx
<h2 id="prices-title">Prices</h2>
<Table {...props} ariaLabelledBy="prices-title" />
// or, without a heading
<Table {...props} ariaLabel="Prices by region" />
```

## With keyboard navigation

```tsx
<Table {...props} keyboardNavigation keyboardPageSize={20} />
```

Choose it when the table mounts. Switching `keyboardNavigation` on or off later puts the table in, or out
of, the element that takes the focus: the table is mounted again, and its scroll position and the state of
its cell contents are lost.

The table follows the [grid pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/) of the ARIA Authoring
Practices:

| Element   | Role           | Added attributes                                                          |
| --------- | -------------- | ------------------------------------------------------------------------- |
| container | —              | `tabIndex={0}`: the one Tab stop of the grid                              |
| `<table>` | `grid`         | `aria-multiselectable` when cells can be selected                         |
| `<th>`    | `columnheader` | `tabIndex={-1}`                                                           |
| `<td>`    | `gridcell`     | `tabIndex={-1}`, `aria-selected`, `aria-expanded` on a cell with sub rows |

| Key                  | Action                                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------------------------- |
| Tab                  | Enters the grid on the active cell (the last one focused, or the first cell of the body), and leaves it |
| Arrow keys           | Move by one cell, skipping hidden rows and columns                                                      |
| Home / End           | First / last cell of the row                                                                            |
| Ctrl+Home / Ctrl+End | First / last cell of the grid                                                                           |
| PageUp / PageDown    | Move by `keyboardPageSize` rows (10 by default)                                                         |
| Enter / Space        | Open or close the sub rows of the cell                                                                  |
| Escape               | From a field or a button inside a cell, back to the cell                                                |

- **A cell outside the window** is brought into view, then focused once it is rendered. The focus is never
  lost meanwhile, and keys pressed in the meantime start from the target.
- **Content of a cell.** Keys typed in a field, a button or any other element rendered inside a cell belong
  to that element: the grid does not handle them. Escape gives the focus back to the cell. Such elements stay
  in the tab order.
- **A table inside a cell** is a grid of its own: its keys do not move the outer grid.
- **Focus indicator.** The focused cell gets an outline when the focus comes from the keyboard
  (`:focus-visible`). Its color is `--rt-focus-ring-color`.

Leave the navigation off when the cells are mostly made of your own interactive content and Tab is enough.

## Standalone hook

If you build a custom rendering on top of `useVirtualizer`, the keyboard logic is also
available standalone:

```tsx
import { useGridKeyboardNavigation } from "@pricemoov-oss/react-table";

const wrapperRef = React.useRef<HTMLDivElement>(null);
const { containerProps, focusCell } = useGridKeyboardNavigation(wrapperRef, {
  totalRows: rows.length,
  totalColumns: cols.length,
  pageSize: 10,
  hiddenRows: [3, 7],
  hiddenColumns: [],
  scrollToCell: (row, col) => myScrollImpl(row, col),
});

return (
  <div ref={wrapperRef} {...containerProps}>
    {/* Cells must carry data-cell-row / data-cell-col + tabIndex=-1 */}
  </div>
);
```

`focusCell(row, col)` is exposed if you need to move focus programmatically — e.g.
to focus the first cell of a freshly loaded page.

## Compliance & verification

The implementation has been built against:

- [W3C ARIA Authoring Practices: Grid pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/)
- [WCAG 2.2 SC 2.1.1 Keyboard](https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html)
- [WCAG 2.2 SC 2.4.3 Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html)
- [WCAG 2.2 SC 2.4.7 Focus Visible](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html)
- [WCAG 2.2 SC 4.1.2 Name, Role, Value](https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html)

[`test/a11y/`](../test/a11y/) covers the attributes, the navigation across hidden indexes, the focus
restoration and the content of cells. [`test/browser/keyboard.spec.ts`](../test/browser/keyboard.spec.ts)
checks, in a real browser, that the focus survives rows that are not rendered yet.

No audit with a screen reader has been run on this version.

## Edge cases & defaults

- **Single-cell grids**: nav keys are no-ops.
- **Empty grids** (`rowsLength = 0`): the container is still focusable; `focusCell` returns
  `false`.
- **Span column** (when `isSpan` is true): the leftmost `<td>` is a UI affordance, not a
  cell — it has no `data-cell-row` / `data-cell-col` and is invisible to keyboard nav.
  Use Enter/Space on the focused cell instead.

## Limitations (open issues)

- **Live region announcements on row expansion**: the `aria-expanded` attribute is
  updated; an additional `aria-live="polite"` announcement ("3 rows revealed") would
  improve verbosity but isn't strictly needed.
- **Type-ahead navigation** (jump to a row by typing the first character of its content)
  is not implemented.
- **Row-level selection announcements**: `aria-selected` is set per-cell; an extra
  `aria-selected` on the row itself isn't emitted.
- **Drag selection feedback via screen reader**: drag-to-select works visually but does
  not emit a verbal cue when the selection rectangle grows.

If your use case needs any of these, open an issue.
