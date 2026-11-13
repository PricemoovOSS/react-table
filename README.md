# @pricemoov-oss/react-table

[![npm](https://img.shields.io/npm/v/@pricemoov-oss/react-table.svg)](https://www.npmjs.com/package/@pricemoov-oss/react-table)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

React components that render very large tables. Only the rows and columns on screen are in the page:
the cost of a scroll step depends on the size of the window, not on the size of the data.

<img src="images/table.png" width="1200" alt="A virtualized table of 15 000 rows and 1 000 columns, with fixed rows and columns and opened sub rows"/>

## Features

- **Rows and columns virtualized** — the visible window is rendered, nothing else.
- **Fixed rows and columns**, at the start or at the end, with a relief that shows where they end.
- **Hidden rows and columns**, custom heights and widths, column spans.
- **Column groups** on one or several header rows, which follow the horizontal scroll.
- **Sub rows** opened under a row, on any number of levels.
- **Cell selection** with the mouse, with an optional context menu.
- **Keyboard navigation** between cells and grid semantics for assistive technologies (opt-in).
- **Sized by its container**: the table fills the space it is given and follows it.
- **Configurable**: cell content, group cell, sub-rows toggle and menu are components you provide;
  colors, reliefs and separators are CSS custom properties.
- **Usable in pieces**: `Virtualizer`, `Scroller`, `ResponsiveContainer` and the `useVirtualizer` hook
  work without `Table`.

## Install

```bash
yarn add @pricemoov-oss/react-table
```

`react`, `react-dom`, `@mui/material`, `@emotion/react` and `@emotion/styled` are peer
dependencies ([details](docs/getting-started.md#install)).

The package ships ES modules next to CommonJS and declares no side effect outside its stylesheet: your
bundler keeps what you import and drops the rest (an application that uses `Table` and the interactions
manager carries about 52 kB minified, 18 kB gzipped, of the library).

## Quick start

```tsx
import { Table, IRow } from "@pricemoov-oss/react-table";
import "@pricemoov-oss/react-table/dist/style/index.css";

const rows: IRow[] = [
  {
    id: "header",
    isHeader: true,
    cells: [
      { id: "name", value: "Name" },
      { id: "price", value: "Price" },
    ],
  },
  {
    id: "p1",
    cells: [
      { id: "p1-name", value: "Keyboard" },
      { id: "p1-price", value: "49.00" },
    ],
  },
  // …thousands more
];

export function Prices() {
  return (
    <div style={{ height: 600 }}>
      <Table id="prices" rows={rows} isVirtualized virtualizerProps={{ fixedRows: [0], fixedColumns: [0] }} />
    </div>
  );
}
```

The table takes the size of its container. Give `virtualizerProps.width` and `height` to size it yourself.

## Documentation

| Guide                                       | Content                                                                           |
| ------------------------------------------- | --------------------------------------------------------------------------------- |
| [Getting started](docs/getting-started.md)  | Install, styles, first table                                                      |
| [Recipes](docs/recipes.md)                  | Fixed and hidden items, groups, sub rows, selection, scroll, paging, custom cells |
| [API reference](docs/api.md)                | Properties, types, handles, hooks                                                 |
| [Theming](docs/theming.md)                  | CSS custom properties, reliefs, separators, replacing components                  |
| [Accessibility](docs/accessibility.md)      | Semantics, keyboard navigation                                                    |
| [`useVirtualizer`](docs/use-virtualizer.md) | Virtualize something that is not a table                                          |
| [Architecture](docs/architecture.md)        | How the virtualization works, what is rendered when                               |
| [Migration](docs/migration.md)              | From 4.x to 5.0                                                                   |
| [FAQ](docs/faq.md)                          | Common pitfalls                                                                   |

Storybook shows every feature live, with its source:

```bash
yarn storybook   # http://localhost:9001
```

## Development

```bash
yarn install --frozen-lockfile
yarn test           # unit and integration tests (jest, jsdom)
yarn test:browser   # layout, reliefs and keyboard in a real browser (Playwright, against Storybook)
yarn lint
yarn build
```

See [CONTRIBUTING.md](CONTRIBUTING.md) and the [changelog](CHANGELOG.md).

## License

[MIT](LICENSE)
