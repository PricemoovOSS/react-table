import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import Table from "../../src/components/table/table";
import { buildHeavyRows, CellWeight, RenderMeter, resetRenderStats } from "../stories-components/heavy-cells";

interface IHeavyArgs {
  rows: number;
  columns: number;
  weight: CellWeight;
  pinLastColumn: boolean;
  keyboardNavigation: boolean;
  synchronousScrollRendering: boolean;
}

const meta: Meta<IHeavyArgs> = {
  title: "Recipes/Heavy interactive cells",
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: `
Several hundred rows and columns of heavy cells: an editable price, a trend, a chart, a strip of marks, a
toggle and a menu in each one. The meter above the table counts what each interaction renders.

What to look at while scrolling:

- **a vertical step renders one row of cells**, a horizontal step one column — the cells that enter the
  window, and no other;
- **typing in a cell, opening its menu or pinning it renders that cell only**: its state is local;
- **a render of the application around the table renders no cell** (button *Render the application*);
- the frames stay short while cells are being mounted;
- **the new window is painted in the frame of the scroll**: switch \`synchronousScrollRendering\` off in the
  controls to feel the frame of delay React adds when it schedules that render itself.

The same rules are checked in a real browser by \`test/browser/heavy-cells.spec.ts\`.
        `,
      },
    },
  },
  argTypes: {
    rows: { control: { type: "number", min: 10, max: 5000, step: 10 } },
    columns: { control: { type: "number", min: 5, max: 1000, step: 5 } },
    weight: { control: "inline-radio", options: ["light", "medium", "heavy"] },
    pinLastColumn: { control: "boolean" },
    keyboardNavigation: { control: "boolean" },
    synchronousScrollRendering: { control: "boolean" },
  },
};

export default meta;

function HeavyTable(args: IHeavyArgs) {
  const { rows, columns, weight, pinLastColumn, keyboardNavigation, synchronousScrollRendering } = args;
  const [renders, setRenders] = React.useState(0);
  const data = React.useMemo(() => buildHeavyRows(rows, columns, weight), [rows, columns, weight]);

  return (
    <div style={{ height: "calc(100vh - 60px)", minHeight: 360, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", font: "13px sans-serif" }}>
        <button type="button" data-testid="render-application" onClick={() => setRenders((count) => count + 1)}>
          Render the application ({renders})
        </button>
        <button type="button" data-testid="reset-counters" onClick={resetRenderStats}>
          Reset the counters
        </button>
        <span>
          {rows} rows × {columns} columns, {(rows * (columns - 1)).toLocaleString("en-US")} heavy cells
        </span>
      </div>
      <RenderMeter />
      <div id="table-container" style={{ flex: 1, minHeight: 0 }}>
        <Table
          id="heavy"
          rows={data}
          isVirtualized
          isSelectable={false}
          keyboardNavigation={keyboardNavigation}
          rowsProps={{ 0: { size: 40 } }}
          columns={{ 0: { size: 140 } }}
          // written inline, like an application does
          virtualizerProps={{
            fixedRows: [0],
            fixedColumns: pinLastColumn ? [0, columns - 1] : [0],
            minRowHeight: 60,
            minColumnWidth: 230,
            synchronousScrollRendering,
          }}
        />
      </div>
    </div>
  );
}

export const Default: StoryObj<IHeavyArgs> = {
  name: "500 rows × 300 columns of heavy cells",
  args: {
    rows: 500,
    columns: 300,
    weight: "heavy",
    pinLastColumn: true,
    keyboardNavigation: false,
    synchronousScrollRendering: true,
  },
  render: (args) => <HeavyTable {...args} />,
};

export const Medium: StoryObj<IHeavyArgs> = {
  name: "2 000 rows × 500 columns of medium cells",
  args: {
    rows: 2000,
    columns: 500,
    weight: "medium",
    pinLastColumn: true,
    keyboardNavigation: false,
    synchronousScrollRendering: true,
  },
  render: (args) => <HeavyTable {...args} />,
};
