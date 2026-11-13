# Getting started

## Install

```bash
npm install @pricemoov-oss/react-table
```

The lib relies on **MUI** (5 or 6) for icon buttons, skeletons and menus. Install the peer dependencies:

```bash
npm install react react-dom @mui/material @emotion/react @emotion/styled
```

| Peer dep          | Range           |
| ----------------- | --------------- |
| `react`           | `^18.2`         |
| `react-dom`       | `^18.2`         |
| `@mui/material`   | `^5.15` or `^6` |
| `@emotion/react`  | `^11.11`        |
| `@emotion/styled` | `^11.11`        |

## Import the styles once

```ts
// app entry
import "@pricemoov-oss/react-table/dist/style/index.css";
```

If you bundle SCSS, you can also import the source:

```scss
@use "@pricemoov-oss/react-table/src/style/index";
```

## Render your first table

```tsx
import { Table, IRow } from "@pricemoov-oss/react-table";

const rows: IRow[] = [
  {
    id: "header",
    isHeader: true,
    cells: [
      { id: "framework", value: "Framework" },
      { id: "language", value: "Language" },
      { id: "year", value: "Year" },
    ],
  },
  {
    id: "react",
    cells: [
      { id: "framework", value: "React" },
      { id: "language", value: "TypeScript" },
      { id: "year", value: "2013" },
    ],
  },
  // ...
];

export function MyTable() {
  return <Table id="frameworks" rows={rows} />;
}
```

That's a static table. Add virtualization for large datasets:

```tsx
<Table
  id="frameworks"
  rows={rows}
  isVirtualized
  virtualizerProps={{
    height: 500,
    width: 1000,
    fixedRows: [0],
    fixedColumns: [0],
  }}
/>
```

Without `height`/`width`, the table wraps itself in a `<ResponsiveContainer>` and adapts
to its parent's measured size. **The parent must have an explicit size**, otherwise the
table renders nothing:

```tsx
<div style={{ height: "70vh", width: "100%" }}>
  <Table id="t" rows={rows} isVirtualized />
</div>
```

## Accessibility

The table announces its real size (`aria-rowcount`, `aria-colcount`) and the position of each row and
cell, even though only the visible window is in the page. Give it a name:

```tsx
<Table {...props} ariaLabel="Q4 revenue by region" />
```

Keyboard navigation between cells (arrow keys, Home / End, PageUp / PageDown) is opt-in:

```tsx
<Table {...props} keyboardNavigation />
```

See [accessibility.md](./accessibility.md) for the full reference.

## What's next

- [Recipes](./recipes.md) — common patterns
- [API reference](./api.md) — every prop, type and imperative method
- [Accessibility](./accessibility.md) — ARIA, keyboard, focus management
- [`useVirtualizer` hook](./use-virtualizer.md) — virtualize without `<Table>`
