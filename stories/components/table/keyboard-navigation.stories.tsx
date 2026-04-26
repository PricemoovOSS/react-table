import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import Table from "../../../src/components/table/table";
import { generateTable } from "../../utils/tables";
import { withThemeProvider } from "../../utils/decorators";

const meta: Meta<typeof Table> = {
  title: "A11y/Keyboard navigation",
  component: Table,
  decorators: [withThemeProvider],
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component: `
\`<Table>\` ships with built-in keyboard navigation and ARIA grid semantics
([W3C ARIA APG: Grid pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/)).

Click into the grid (or **Tab** to it). Then:

| Key                  | Action                                                  |
| -------------------- | ------------------------------------------------------- |
| Arrow keys           | Move focus by one cell — skips hidden rows/columns      |
| Home / End           | Jump to start / end of the current row                  |
| Ctrl+Home / Ctrl+End | Jump to top-left / bottom-right of the grid             |
| PageDown / PageUp    | Move by \`keyboardPageSize\` rows                       |
| Enter / Space        | Toggle expand/collapse on cells with sub-items          |

Cells off the visible window are scrolled into view automatically before focus is applied.
A focus indicator appears on the active cell when navigating by keyboard.

Set \`disableKeyboardNavigation\` to opt out.
        `,
      },
    },
  },
};

export default meta;

type Story = StoryObj<typeof Table>;

const smallProps = generateTable(50, 10);
const largeProps = generateTable(500, 25);
const mediumProps = generateTable(20, 5);

export const Default: Story = {
  name: "Virtualized + fixed rows/columns",
  render: () => (
    <div style={{ height: "70vh", width: "100%" }}>
      <Table
        {...smallProps}
        isVirtualized
        ariaLabel="Demo grid — 50 rows × 10 columns"
        virtualizerProps={{ fixedRows: [0], fixedColumns: [0] }}
      />
    </div>
  ),
};

export const WithCustomPageSize: Story = {
  name: "PageDown moves 20 rows at a time",
  render: () => (
    <div style={{ height: "70vh", width: "100%" }}>
      <Table
        {...largeProps}
        isVirtualized
        keyboardPageSize={20}
        ariaLabel="Large grid — 500 rows × 25 columns"
        virtualizerProps={{ fixedRows: [0], fixedColumns: [0] }}
      />
    </div>
  ),
};

export const SkipsHiddenIndexes: Story = {
  name: "Hidden rows / columns are skipped by ArrowKeys",
  parameters: {
    docs: {
      description: {
        story: "Rows 1, 2, 3 and columns 2, 3 are hidden. Arrow keys navigate around them seamlessly.",
      },
    },
  },
  render: () => (
    <div style={{ height: "70vh", width: "100%" }}>
      <Table
        {...mediumProps}
        isVirtualized
        ariaLabel="Grid with hidden indexes"
        virtualizerProps={{
          fixedRows: [0],
          fixedColumns: [0],
          hiddenRows: [1, 2, 3],
          hiddenColumns: [2, 3],
        }}
      />
    </div>
  ),
};

export const WithExplicitSize: Story = {
  name: "Explicit width / height (no ResponsiveContainer)",
  render: () => (
    <Table
      {...smallProps}
      isVirtualized
      ariaLabel="Fixed-size grid"
      virtualizerProps={{
        height: 500,
        width: 900,
        fixedRows: [0],
        fixedColumns: [0],
      }}
    />
  ),
};

export const NonVirtualized: Story = {
  name: "Non-virtualized — keyboard nav still works",
  render: () => <Table {...generateTable(8, 4)} ariaLabel="Static grid" />,
};

export const Disabled: Story = {
  name: "Keyboard navigation disabled",
  render: () => (
    <div style={{ height: "70vh", width: "100%" }}>
      <Table {...mediumProps} isVirtualized disableKeyboardNavigation virtualizerProps={{ fixedRows: [0] }} />
    </div>
  ),
};
