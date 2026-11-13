# Theming

The table is adapted at three levels, from the lightest to the deepest:

1. [CSS custom properties](#css-custom-properties) for colors, reliefs and separators;
2. [classes and styles](#classes-and-styles) on rows, columns and cells;
3. [components](#replaceable-components) you provide for the parts the table renders itself.

## CSS custom properties

Set them on the table or on any element around it. A property that is not set keeps its default value,
so a table without theme looks the same as before these properties existed.

```css
.my-table {
  --rt-column-separator-color: #e4e6e8;
  --rt-elevation-color: rgba(0, 0, 0, 0.2);
  --rt-focus-ring-color: #3355dd;
}
```

```tsx
<div className="my-table" style={{ height: 600 }}>
  <Table {...props} />
</div>
```

| Property                             | Default                              | Role                                                                                 |
| ------------------------------------ | ------------------------------------ | ------------------------------------------------------------------------------------ |
| `--rt-elevation-color`               | `rgba(0, 0, 0, 0.12)`                | Relief of the columns fixed on the right, and of the fixed columns on the group rows |
| `--rt-elevation-size`                | `6px`                                | Width of that relief                                                                 |
| `--rt-elevation-start-column-shadow` | `0 0 7px 2px rgba(0, 0, 0, 0.5)`     | Relief of the columns fixed on the left (a `box-shadow`)                             |
| `--rt-elevation-start-row-shadow`    | `0 7px 7px -10px rgba(0, 0, 0, 0.5)` | Relief under the rows fixed at the top (a `box-shadow`)                              |
| `--rt-elevation-end-row-shadow`      | `0 -2px 7px -6px rgba(0, 0, 0, 0.5)` | Relief above the rows fixed at the bottom (a `box-shadow`)                           |
| `--rt-row-separator-color`           | `rgba(236, 236, 236, 0.5)`           | Line between two rows                                                                |
| `--rt-column-separator-color`        | `transparent`                        | Line between two columns — none by default                                           |
| `--rt-fixed-background`              | `#fff`                               | Background of the columns fixed on the right and of the rows fixed at the bottom     |
| `--rt-selected-background`           | `rgba(2, 171, 255, 0.1)`             | Background of a selected cell                                                        |
| `--rt-header-color`                  | `rgba(0, 0, 0, 0.54)`                | Text of the header cells                                                             |
| `--rt-focus-ring-color`              | `#0082c3`                            | Outline of the cell focused with the keyboard                                        |
| `--rt-sub-row-connector-color`       | `#aaa`                               | Lines that tie the sub rows to their parent                                          |

The **Table / Theming** story of Storybook has a control for each property.

### Reliefs of the fixed items

A relief marks the edge of what stays on screen while the rest scrolls. It is drawn on every kind of row:
group rows, header, body, sub rows and rows fixed at the bottom.

| Fixed items          | Property                                      | To remove it  |
| -------------------- | --------------------------------------------- | ------------- |
| Columns on the left  | `--rt-elevation-start-column-shadow`          | `none`        |
| Columns on the right | `--rt-elevation-color`, `--rt-elevation-size` | `transparent` |
| Rows at the top      | `--rt-elevation-start-row-shadow`             | `none`        |
| Rows at the bottom   | `--rt-elevation-end-row-shadow`               | `none`        |

The columns fixed on the right and the rows fixed at the bottom cover what scrolls under them: they need an
opaque background. If your table is not on a white surface, set `--rt-fixed-background` to its color.

On the group rows, the relief of the left fixed columns appears where a group ends with the last fixed
column. A group that covers both fixed and scrolling columns has no edge to mark.

## Classes and styles

Every level accepts a class and a style, and the more specific wins:

```tsx
<Table
  id="prices"
  rows={rows}
  globalColumnProps={{ className: "numeric", style: { justifyContent: "flex-end" } }}
  columns={{ 0: { className: "name", size: 240 } }}
  rowsProps={{ 0: { size: 56 } }}
/>
```

- a row has `className` and `size`; a cell has `className`, `style` and `getClassName(cellProps)` when the
  class depends on the state of the cell;
- the table sets these classes, which you can target: `table-root`, `table-row`, `table-column`, `head`,
  `sub-row`, `selected`, `table-sub-cell`, `table-group`, `table-groups-row`, `elevated-start` (the last item
  fixed at the start), `elevated-absolute` (an item fixed at the end), `elevated-absolute-edge` (the first
  column fixed at the end, which draws their relief) and, on a group cell, `elevated-start-edge` (the group
  above the last column fixed at the start).

## Replaceable components

| Part                           | Property                                    | Receives                                                                                                                                                   |
| ------------------------------ | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Content of a cell              | `cell.cellContent`, `cell.cellContentProps` | `IContentCellProps`: `id`, `index`, `rowIndex`, `relativeRowIndex`, `isSelected`, `dataCoordinates`, `loading`, the `value` of the cell and your own props |
| Group cell                     | `groupsProps.CustomGroupCell`               | `GroupCellProps`: `group`, `className`, `style`, `index`, `groups`                                                                                         |
| Button that opens the sub rows | `SubRowsToggleButtonComponent`              | `SubRowsToggleButtonComponentProps`: `opened`, `onClick`, `tabIndex`                                                                                       |
| Context menu of the selection  | `selectionProps.menuComponent`              | `isMenuOpened`, `selectedCells`, `selectionContext` (anchor and cell of the click), `closeMenu`                                                            |

A custom group cell renders the `<th>` itself. Spread what it receives, or the group of a column fixed on the
right will not be placed above it:

```tsx
function GroupCell({ className, group, style }: GroupCellProps) {
  return (
    <th className={className} colSpan={group.size} style={style}>
      {group.label}
    </th>
  );
}
```

The default sub-rows toggle and the loading placeholder use Material UI. Replacing the toggle and giving your
own `cellContent` (which receives `loading`) removes the Material UI elements from the cells. The span column
(`isSpan`) and the ready-made selection menu also use Material UI.
