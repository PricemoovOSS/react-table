# Getting started

## Install

```bash
npm install @pricemoov/react-table
```

The lib relies on **MUI v5** for icon buttons, skeletons and menus. Install the peer dependencies:

```bash
npm install react react-dom @mui/material @mui/icons-material @emotion/react @emotion/styled
```

| Peer dep              | Range    |
| --------------------- | -------- |
| `react`               | `^18.2`  |
| `react-dom`           | `^18.2`  |
| `@mui/material`       | `^5.15`  |
| `@mui/icons-material` | `^5.15`  |
| `@emotion/react`      | `^11.11` |
| `@emotion/styled`     | `^11.11` |

## Import the styles once

```ts
// app entry
import "@pricemoov/react-table/dist/style/index.css";
```

If you bundle SCSS, you can also import the source:

```scss
@use "@pricemoov/react-table/src/style/index";
```

## Render your first table

```tsx
import { Table, IRow } from "@pricemoov/react-table";

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

The grid is **keyboard-navigable** out of the box (Tab in, arrow keys, Home/End,
PageUp/Down, Enter to expand sub-rows). It exposes the W3C ARIA Grid roles
(`role="grid"`, `aria-rowcount`, `aria-colcount`, …) — screen readers announce row counts
correctly even under virtualization. Give the grid an accessible name:

```tsx
<Table {...props} ariaLabel="Q4 revenue by region" />
```

See [accessibility.md](./accessibility.md) for the full reference.

## What's next

- [Recipes](./recipes.md) — common patterns
- [API reference](./api.md) — every prop, type and imperative method
- [Accessibility](./accessibility.md) — ARIA, keyboard, focus management
- [`useVirtualizer` hook](./use-virtualizer.md) — virtualize without `<Table>`
