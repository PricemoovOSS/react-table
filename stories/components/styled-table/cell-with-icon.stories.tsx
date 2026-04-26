import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { action } from "@storybook/addon-actions";

import { withThemeProvider } from "../../utils/decorators";
import CellWithIcon from "../../../src/components/styled-table/cell-with-icon";
import Table from "../../../src/components/table/table";
import { getTable } from "./tables";

const integratedProps = getTable({
  1: {
    0: {
      value: "CA TTC OMNI",
      cellContent: CellWithIcon,
      cellContentProps: {
        iconName: "edit",
      },
    },
  },
  2: {
    0: {
      value: "PROG CA TTC",
      cellContent: CellWithIcon,
      cellContentProps: {
        iconName: "edit",
      },
    },
  },
});

const meta: Meta<typeof CellWithIcon> = {
  title: "Styled Table/Cell with icon",
  component: CellWithIcon,
  decorators: [withThemeProvider],
  tags: ["autodocs"],
};

export default meta;

type Story = StoryObj<typeof CellWithIcon>;

export const Default: Story = {
  args: { value: "CA TTC OMNI", iconName: "edit" },
  render: (args) => (
    <div style={{ padding: 10, width: 200 }}>
      <CellWithIcon {...args} />
    </div>
  ),
};

export const WithAction: Story = {
  args: { value: "CA TTC OMNI", iconName: "edit" },
  render: (args) => (
    <div style={{ padding: 10, width: 200 }}>
      <CellWithIcon {...args} onClick={() => action("onClick icon")("Click")} />
    </div>
  ),
};

export const WithTooltip: Story = {
  args: { value: "CA TTC OMNI", iconName: "edit", tooltipTitle: "Hello Foo" },
  render: (args) => (
    <div style={{ padding: 10, width: 200 }}>
      <CellWithIcon {...args} onClick={() => action("onClick icon")("Click")} />
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
      isSelectable={false}
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
