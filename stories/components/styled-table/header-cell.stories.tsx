import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import Table from "../../../src/components/table/table";
import { withThemeProvider } from "../../utils/decorators";
import HeaderCell from "../../../src/components/styled-table/header-cell";
import { getTable } from "./tables";

const integratedProps = getTable();

const meta: Meta<typeof HeaderCell> = {
  title: "Styled Table/Header cell",
  component: HeaderCell,
  decorators: [withThemeProvider],
  tags: ["autodocs"],
  parameters: {
    jest: ["header-cell", "bubble"],
  },
  argTypes: {
    title: { control: { type: "text" } },
    value: { control: { type: "text" } },
    badge: { control: { type: "text" } },
    isCurrent: { control: { type: "boolean" } },
    className: { control: { type: "text" } },
  },
};

export default meta;

type Story = StoryObj<typeof HeaderCell>;

export const Default: Story = {
  args: { title: "Foo", value: "Bar", badge: "28", isCurrent: true },
  render: (args) => (
    <div style={{ width: 200, height: 200, position: "relative" }}>
      <HeaderCell {...args} />
    </div>
  ),
};

export const NotCurrent: Story = {
  args: { title: "Foo", value: "Bar", badge: "28", isCurrent: false, className: "custom" },
  render: (args) => (
    <div style={{ width: 200, height: 200 }}>
      <HeaderCell {...args} />
    </div>
  ),
};

interface IIntegratedArgs {
  height: number;
  width: number;
  fixedRows: number[];
  fixedColumns: number[];
}

export const Integrated: StoryObj<IIntegratedArgs> = {
  args: { height: 500, width: 1000, fixedRows: [0], fixedColumns: [0] },
  argTypes: {
    height: { control: { type: "number" } },
    width: { control: { type: "number" } },
    fixedRows: { control: { type: "object" } },
    fixedColumns: { control: { type: "object" } },
  },
  render: ({ height, width, fixedRows, fixedColumns }) => (
    <Table
      {...integratedProps}
      columns={{ 0: { style: { justifyContent: "left" } } }}
      isVirtualized
      virtualizerProps={{
        fixedRows,
        fixedColumns,
        height,
        width,
        rowsCount: 5,
        columnsCount: 6,
      }}
    />
  ),
};
