import type { Meta, StoryObj } from "@storybook/react-vite";

import Table from "../../../src/components/table/table";
import { GroupCellProps } from "../../../src/components/table/group-rows";
import { Group } from "../../../src/components/utils/group";
import { generateTable } from "../../utils/tables";

const meta: Meta<typeof Table> = {
  title: "Table/Column groups",
  component: Table,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: `
Columns are grouped under one or several header rows:

- \`groups\` is the tree of groups: \`{ id, label, subGroups }\`;
- each column names its group, the deepest one, with \`columns[index].groupId\`;
- \`groupsProps\` sets the height of the group rows and replaces the group cell (\`CustomGroupCell\`).

Neighbouring columns of the same group share one cell, recomputed from the visible columns: the group
headers follow the horizontal scroll. Columns without a group get an empty cell. The group of a column
fixed on the right leaves the flow with it and stays above it: a custom cell gets its place in \`style\`.
        `,
      },
    },
  },
};

export default meta;

const COLUMNS = 40;
const LAST_COLUMN = COLUMNS - 1;
const table = generateTable(40, COLUMNS, {}, false);

const groups: Group[] = [
  { id: "identity", label: "Identity" },
  {
    id: "prices",
    label: "Prices",
    subGroups: [
      { id: "current", label: "Current" },
      { id: "next", label: "Next" },
    ],
  },
  { id: "totals", label: "Totals" },
];

const columns = {
  0: { groupId: "identity" },
  1: { groupId: "identity" },
  2: { groupId: "current" },
  3: { groupId: "current" },
  4: { groupId: "current" },
  5: { groupId: "next" },
  6: { groupId: "next" },
  [LAST_COLUMN]: { groupId: "totals" },
};

const size = { height: 420, width: 1000 };

export const OneLevel: StoryObj = {
  name: "One level of groups",
  render: () => (
    <Table
      {...table}
      isSelectable={false}
      isVirtualized
      groups={[
        { id: "identity", label: "Identity" },
        { id: "current", label: "Prices" },
      ]}
      columns={columns}
      virtualizerProps={{ ...size, fixedRows: [0] }}
    />
  ),
};

export const Nested: StoryObj = {
  name: "Nested groups",
  render: () => (
    <Table
      {...table}
      isSelectable={false}
      isVirtualized
      groups={groups}
      groupsProps={{ rowsOptions: { size: 30 } }}
      columns={columns}
      virtualizerProps={{ ...size, fixedRows: [0] }}
    />
  ),
};

export const WithFixedColumns: StoryObj = {
  name: "With columns fixed on both sides",
  render: () => (
    <Table
      {...table}
      isSelectable={false}
      isVirtualized
      groups={groups}
      groupsProps={{ rowsOptions: { size: 30 } }}
      columns={columns}
      virtualizerProps={{ ...size, fixedRows: [0], fixedColumns: [0, 1, LAST_COLUMN] }}
    />
  ),
};

export const WithHiddenColumns: StoryObj = {
  name: "With hidden columns",
  render: () => (
    <Table
      {...table}
      isSelectable={false}
      isVirtualized
      groups={groups}
      groupsProps={{ rowsOptions: { size: 30 } }}
      columns={columns}
      virtualizerProps={{ ...size, fixedRows: [0], hiddenColumns: [3, 5, 6] }}
    />
  ),
};

/** A custom cell renders the `<th>`: `className`, `colSpan` and `style` come from the table. */
function BadgeGroupCell({ className, group, style }: GroupCellProps) {
  return (
    <th className={className} colSpan={group.size} style={{ ...style, borderRight: "1px solid #e4e6e8" }}>
      {group.label ? (
        <span style={{ background: "#eef4ff", color: "#2a45b8", borderRadius: 10, padding: "2px 10px" }}>
          {group.label} · {group.size}
        </span>
      ) : null}
    </th>
  );
}

export const CustomGroupCell: StoryObj = {
  name: "Custom group cell",
  render: () => (
    <Table
      {...table}
      isSelectable={false}
      isVirtualized
      groups={groups}
      groupsProps={{ rowsOptions: { size: 36 }, CustomGroupCell: BadgeGroupCell }}
      columns={columns}
      virtualizerProps={{ ...size, fixedRows: [0], fixedColumns: [0, LAST_COLUMN] }}
    />
  ),
};
