import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import Table from "../../../src/components/table/table";
import { IRow } from "../../../src/components/table/row";
import { withThemeProvider } from "../../utils/decorators";
import { generateTable, generateTableWithCustomColspan, generateRow } from "../../utils/tables";
import { TableColumnsRowsController, TableScrollController } from "../../stories-components/selection-menu";

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
  title: "Table/Virtualized",
  component: Table,
  decorators: [withThemeProvider],
  tags: ["autodocs"],
  parameters: jestParameters,
};

export default meta;

interface IDefaultArgs {
  height: number;
  width: number;
  fixedRows: number[];
  fixedColumns: number[];
}

const defaultArgTypes = {
  height: { control: { type: "number" as const } },
  width: { control: { type: "number" as const } },
  fixedRows: { control: { type: "object" as const } },
  fixedColumns: { control: { type: "object" as const } },
};

export const Default: StoryObj<IDefaultArgs> = {
  args: { height: 500, width: 1000, fixedRows: [0, 1], fixedColumns: [0, 1] },
  argTypes: defaultArgTypes,
  render: ({ height, width, fixedRows, fixedColumns }) => {
    const table = generateTable(30, 100, {}, true);
    return (
      <Table
        {...table}
        isSelectable={false}
        isVirtualized
        virtualizerProps={{
          fixedRows,
          fixedColumns,
          height,
          width,
          hiddenColumns: [13, 34],
        }}
      />
    );
  },
};

interface ISpanToggleArgs {
  isSpan: boolean;
}

export const Responsive: StoryObj<ISpanToggleArgs> = {
  args: { isSpan: false },
  argTypes: { isSpan: { control: { type: "boolean" } } },
  render: ({ isSpan }) => {
    const props = generateTable(1000, 350, {}, false);

    return (
      <div style={{ height: "calc(100vh - 50px)", width: "100%" }}>
        <Table
          {...props}
          rowsProps={{
            15: { size: 122 },
            97: { size: 300 },
          }}
          columns={{
            0: { size: 40 },
            1: { size: 86 },
            2: { size: 96 },
            3: { size: 273 },
            4: { size: 206 },
            22: { size: 200 },
          }}
          isSelectable={false}
          isVirtualized
          isSpan={isSpan}
          virtualizerProps={{
            hiddenColumns: [13, 32],
            fixedRows: [0, 50, 97],
            fixedColumns: [0, 1, 2, 3, 4],
          }}
        />
      </div>
    );
  },
};

export const FixedColumnsAndRows: StoryObj<ISpanToggleArgs> = {
  args: { isSpan: false },
  argTypes: { isSpan: { control: { type: "boolean" } } },
  render: ({ isSpan }) => {
    const props = generateTable(3, 300, {});
    return (
      <div style={{ height: "calc(100vh - 50px)", width: "100%" }}>
        <Table
          {...props}
          columns={{
            0: { style: { justifyContent: "center" } },
          }}
          isSelectable={false}
          isVirtualized
          isSpan={isSpan}
          virtualizerProps={{
            hiddenColumns: [13, 32],
            fixedRows: [0, 2],
            fixedColumns: [299],
          }}
        />
      </div>
    );
  },
};

interface ISizeArgs {
  height: number;
  width: number;
}

export const WithInitialScrollPositions: StoryObj<ISizeArgs> = {
  args: { height: 500, width: 1000 },
  argTypes: {
    height: { control: { type: "number" } },
    width: { control: { type: "number" } },
  },
  render: ({ height, width }) => {
    const table = generateTable(30, 100, {}, true);
    return (
      <Table
        {...table}
        isSelectable={false}
        isVirtualized
        virtualizerProps={{
          fixedRows: [0, 1],
          fixedColumns: [0, 1],
          height,
          width,
          initialScroll: {
            columnIndex: 13,
            rowIndex: 15,
          },
        }}
      />
    );
  },
};

export const WithDenseColumns: StoryObj<ISpanToggleArgs> = {
  args: { isSpan: false },
  argTypes: { isSpan: { control: { type: "boolean" } } },
  render: ({ isSpan }) => (
    <div style={{ height: "100vh", width: "100%" }}>
      <Table
        {...generateTable(100, 7, {}, true)}
        globalColumnProps={{ style: { justifyContent: "left" } }}
        isSelectable={false}
        isVirtualized
        isSpan={isSpan}
        virtualizerProps={{
          rowsCount: 10,
          fixedRows: [0, 1],
          fixedColumns: [0, 5],
        }}
      />
    </div>
  ),
};

export const WithFixedSubRows: StoryObj<ISpanToggleArgs> = {
  args: { isSpan: false },
  argTypes: { isSpan: { control: { type: "boolean" } } },
  render: ({ isSpan }) => {
    const table = generateTable(100, 100, {}, true);
    const lastRow: IRow = table.rows[99];
    lastRow.fixSubRows = true;
    lastRow.cells[0].subItems = [generateRow(1, 100, false, 2), generateRow(2, 100, false, 2)];
    return (
      <div style={{ height: "100vh", width: "100%" }}>
        <Table
          {...table}
          globalColumnProps={{ style: { justifyContent: "left" } }}
          columns={{ 0: { size: 180 } }}
          isSelectable={false}
          isVirtualized
          isSpan={isSpan}
          virtualizerProps={{
            rowsCount: 10,
            columnsCount: 10,
            fixedRows: [0, 1, 22, 99],
            fixedColumns: [0, 1, 50],
          }}
        />
      </div>
    );
  },
};

export const WithCustomColspan: StoryObj = {
  render: () => {
    const table = generateTableWithCustomColspan(100, 100, true);
    return (
      <div style={{ height: "100vh", width: "100%" }}>
        <Table
          {...table}
          globalColumnProps={{ style: { justifyContent: "center" } }}
          isSelectable={false}
          isVirtualized
          virtualizerProps={{
            rowsCount: 10,
            columnsCount: 10,
            fixedRows: [0, 2, 19],
            fixedColumns: [0],
          }}
        />
      </div>
    );
  },
};

export const WithCustomRowHeightForSomeFixedRows: StoryObj<ISizeArgs> = {
  args: { height: 500, width: 1000 },
  argTypes: {
    height: { control: { type: "number" } },
    width: { control: { type: "number" } },
  },
  render: ({ height, width }) => {
    const table = generateTable(30, 20, {}, true);
    return (
      <Table
        {...table}
        rowsProps={{
          0: { size: 24 },
          8: { size: 150 },
        }}
        isSelectable={false}
        isVirtualized
        virtualizerProps={{
          fixedRows: [0, 8],
          height,
          width,
        }}
      />
    );
  },
};

export const WithCustomColumnWidthForSomeFixedColumns: StoryObj<ISizeArgs> = {
  args: { height: 500, width: 1000 },
  argTypes: {
    height: { control: { type: "number" } },
    width: { control: { type: "number" } },
  },
  render: ({ height, width }) => {
    const table = generateTable(10, 30, {}, true);
    return (
      <Table
        {...table}
        isSelectable={false}
        isVirtualized
        columns={{ 0: { size: 320 }, 4: { size: 300 } }}
        virtualizerProps={{
          fixedColumns: [0, 4],
          height,
          width,
        }}
      />
    );
  },
};

export const WithCustomCellSize: StoryObj<ISizeArgs> = {
  args: { height: 500, width: 1000 },
  argTypes: {
    height: { control: { type: "number" } },
    width: { control: { type: "number" } },
  },
  render: ({ height, width }) => {
    const table = generateTable(30, 12, {}, true);
    return (
      <Table
        {...table}
        rowsProps={{
          0: { size: 24 },
          8: { size: 150 },
        }}
        columns={{ 0: { size: 320 }, 4: { size: 300 } }}
        isSelectable={false}
        isVirtualized
        virtualizerProps={{
          fixedRows: [0, 2, 8],
          fixedColumns: [0, 4],
          height,
          width,
        }}
      />
    );
  },
};

export const WithHiddenRowsAndColumns: StoryObj = {
  render: () => {
    const table = generateTable(30, 20, {}, true);
    return (
      <Table
        {...table}
        rowsProps={{
          0: { size: 24 },
          8: { size: 150 },
        }}
        isSelectable={false}
        isVirtualized
        virtualizerProps={{
          height: 500,
          width: 1000,
          rowsCount: 7,
          columnsCount: 10,
          fixedRows: [0, 8],
          fixedColumns: [1, 3],
          hiddenColumns: [1, 5],
          hiddenRows: [1, 5, 6],
        }}
      />
    );
  },
};

interface IControllerArgs {
  height: number;
  width: number;
  fixedRows: number[];
}

export const WithColumnsAndRowsVisibilityControllers: StoryObj<IControllerArgs> = {
  args: { height: 500, width: 1000, fixedRows: [0, 1, 2, 8] },
  argTypes: {
    height: { control: { type: "number" } },
    width: { control: { type: "number" } },
    fixedRows: { control: { type: "object" } },
  },
  render: ({ height, width, fixedRows }) => <TableColumnsRowsController height={height} width={width} fixedRows={fixedRows} />,
};

interface IGoToControllerArgs {
  goToColumnIndex: number;
  goToRowIndex: number;
  height: number;
  width: number;
  fixedRows: number[];
}

export const WithGoToControllers: StoryObj<IGoToControllerArgs> = {
  args: { goToColumnIndex: 20, goToRowIndex: 32, height: 500, width: 1000, fixedRows: [0, 2, 8] },
  argTypes: {
    goToColumnIndex: { control: { type: "number" } },
    goToRowIndex: { control: { type: "number" } },
    height: { control: { type: "number" } },
    width: { control: { type: "number" } },
    fixedRows: { control: { type: "object" } },
  },
  render: ({ goToColumnIndex, goToRowIndex, height, width, fixedRows }) => (
    <TableScrollController
      goToColumnIndex={goToColumnIndex}
      goToRowIndex={goToRowIndex}
      height={height}
      width={width}
      fixedRows={fixedRows}
    />
  ),
};
