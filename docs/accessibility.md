# Accessibility

`<Table>` ships with WAI-ARIA Grid semantics and a built-in keyboard navigation conforming
to the [W3C ARIA APG: Grid pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/).

## ARIA structure

The component emits the following roles & attributes automatically:

| Element   | Role           | Attributes                                                                                             |
| --------- | -------------- | ------------------------------------------------------------------------------------------------------ |
| wrapper   | (none)         | `tabIndex={0}`, optional `aria-label` / `aria-labelledby`                                              |
| `<table>` | `grid`         | `aria-rowcount`, `aria-colcount`, `aria-multiselectable` (when selection is enabled)                   |
| `<thead>` | `rowgroup`     |                                                                                                        |
| `<tbody>` | `rowgroup`     |                                                                                                        |
| `<tr>`    | `row`          | `aria-rowindex` (1-based, absolute, NOT visible)                                                       |
| `<th>`    | `columnheader` | `aria-rowindex`, `aria-colindex`, `aria-colspan?`, `tabIndex={-1}`                                     |
| `<td>`    | `gridcell`     | `aria-rowindex`, `aria-colindex`, `aria-colspan?`, `aria-selected?`, `aria-expanded?`, `tabIndex={-1}` |

Counts and indexes are **absolute** (the full grid, including off-window items) — required
under virtualization so screen readers announce _"row 5 002 of 100 000"_ correctly.

`aria-selected` is emitted only on selectable cells when they're part of the active selection.

`aria-expanded` is emitted on cells that have `subItems` and reflects the open/closed state.

`aria-colspan` is emitted on cells with a `colspan > 1`.

## Keyboard navigation

The grid is a **single tab stop**. **Tab** focuses the grid → focus is delegated to the
_active_ cell (last focused, or the first body cell on initial entry). Arrow keys then move
the focus.

| Key                  | Action                                              |
| -------------------- | --------------------------------------------------- |
| Arrow keys           | Move focus by one cell (skips hidden rows/columns)  |
| Home / End           | Jump to start / end of the current row              |
| Ctrl+Home / Ctrl+End | Jump to top-left / bottom-right of the grid         |
| PageDown             | Move down by `keyboardPageSize` rows (skips hidden) |
| PageUp               | Move up by `keyboardPageSize` rows                  |
| Enter / Space        | Toggle expand/collapse on cells with sub-items      |
| Tab / Shift+Tab      | Leave the grid (one tab stop in/out)                |

When the target cell is **off the visible window** (under virtualization), the grid is
scrolled into view first, then focus is applied on the next animation frame once the cell
mounts. Pending scroll/focus is cancelled if the user keeps pressing keys, so only the
final position takes effect.

When the user **clicks** a cell, the click is recorded as the new active cell. Tabbing
out and back in restores focus to that cell.

### Hidden indexes

`virtualizerProps.hiddenRows` and `virtualizerProps.hiddenColumns` are skipped during
keyboard navigation — Arrow / PageDown / Home / End never land on a hidden index.

### Focus indicator

A 2px outline (`:focus-visible`) appears on the focused cell. Only visible during
keyboard-driven focus (not on mouse clicks), as per [WCAG 2.4.7](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html).

## Configuration

```tsx
<Table
  rows={rows}
  isVirtualized
  // Default: enabled
  disableKeyboardNavigation={false}
  // PageUp/Down step. Default: 10.
  keyboardPageSize={20}
  // Optional accessible name announced by screen readers when entering the grid.
  ariaLabel="Q4 Revenue by region"
  // …or reference an existing heading by id (mutually exclusive with ariaLabel).
  ariaLabelledBy="my-grid-heading"
/>
```

## Standalone hook

If you build a custom rendering on top of `useVirtualizer`, the keyboard logic is also
available standalone:

```tsx
import { useGridKeyboardNavigation } from "@pricemoov/react-table";

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

Test coverage in [`test/a11y/`](../test/a11y/) covers the ARIA structure, keyboard
navigation across hidden indexes, focus restoration, and the standalone hook.

For automated audits, the lib is **axe-core clean** when consumed with a screen-reader–accessible
heading nearby (so the grid has a label).

## Edge cases & defaults

- **Single-cell grids**: nav keys are no-ops.
- **Empty grids** (`rowsLength = 0`): the wrapper is still focusable; `focusCell` returns
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
