import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import Table, { ITableHandle } from "../../../src/components/table/table";
import { SubRowsToggleButtonComponentProps } from "../../../src/components/table/cell";
import { ITrees } from "../../../src/components/table/elementary-table";
import { generateTable } from "../../utils/tables";

const meta: Meta<typeof Table> = {
  title: "Table/Sub rows",
  component: Table,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: `
A cell with \`subItems\` (rows) opens them under its row, on any number of levels.

- The opened rows are a tree keyed by the index of the row: \`{ [rowIndex]: { rowIndex, columnIndex, subTrees } }\`.
- \`initialOpenedTrees\` opens rows at mount, the handle of the table (\`ref\`) opens and closes them later
  (\`openTrees\`, \`closeTrees\`), \`onOpenedTreesUpdate\` reports what the user or the handle did.
- \`SubRowsToggleButtonComponent\` replaces the button that opens a row.
- A tree is dropped as soon as its row has no more sub rows.
        `,
      },
    },
  },
};

export default meta;

const table = generateTable(30, 12, {}, true);
const size = { height: 420, width: 1000 };
const ROW_2: ITrees = { 2: { rowIndex: 2, columnIndex: 0 } };
const ROW_2_AND_ITS_ROW_2: ITrees = { 2: { rowIndex: 2, columnIndex: 0, subTrees: ROW_2 } };

export const Default: StoryObj = {
  name: "Opened by the user",
  render: () => <Table {...table} isSelectable={false} isVirtualized virtualizerProps={{ ...size, fixedRows: [0] }} />,
};

export const InitiallyOpened: StoryObj = {
  name: "Opened at mount, on two levels",
  render: () => (
    <Table
      {...table}
      isSelectable={false}
      isVirtualized
      initialOpenedTrees={ROW_2_AND_ITS_ROW_2}
      virtualizerProps={{ ...size, fixedRows: [0] }}
    />
  ),
};

function PlusMinusToggle({ opened, onClick }: SubRowsToggleButtonComponentProps) {
  return (
    <button
      type="button"
      className="table-cell-sub-item-toggle"
      aria-expanded={!!opened}
      aria-label={opened ? "Close the rows" : "Open the rows"}
      onClick={onClick}
      style={{ width: 22, height: 22, marginRight: 6, cursor: "pointer" }}
    >
      {opened ? "−" : "+"}
    </button>
  );
}

export const CustomToggle: StoryObj = {
  name: "Custom toggle button",
  render: () => (
    <Table
      {...table}
      isSelectable={false}
      isVirtualized
      SubRowsToggleButtonComponent={PlusMinusToggle}
      virtualizerProps={{ ...size, fixedRows: [0] }}
    />
  ),
};

function ControlledFromOutside() {
  const tableRef = React.useRef<ITableHandle>(null);
  const [opened, setOpened] = React.useState<ITrees>({});
  return (
    <>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, font: "13px sans-serif" }}>
        <button type="button" onClick={() => tableRef.current?.openTrees(ROW_2)}>
          Open row 2
        </button>
        <button type="button" onClick={() => tableRef.current?.openTrees(ROW_2_AND_ITS_ROW_2)}>
          Open row 2 and its own row 2
        </button>
        <button type="button" onClick={() => tableRef.current?.closeTrees(ROW_2)}>
          Close
        </button>
        <span>opened rows: {JSON.stringify(Object.keys(opened))}</span>
      </div>
      <Table
        {...table}
        ref={tableRef}
        isSelectable={false}
        isVirtualized
        onOpenedTreesUpdate={setOpened}
        virtualizerProps={{ ...size, fixedRows: [0] }}
      />
    </>
  );
}

export const FromOutside: StoryObj = {
  name: "Opened and closed from outside",
  render: () => <ControlledFromOutside />,
};

export const WithSpan: StoryObj = {
  name: "With a span column",
  render: () => <Table {...table} isSelectable={false} isVirtualized isSpan virtualizerProps={{ ...size, fixedRows: [0] }} />,
};
