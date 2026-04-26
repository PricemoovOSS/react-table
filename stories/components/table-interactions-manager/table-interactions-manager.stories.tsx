import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { IconButton, Icon, Button } from "@mui/material";

import { ColumnWidth } from "../../../src/components/constants";
import { withThemeProvider } from "../../utils/decorators";
import CellDimensionController from "../../../src/components/table-interactions-manager/cell-dimensions-controller";
import ColumnVisibilityController from "../../../src/components/table-interactions-manager/column-visibility-controller";
import ColumnIdScrollController from "../../../src/components/table-interactions-manager/column-id-scroll-controller";
import FixedColumnController from "../../../src/components/table-interactions-manager/fixed-column-controller";
import FixedRowController from "../../../src/components/table-interactions-manager/fixed-row-controller";
import TableInteractionsManager, {
  TableInteractionsContext,
} from "../../../src/components/table-interactions-manager/table-interactions-manager";
import { CellSize } from "../../../src/components/table-interactions-manager/reducers";
import { getTable } from "../styled-table/tables";
import Table, { ITableHandle } from "../../../src/components/table/table";
import { table3Levels } from "../table/table.stories";
import { ITrees } from "../../../src/components/table/elementary-table";

const defaultProps = getTable();

const toggleableColumns = [
  { id: "W01", index: 1, label: "W01" },
  { id: "W02", index: 2, label: "W02" },
  { id: "W03", index: 3, label: "W03" },
  { id: "W04", index: 4, label: "W04" },
];

const fixedRows = [0];
const fixedColumns = [0];

const toolBarStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "center",
};

const defaultColumnIdScrollControllerProps = {
  columns: Array.from({ length: 50 }).map((_, i: number) => ({ id: i.toString(), label: `Label_${i}` })),
  defaultValue: "0",
};

const trees: ITrees = {
  1: {
    rowIndex: 1,
    columnIndex: 0,
    subTrees: { 0: { rowIndex: 1, columnIndex: 2 } },
  },
};

const customCellWidthOptions = {
  s: 150,
  m: 200,
  l: 300,
};

const customRowHeightOptions = {
  s: 50,
  m: 100,
  l: 150,
};

const smallTableClassName = (size: string): string => (size === CellSize.small ? "small-table" : "");

const meta: Meta<typeof TableInteractionsManager> = {
  title: "Table interactions manager",
  component: TableInteractionsManager,
  decorators: [withThemeProvider],
  tags: ["autodocs"],
  parameters: {
    jest: ["cell-dimensions-controller", "column-visibility-controller", "week-scroll-controller", "table-interactions"],
  },
};

export default meta;

type Story = StoryObj<typeof TableInteractionsManager>;

export const CellDimensionControllerStory: Story = {
  name: "Cell dimension controller",
  render: () => (
    <TableInteractionsManager>
      <CellDimensionController
        buttonRenderer={(toggleMenu) => (
          <IconButton onClick={toggleMenu} size="large">
            <Icon>line_weight</Icon>
          </IconButton>
        )}
      />
    </TableInteractionsManager>
  ),
};

export const CellDimensionControllerWithDefaultValue: Story = {
  name: "Cell dimension controller with default value",
  render: () => (
    <TableInteractionsManager
      initialConfig={{
        cellWidth: {
          value: ColumnWidth[CellSize.small],
          size: CellSize.small,
        },
      }}
    >
      <CellDimensionController
        buttonRenderer={(toggleMenu) => (
          <IconButton onClick={toggleMenu} size="large">
            <Icon>line_weight</Icon>
          </IconButton>
        )}
      />
    </TableInteractionsManager>
  ),
};

export const CellVisibilityController: Story = {
  name: "Cell visibility controller",
  render: () => (
    <TableInteractionsManager toggleableColumns={toggleableColumns}>
      <ColumnVisibilityController
        columns={toggleableColumns}
        buttonRenderer={(toggleMenu) => (
          <IconButton onClick={toggleMenu} size="large">
            <Icon>view_week</Icon>
          </IconButton>
        )}
      />
    </TableInteractionsManager>
  ),
};

export const CellVisibilityControllerWithDefaultValue: Story = {
  name: "Cell visibility controller with default value",
  render: () => (
    <TableInteractionsManager initialConfig={{ hiddenColumnsIds: ["W01"] }} toggleableColumns={toggleableColumns}>
      <ColumnVisibilityController
        columns={toggleableColumns}
        buttonRenderer={(toggleMenu) => (
          <IconButton onClick={toggleMenu} size="large">
            <Icon>view_week</Icon>
          </IconButton>
        )}
      />
    </TableInteractionsManager>
  ),
};

export const ColumnIdScrollControllerStory: Story = {
  name: "Column id scroll controller",
  render: () => <ColumnIdScrollController {...defaultColumnIdScrollControllerProps} />,
};

export const HideRow: Story = {
  render: () => (
    <TableInteractionsManager toggleableColumns={toggleableColumns}>
      <TableInteractionsContext.Consumer>
        {({ onHorizontallyScroll, updateHiddenRowIndexes, hiddenRowIndexes, cellWidth, rowHeight, tableRef }) => (
          <>
            <div style={toolBarStyle}>
              <Button onClick={() => updateHiddenRowIndexes([1])}>Hide first row</Button>
              <Button onClick={() => updateHiddenRowIndexes([])}>Display first row</Button>
            </div>
            <div style={{ height: "calc(100vh - 55px)", width: "100%" }} className={smallTableClassName(cellWidth.size)}>
              <Table
                ref={tableRef as React.Ref<ITableHandle> | undefined}
                {...defaultProps}
                columns={{ 0: { style: { justifyContent: "left" }, size: 200 } }}
                isVirtualized
                isSelectable={false}
                virtualizerProps={{
                  hiddenRows: hiddenRowIndexes,
                  minColumnWidth: cellWidth.value,
                  minRowHeight: rowHeight.value,
                  fixedRows,
                  fixedColumns,
                  onHorizontallyScroll,
                }}
              />
            </div>
          </>
        )}
      </TableInteractionsContext.Consumer>
    </TableInteractionsManager>
  ),
};

export const Integrated: Story = {
  render: () => (
    <TableInteractionsManager
      initialConfig={{
        columnsCursor: { id: "03", index: 3 },
      }}
      toggleableColumns={toggleableColumns}
    >
      <TableInteractionsContext.Consumer>
        {({ onHorizontallyScroll, hiddenColumnsIndexes, cellWidth, rowHeight, tableRef, columnsCursor }) => (
          <>
            <div style={toolBarStyle}>
              <CellDimensionController
                buttonRenderer={(toggleMenu) => (
                  <IconButton onClick={toggleMenu} size="large">
                    <Icon>line_weight</Icon>
                  </IconButton>
                )}
              />
              <ColumnVisibilityController
                columns={toggleableColumns}
                buttonRenderer={(toggleMenu) => (
                  <IconButton onClick={toggleMenu} size="large">
                    <Icon>view_week</Icon>
                  </IconButton>
                )}
              />
            </div>
            <div style={{ height: "calc(100vh - 55px)", width: "100%" }} className={smallTableClassName(cellWidth.size)}>
              <Table
                ref={tableRef as React.Ref<ITableHandle> | undefined}
                {...defaultProps}
                columns={{ 0: { style: { justifyContent: "left" }, size: 200 } }}
                isVirtualized
                isSelectable={false}
                virtualizerProps={{
                  hiddenColumns: hiddenColumnsIndexes,
                  minColumnWidth: cellWidth.value,
                  minRowHeight: rowHeight.value,
                  initialScroll: {
                    columnIndex: columnsCursor ? columnsCursor.index : undefined,
                  },
                  fixedRows,
                  fixedColumns,
                  onHorizontallyScroll,
                }}
              />
            </div>
          </>
        )}
      </TableInteractionsContext.Consumer>
    </TableInteractionsManager>
  ),
};

export const IntegratedWithCustomCellSizes: Story = {
  name: "Integrated with custom cell sizes",
  render: () => (
    <TableInteractionsManager
      initialConfig={{
        columnsCursor: { id: "03", index: 3 },
        cellWidth: { size: "m", value: customCellWidthOptions.m },
        rowHeight: { size: "m", value: customRowHeightOptions.m },
      }}
      toggleableColumns={toggleableColumns}
    >
      <TableInteractionsContext.Consumer>
        {({ onHorizontallyScroll, hiddenColumnsIndexes, cellWidth, rowHeight, tableRef, columnsCursor }) => (
          <>
            <div style={toolBarStyle}>
              <CellDimensionController
                buttonRenderer={(toggleMenu) => (
                  <IconButton onClick={toggleMenu} size="large">
                    <Icon>line_weight</Icon>
                  </IconButton>
                )}
                cellWidthOptions={customCellWidthOptions}
                rowHeightOptions={customRowHeightOptions}
              />
              <ColumnVisibilityController
                columns={toggleableColumns}
                buttonRenderer={(toggleMenu) => (
                  <IconButton onClick={toggleMenu} size="large">
                    <Icon>view_week</Icon>
                  </IconButton>
                )}
              />
            </div>
            <div style={{ height: "calc(100vh - 55px)", width: "100%" }} className={smallTableClassName(cellWidth.size)}>
              <Table
                ref={tableRef as React.Ref<ITableHandle> | undefined}
                {...defaultProps}
                columns={{ 0: { style: { justifyContent: "left" }, size: 200 } }}
                isVirtualized
                isSelectable={false}
                virtualizerProps={{
                  hiddenColumns: hiddenColumnsIndexes,
                  minColumnWidth: cellWidth.value,
                  minRowHeight: rowHeight.value,
                  initialScroll: {
                    columnIndex: columnsCursor ? columnsCursor.index : undefined,
                  },
                  fixedRows,
                  fixedColumns,
                  onHorizontallyScroll,
                }}
              />
            </div>
          </>
        )}
      </TableInteractionsContext.Consumer>
    </TableInteractionsManager>
  ),
};

export const WithRowsControl: Story = {
  name: "With rows control",
  render: () => (
    <TableInteractionsManager>
      <TableInteractionsContext.Consumer>
        {({ onTableUpdate, tableRef, openTrees, closeTrees }) => (
          <>
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                marginBottom: 10,
                width: "100%",
              }}
            >
              <Button color="primary" variant="contained" onClick={() => openTrees(trees)}>
                Open the row
              </Button>
              <Button color="primary" variant="contained" onClick={() => closeTrees(trees)}>
                Close the row
              </Button>
            </div>
            <Table
              ref={tableRef as React.Ref<ITableHandle> | undefined}
              {...defaultProps}
              isSelectable={false}
              isSpan
              rows={table3Levels}
              onOpenedTreesUpdate={onTableUpdate}
            />
          </>
        )}
      </TableInteractionsContext.Consumer>
    </TableInteractionsManager>
  ),
};

export const WithPinnedColumnsControl: Story = {
  name: "With pinned columns control",
  render: () => (
    <TableInteractionsManager>
      <TableInteractionsContext.Consumer>
        {({ onHorizontallyScroll, fixedColumnsIndexes, cellWidth, rowHeight, tableRef, columnsCursor }) => (
          <>
            <div
              style={{
                display: "flex",
                justifyContent: "space-evenly",
                marginBottom: 10,
                width: "100%",
              }}
            >
              <FixedColumnController columnId="12">
                {({ toggleFixedColumnId, isFixed }) => (
                  <Button color="primary" variant="contained" onClick={toggleFixedColumnId}>
                    {isFixed ? "Unpin" : "Pin"} w12
                  </Button>
                )}
              </FixedColumnController>
              <FixedColumnController columnId="30">
                {({ toggleFixedColumnId, isFixed }) => (
                  <Button color="primary" variant="contained" onClick={toggleFixedColumnId}>
                    {isFixed ? "Unpin" : "Pin"} w30
                  </Button>
                )}
              </FixedColumnController>
            </div>
            <div style={{ height: "calc(100vh - 55px)", width: "100%" }} className={smallTableClassName(cellWidth.size)}>
              <Table
                ref={tableRef as React.Ref<ITableHandle> | undefined}
                {...defaultProps}
                columns={{ 0: { style: { justifyContent: "left" }, size: 200 } }}
                isVirtualized
                isSelectable={false}
                virtualizerProps={{
                  minColumnWidth: cellWidth.value,
                  minRowHeight: rowHeight.value,
                  initialScroll: {
                    columnIndex: columnsCursor ? columnsCursor.index : undefined,
                  },
                  fixedRows,
                  fixedColumns: [...fixedColumns, ...fixedColumnsIndexes],
                  onHorizontallyScroll,
                }}
              />
            </div>
          </>
        )}
      </TableInteractionsContext.Consumer>
    </TableInteractionsManager>
  ),
};

export const WithPinnedRowsControl: Story = {
  name: "With pinned rows control",
  render: () => (
    <TableInteractionsManager>
      <TableInteractionsContext.Consumer>
        {({ onHorizontallyScroll, fixedRowsIndexes, cellWidth, rowHeight, tableRef, columnsCursor }) => (
          <>
            <div
              style={{
                display: "flex",
                justifyContent: "space-evenly",
                marginBottom: 10,
                width: "100%",
              }}
            >
              <FixedRowController rowIndex={3}>
                {({ toggleFixedRowIndex, isFixed }) => (
                  <Button color="primary" variant="contained" onClick={toggleFixedRowIndex}>
                    {isFixed ? "Unpin" : "Pin"} MARGIN_RATE
                  </Button>
                )}
              </FixedRowController>
              <FixedRowController rowIndex={15}>
                {({ toggleFixedRowIndex, isFixed }) => (
                  <Button color="primary" variant="contained" onClick={toggleFixedRowIndex}>
                    {isFixed ? "Unpin" : "Pin"} CA_TTC_OMNICANALF
                  </Button>
                )}
              </FixedRowController>
            </div>
            <div style={{ height: "calc(100vh - 55px)", width: "100%" }} className={smallTableClassName(cellWidth.size)}>
              <Table
                ref={tableRef as React.Ref<ITableHandle> | undefined}
                {...defaultProps}
                columns={{ 0: { style: { justifyContent: "left" }, size: 200 } }}
                isVirtualized
                isSelectable={false}
                virtualizerProps={{
                  minColumnWidth: cellWidth.value,
                  minRowHeight: rowHeight.value,
                  initialScroll: {
                    columnIndex: columnsCursor ? columnsCursor.index : undefined,
                  },
                  fixedRows: [...fixedRows, ...fixedRowsIndexes],
                  fixedColumns,
                  onHorizontallyScroll,
                }}
              />
            </div>
          </>
        )}
      </TableInteractionsContext.Consumer>
    </TableInteractionsManager>
  ),
};
