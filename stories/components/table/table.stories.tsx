import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import Table from "../../../src/components/table/table";
import { withThemeProvider } from "../../utils/decorators";
import { simpleTable, tableWithSubItems, subRows, subMiam, tableWithDifferentRowSizes } from "../../utils/tables";
import { CustomCellContent } from "../../stories-components/selection-menu";

const defaultProps = {
  id: "table-foo",
  rows: simpleTable({}),
};

const table2Levels = tableWithSubItems({ firstSubRows: subRows({}) });

export const table3Levels = tableWithSubItems({
  firstSubRows: subRows({ subsubRows: subMiam }),
});

const jestParameters = {
  jest: [
    "row",
    "row-span",
    "row-it",
    "cell",
    "selection-handler",
    "elementary-table",
    "elementary-table-it",
    "selectable-table",
    "virtualized-table",
    "utils",
  ],
};

const meta: Meta<typeof Table> = {
  title: "Table/Default",
  component: Table,
  decorators: [withThemeProvider],
  tags: ["autodocs"],
  parameters: jestParameters,
};

export default meta;

type Story = StoryObj<typeof Table>;

export const Default: Story = {
  render: () => <Table {...defaultProps} />,
};

export const WithLoading: Story = {
  render: () => (
    <Table
      id="tableId"
      rows={simpleTable({ loading: true })}
      isSelectable={false}
      columns={{ 0: { disableLevelPadding: true }, 1: { loading: true } }}
    />
  ),
};

export const WithCellCustomContent: Story = {
  render: () => (
    <Table
      id="custom-cell"
      isSelectable={false}
      rows={simpleTable({
        customCell: CustomCellContent,
        customCellProps: { defaultValue: "Click to edit!" },
      })}
    />
  ),
};

export const WithCustomRowHeights: Story = {
  render: () => <Table {...defaultProps} isSelectable={false} globalRowProps={{ size: 50 }} rows={tableWithDifferentRowSizes} />,
};

export const WithColumnsProps: Story = {
  render: () => (
    <Table
      {...defaultProps}
      isSelectable={false}
      rows={table2Levels}
      columns={{
        0: { style: { justifyContent: "left" }, size: 150 },
        2: { size: 400 },
      }}
    />
  ),
};

export const WithSubRow: Story = {
  render: () => (
    <Table {...defaultProps} isSelectable={false} rows={table2Levels} columns={{ 0: { disableLevelPadding: true } }} />
  ),
};

export const WithImbricatedSubRows: Story = {
  render: () => <Table {...defaultProps} isSelectable={false} rows={table3Levels} />,
};

export const WithSpan: Story = {
  render: () => {
    const rows = tableWithSubItems({
      firstSubRows: subRows({}),
      secondSubRows: subRows({}),
    });
    rows[1].rowSpanProps = { title: "foo", color: "#0082c3" };
    rows[2].rowSpanProps = { title: "bar", color: "#e86430" };
    return <Table {...defaultProps} isSelectable={false} isSpan rows={rows} />;
  },
};

export const WithOpenedSubRows: Story = {
  render: () => (
    <Table
      {...defaultProps}
      isSelectable={false}
      isSpan
      rows={table3Levels}
      initialOpenedTrees={{
        1: {
          rowIndex: 1,
          columnIndex: 0,
          subTrees: { 0: { rowIndex: 0, columnIndex: 2 } },
        },
      }}
    />
  ),
};

export const WithVisibleRowsAndColumns: Story = {
  render: () => <Table {...defaultProps} isSelectable={false} visibleColumnIndexes={[0, 1]} visibleRowIndexes={[0, 1]} />,
};

export const WithDynamicClassName: Story = {
  render: () => {
    const rows = simpleTable({});
    rows[1].cells[1].getClassName = () => "selected";
    return <Table id="table-foo" rows={rows} isSelectable={false} />;
  },
};
