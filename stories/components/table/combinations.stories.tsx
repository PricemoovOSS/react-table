import type { Meta, StoryObj } from "@storybook/react-vite";

import Table, { ITableHandle } from "../../../src/components/table/table";
import { generateTable } from "../../utils/tables";

/**
 * Fixed, hidden, grouped and opened items combined. These stories are also the pages
 * driven by the browser tests (`test/browser`): the table handle is exposed on `window`.
 */
const meta: Meta<typeof Table> = {
  parameters: {
    docs: {
      description: {
        component: `
Fixed, hidden, grouped and opened items together, in one table. These stories are also the pages driven by
the browser tests (\`yarn test:browser\`), which check the layout at several scroll positions and sizes.
`,
      },
    },
  },
  title: "Table/Combinations",
  component: Table,
  tags: ["autodocs"],
};

export default meta;

const COLUMNS = 40;
const ROWS = 60;
const LAST_COLUMN = COLUMNS - 1;
const LAST_ROW = ROWS - 1;

const groups = [
  { id: "g1", label: "G1 (0-1)" },
  {
    id: "g2",
    label: "G2 (2-7)",
    subGroups: [
      { id: "g2a", label: "G2a (2-4)" },
      { id: "g2b", label: "G2b (5-7)" },
    ],
  },
  { id: "g3", label: "G3 (8-12)" },
  { id: "g4", label: "G4 (last)" },
];

const groupOfColumn = (column: number) => {
  if (column <= 1) return "g1";
  if (column <= 4) return "g2a";
  if (column <= 7) return "g2b";
  if (column <= 12) return "g3";
  return column === LAST_COLUMN ? "g4" : undefined;
};

const groupedColumns = Object.fromEntries(
  Array.from({ length: COLUMNS }, (_, column) => [column, { groupId: groupOfColumn(column) }]).filter(
    ([, options]) => (options as { groupId?: string }).groupId,
  ),
);

const table = generateTable(ROWS, COLUMNS, {}, true);

const exposeHandle = (handle: ITableHandle | null) => {
  (window as unknown as { tableHandle: ITableHandle | null }).tableHandle = handle;
};

const grouped = {
  ...table,
  ref: exposeHandle,
  isSelectable: false,
  isVirtualized: true,
  groups,
  groupsProps: { rowsOptions: { size: 30 } },
  columns: groupedColumns,
};

const combination = {
  fixedRows: [0],
  fixedColumns: [0, 1, LAST_COLUMN],
  hiddenColumns: [4, 9],
  hiddenRows: [5],
  minRowHeight: 40,
};

export const GroupsFixedAndHidden: StoryObj = {
  name: "Groups, fixed left and right columns, hidden rows and columns, sub rows",
  render: () => <Table {...grouped} virtualizerProps={{ ...combination, height: 500, width: 1000 }} />,
};

export const GroupsFixedAndHiddenResponsive: StoryObj = {
  name: "Same combination in a container that drives the size",
  render: () => (
    <div id="table-container" style={{ width: 900, height: 480, resize: "both", overflow: "hidden" }}>
      <Table {...grouped} virtualizerProps={combination} />
    </div>
  ),
};

export const SeveralFixedEndItems: StoryObj = {
  name: "Several right fixed columns and bottom fixed rows, custom sizes",
  render: () => (
    <Table
      {...table}
      ref={exposeHandle}
      isSelectable={false}
      isVirtualized
      columns={{ [LAST_COLUMN - 1]: { size: 140 } }}
      rowsProps={{ [LAST_ROW - 1]: { size: 60 } }}
      virtualizerProps={{
        fixedRows: [0, LAST_ROW - 2, LAST_ROW - 1, LAST_ROW],
        fixedColumns: [0, LAST_COLUMN - 2, LAST_COLUMN - 1, LAST_COLUMN],
        height: 500,
        width: 1000,
        minRowHeight: 40,
      }}
    />
  ),
};

export const FixedBottomRowWithOpenedSubRows: StoryObj = {
  name: "Top and bottom fixed rows, right fixed column, opened sub rows",
  render: () => (
    <Table
      {...grouped}
      initialOpenedTrees={{ 2: { rowIndex: 2, columnIndex: 0 } }}
      virtualizerProps={{
        fixedRows: [0, LAST_ROW],
        fixedColumns: [0, LAST_COLUMN],
        hiddenColumns: [4],
        height: 500,
        width: 1000,
        minRowHeight: 40,
      }}
    />
  ),
};

export const FixedRightColumn: StoryObj = {
  name: "Left and right fixed columns",
  render: () => (
    <Table
      {...table}
      ref={exposeHandle}
      isSelectable={false}
      isVirtualized
      virtualizerProps={{ fixedRows: [0], fixedColumns: [0, LAST_COLUMN], height: 500, width: 1000, minRowHeight: 40 }}
    />
  ),
};
