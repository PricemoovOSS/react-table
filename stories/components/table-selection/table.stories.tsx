import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import Table from "../../../src/components/table/table";
import { withThemeProvider } from "../../utils/decorators";
import { SelectionMenu } from "../../stories-components/selection-menu";
import { getTable } from "../styled-table/tables";

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
  title: "Table/Selection",
  component: Table,
  decorators: [withThemeProvider],
  tags: ["autodocs"],
  parameters: jestParameters,
};

export default meta;

interface IDefaultArgs {
  columns: Record<string, { isSelectable?: boolean }>;
}

export const Default: StoryObj<IDefaultArgs> = {
  args: { columns: { 1: { isSelectable: false } } },
  argTypes: { columns: { control: { type: "object" } } },
  render: ({ columns }) => (
    <Table
      {...getTable()}
      columns={columns}
      isVirtualized
      virtualizerProps={{
        fixedRows: [0],
        fixedColumns: [0],
        height: 500,
        width: 1000,
        rowsCount: 5,
        columnsCount: 6,
      }}
    />
  ),
};

interface IHorizontalSelectionArgs {
  isDisabledVerticalSelection: boolean;
  isDisabledHorizontalSelection: boolean;
}

export const HorizontalCellSelectionOnly: StoryObj<IHorizontalSelectionArgs> = {
  args: { isDisabledVerticalSelection: true, isDisabledHorizontalSelection: false },
  argTypes: {
    isDisabledVerticalSelection: { control: { type: "boolean" } },
    isDisabledHorizontalSelection: { control: { type: "boolean" } },
  },
  render: ({ isDisabledVerticalSelection, isDisabledHorizontalSelection }) => (
    <Table
      {...getTable()}
      selectionProps={{
        isDisabledVerticalSelection,
        isDisabledHorizontalSelection,
      }}
      isVirtualized
      virtualizerProps={{
        fixedRows: [0],
        fixedColumns: [0],
        height: 500,
        width: 1000,
        rowsCount: 5,
        columnsCount: 6,
      }}
    />
  ),
};

export const RightClickMenu: StoryObj = {
  render: () => (
    <Table
      {...getTable()}
      isSelectable
      selectionProps={{
        menuComponent: SelectionMenu,
      }}
      isVirtualized
      virtualizerProps={{
        fixedRows: [0],
        fixedColumns: [0],
        height: 500,
        width: 1000,
        rowsCount: 5,
        columnsCount: 6,
      }}
    />
  ),
};
