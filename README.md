# @pricemoov/react-table

> Lightweight, virtualized React table for very large 2D grids — fixed rows / columns, hidden indexes, custom sizes, sub-rows, span columns and selection.

<img src="images/table.png" width="1200" alt="A 15 000 × 1 000 virtualized table"/>

```bash
npm install @pricemoov/react-table
```

```tsx
import { Table } from "@pricemoov/react-table";
import "@pricemoov/react-table/dist/style/index.css";

<Table
  id="prices"
  rows={rows}
  isVirtualized
  virtualizerProps={{ height: 500, width: 1000, fixedRows: [0], fixedColumns: [0] }}
/>;
```

## Features at a glance

|     |                                                                         |
| --- | ----------------------------------------------------------------------- |
| 🚀  | 2D virtualization (rows × columns) — only the visible window is mounted |
| 📌  | Fixed rows / columns at the start or end of the grid                    |
| 🙈  | Hidden rows / columns                                                   |
| 📐  | Mixed default + per-row / per-column custom sizes                       |
| 🌳  | Sub-rows tree with span-column toggling                                 |
| 🖱️  | Cell selection (rectangle, row-only, column-only) + custom context menu |
| 🪝  | Reusable `useVirtualizer` hook for non-table virtualized layouts        |
| 🎯  | Imperative API via `forwardRef` (`scrollToColumnId`, `getCell`, …)      |
| ♿  | ARIA Grid semantics + arrow-key navigation out of the box (W3C APG)     |

## Documentation map

- [**Getting started**](docs/getting-started.md) — install, peer-deps, first table
- [**Recipes**](docs/recipes.md) — virtualization, fixed/hidden indexes, sub-rows, selection menu, scroll API, custom cells
- [**API reference**](docs/api.md) — props, types, imperative handles, hook signatures
- [**`useVirtualizer` hook**](docs/use-virtualizer.md) — virtualize without `<Table>`
- [**Architecture**](docs/architecture.md) — internal layering, perf characteristics, design decisions
- [**Accessibility**](docs/accessibility.md) — ARIA grid, keyboard navigation, hooks
- [**FAQ & gotchas**](docs/faq.md)
- [**Contributing**](CONTRIBUTING.md)
- [**Changelog**](CHANGELOG.md)

## At a glance

```
useVirtualizer ───────┐
   (pure hook)        │ visibleRowIndexes / visibleColumnIndexes
                      │ elevatedRowIndexes / elevatedColumnIndexes
                      │ cellHeight / cellWidth
                      ▼
         <Virtualizer>            (forwardRef → IVirtualizerHandle)
            └── <Scroller>        (forwardRef → IScrollerHandle)
                  └── <ElementaryTable>
                        └── <Row>     (memoized)
                              └── <Cell> (memoized)
```

Storybook is the living documentation: `npm run storybook` → http://localhost:9001/.

## Stack

React 18 · TypeScript 5 · MUI v5 (peer dependency) · Storybook 9 (Vite) · Jest 29 · React Testing Library 15.

## License

MIT — see [LICENSE](LICENSE). Same model as React: permissive, compatible with proprietary
and closed-source projects, no copyleft, no NOTICE requirement.
