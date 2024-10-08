import * as React from "react";
import { isEqual } from "lodash";
import ElementaryTable, { IElementaryTable, IColumnOptions, ITree, IColumns, ITrees } from "./elementary-table";
import { IRowOptions } from "./row";
import ResponsiveContainer, { IResponsiveContainerOptionalProps } from "../responsive-container";
import Virtualizer, { IVirtualizerOptionalProps } from "../virtualizer";
import {
  getAllIndexesMap,
  IIndexesMap,
  getItemsCustomSizes,
  relativeToAbsoluteIndexes,
  getIndexesIdsMapping,
  IIndexesIdsMapping,
  getColumnsLength,
  getCellPath,
  getCell,
  IElevateds,
  getDenseColumns,
  CustomSizesElements,
  relativeToAbsoluteObject,
  getRowslength,
  syncOpenedTreesWithRows,
  getFixedRowsIndexes,
} from "../utils/table";
import SelectionHandler, { ISelection, ISelectionHandlerOptionalProps } from "../table-selection/selection-handler";
import { DEFAULT_ROW_HEIGHT, ROW_SPAN_WIDTH } from "../constants";
import { ICell, ICellCoordinates } from "./cell";
import shallowEqual from "../utils/shallowEqual";
import { Group, GroupBranch, getGroupBranches } from "../utils/group";

interface IVirtualizerProps extends Partial<IVirtualizerOptionalProps> {
  /**  The width of the visible window. To specify if not responsive */
  width?: number;
  /**  The height of the visible window. To specify if not responsive */
  height?: number;
}

/**
 * We will be using something as close as possible to the original table,
 * with separated abstractions in this component
 * */
export interface ITableProps<IDataCoordinates = any> extends IElementaryTable<IDataCoordinates> {
  responsiveContainerProps: IResponsiveContainerOptionalProps;
  virtualizerProps: IVirtualizerProps;
  /** To specify column groups tree structure  */
  groups?: Group[];
  /** A list of branches to initialize opened rows and sub rows */
  initialOpenedTrees: ITrees;
  selectionProps?: ISelectionHandlerOptionalProps;
  isSelectable?: boolean;
  isVirtualized?: boolean;
  onOpenedTreesUpdate?: (openedTrees: ITrees) => void;
}

export interface IState {
  rowsLength: number;
  indexesMapping: IIndexesMap;
  columnsIndexesIdsMapping: IIndexesIdsMapping;
  openedTrees: ITrees;
  fixedRowsIndexes: number[];
}

class Table<IDataCoordinates = any> extends React.Component<ITableProps<IDataCoordinates>, IState> {
  static defaultProps = {
    isSelectable: true,
    isVirtualized: false,
    virtualizerProps: {},
    responsiveContainerProps: {},
    initialOpenedTrees: {},
  };

  private globalRowProps?: IRowOptions;

  private globalColumnProps?: IColumnOptions;

  private customCellsHeight: CustomSizesElements = {
    fixed: {
      sum: 0,
      count: 0,
    },
    scrollable: {
      sum: 0,
      count: 0,
    },
    customSizes: {},
  };

  private customCellsWidth: CustomSizesElements = {
    fixed: {
      sum: 0,
      count: 0,
    },
    scrollable: {
      sum: 0,
      count: 0,
    },
    customSizes: {},
  };

  private groupBranches: Record<string, GroupBranch> | undefined;

  private groupsDepth = 0;

  private virtualizer: React.RefObject<Virtualizer> = React.createRef<Virtualizer>();

  private columnsLength = 0;

  public constructor(props: ITableProps<IDataCoordinates>) {
    super(props);
    const {
      initialOpenedTrees,
      rows,
      columns,
      rowsProps,
      isVirtualized,
      groups,
      virtualizerProps: { fixedRows, fixedColumns, hiddenRows, hiddenColumns },
    } = this.props;
    this.columnsLength = getColumnsLength(rows);
    const indexesMapping = getAllIndexesMap(initialOpenedTrees, rows);
    this.state = {
      indexesMapping,
      openedTrees: initialOpenedTrees,
      rowsLength: getRowslength(initialOpenedTrees, rows),
      columnsIndexesIdsMapping: rows[0] ? getIndexesIdsMapping(rows[0].cells) : {},
      fixedRowsIndexes: getFixedRowsIndexes(initialOpenedTrees, indexesMapping.relative, rows, fixedRows),
    };
    if (isVirtualized) {
      this.customCellsHeight = getItemsCustomSizes(rowsProps, fixedRows, hiddenRows);
      this.customCellsWidth = getItemsCustomSizes(columns, fixedColumns, hiddenColumns);
    }
    this.initGroupsProps(groups);
  }

  public shouldComponentUpdate(nextProps: ITableProps<IDataCoordinates>, nextState: IState) {
    const { virtualizerProps, initialOpenedTrees, ...otherProps } = this.props;
    const { virtualizerProps: nextVirtualizerProps, initialOpenedTrees: nextInitialOpenedTrees, ...nextOtherProps } = nextProps;
    const { initialScroll, ...otherVirtualizerProps } = virtualizerProps;
    const { initialScroll: nextInitialScroll, ...nextOtherVirtualizerProps } = nextVirtualizerProps;
    return (
      !shallowEqual(this.state, nextState) ||
      !shallowEqual(otherProps, nextOtherProps) ||
      !shallowEqual(otherVirtualizerProps, nextOtherVirtualizerProps)
    );
  }

  static getDerivedStateFromProps(props: ITableProps, state: IState) {
    const {
      rows,
      virtualizerProps: { fixedRows },
    } = props;

    const newOpenedTrees = syncOpenedTreesWithRows(state.openedTrees, rows);

    const newIndexesMapping = getAllIndexesMap(newOpenedTrees, rows);
    return {
      openedTrees: newOpenedTrees,
      indexesMapping: newIndexesMapping,
      rowsLength: getRowslength(newOpenedTrees, rows),
      columnsIndexesIdsMapping: rows[0] ? getIndexesIdsMapping(rows[0].cells) : {},
      fixedRowsIndexes: getFixedRowsIndexes(newOpenedTrees, newIndexesMapping.relative, rows, fixedRows),
    };
  }

  public componentDidUpdate(prevProps: ITableProps<IDataCoordinates>) {
    const {
      rows,
      columns,
      rowsProps,
      isVirtualized,
      virtualizerProps,
      groups,
      virtualizerProps: { fixedColumns, hiddenColumns, fixedRows, hiddenRows },
    } = this.props;
    const { openedTrees, indexesMapping } = this.state;

    if (isVirtualized) {
      if (columns !== prevProps.columns) {
        this.customCellsWidth = getItemsCustomSizes(columns, fixedColumns, hiddenColumns);
      }
      if (rowsProps !== prevProps.rowsProps) {
        this.customCellsHeight = getItemsCustomSizes(rowsProps, fixedRows, hiddenRows);
      }
    }
    if (prevProps.groups !== groups) {
      this.initGroupsProps(groups);
    }

    if (prevProps.rows !== rows) {
      this.columnsLength = getColumnsLength(rows);
    } else if (!isEqual(prevProps.virtualizerProps?.fixedRows, virtualizerProps?.fixedRows)) {
      this.setState({
        fixedRowsIndexes: getFixedRowsIndexes(openedTrees, indexesMapping.relative, rows, fixedRows),
      });
    }
  }

  private initGroupsProps = (groups?: Group[]) => {
    const { depth, groupBranches } = getGroupBranches(groups);
    this.groupBranches = groupBranches;
    this.groupsDepth = depth;
  };

  private getColumnsProps = (cellWidth: number) => {
    const { globalColumnProps } = this.props;
    const newGlobalColumnProps = { ...globalColumnProps, size: cellWidth };
    if (!isEqual(this.globalColumnProps, newGlobalColumnProps)) {
      this.globalColumnProps = newGlobalColumnProps;
    }
    return this.globalColumnProps;
  };

  private getRowsProps = (cellHeight: number) => {
    const { globalRowProps } = this.props;
    const newGlobalRowProps = { ...globalRowProps, size: cellHeight };
    if (!isEqual(this.globalRowProps, newGlobalRowProps)) {
      this.globalRowProps = newGlobalRowProps;
    }
    return this.globalRowProps;
  };

  private updateRowsLength = (openedTrees: ITrees) => {
    const {
      rows,
      onOpenedTreesUpdate,
      virtualizerProps: { fixedRows },
    } = this.props;
    const newIndexesMapping = getAllIndexesMap(openedTrees, rows);
    const newRowsLength = getRowslength(openedTrees, rows);

    this.setState(
      {
        indexesMapping: newIndexesMapping,
        openedTrees,
        rowsLength: newRowsLength,
        fixedRowsIndexes: getFixedRowsIndexes(openedTrees, newIndexesMapping.relative, rows, fixedRows),
      },
      () => {
        if (onOpenedTreesUpdate) {
          onOpenedTreesUpdate(openedTrees);
        }
      }
    );
  };

  private onRowOpen = (openedTree: ITree) => {
    const { openedTrees } = this.state;
    const currentOpenedTrees = openedTrees || {};
    const newOpenedTrees = { ...currentOpenedTrees };
    // update the sub-tree to close
    newOpenedTrees[openedTree.rowIndex] = openedTree;
    this.updateRowsLength(newOpenedTrees);
  };

  private onRowClose = (closedTree: ITree) => {
    const { openedTrees } = this.state;
    const currentOpenedTrees = openedTrees || {};
    const newOpenedTrees = { ...currentOpenedTrees };
    // remove the sub-tree to close
    delete newOpenedTrees[closedTree.rowIndex];
    if (Object.keys(newOpenedTrees).length !== Object.keys(openedTrees).length) {
      this.updateRowsLength(newOpenedTrees);
    }
  };

  public openTrees = (trees: ITrees) => {
    const { openedTrees } = this.state;
    const currentOpenedTrees = openedTrees || {};
    const newOpenedTrees = { ...currentOpenedTrees, ...trees };
    this.updateRowsLength(newOpenedTrees);
  };

  public closeTrees = (trees: ITrees) => {
    const { openedTrees } = this.state;
    const currentOpenedTrees = openedTrees || {};
    const newOpenedTrees = { ...currentOpenedTrees };
    Object.keys(trees).forEach((rowId) => {
      delete newOpenedTrees[rowId];
    });
    this.updateRowsLength(newOpenedTrees);
  };

  public goToColumnIndex = (columnIndex: number) => {
    if (this.virtualizer.current) {
      const toColumnIndex = Math.max(Math.min(columnIndex, this.columnsLength - 1), 0);
      this.virtualizer.current.scrollToColumnIndex(toColumnIndex);
    }
  };

  public goToRowIndex = (rowIndex: number) => {
    if (this.virtualizer.current) {
      const { rowsLength } = this.state;
      const toRowIndex = Math.max(Math.min(rowIndex, rowsLength - 1), 0);
      this.virtualizer.current.scrollToRowIndex(toRowIndex);
    }
  };

  public goToColumnId = (columnId: string) => {
    if (this.virtualizer) {
      const columnIndex = this.getColumnIndex(columnId);
      if (columnIndex !== undefined) {
        this.goToColumnIndex(columnIndex);
      }
    }
  };

  public getColumnIndex = (columnId: string) => {
    const { columnsIndexesIdsMapping } = this.state;
    return columnsIndexesIdsMapping[columnId];
  };

  public getColumnId = (columnIndex: number) => {
    const { rows } = this.props;
    const header = rows[0] && rows[0].cells;
    const cell = header && header[columnIndex];
    return cell && cell.id;
  };

  public getCell = (cellCoordinates: ICellCoordinates): ICell<IDataCoordinates> => {
    const { rows } = this.props;
    const { indexesMapping, openedTrees } = this.state;
    const cellPath = getCellPath(cellCoordinates, indexesMapping.absolute, openedTrees);
    return getCell(rows, cellPath);
  };

  private renderTable = (
    visibleColumnIndexes?: number[],
    visibleRowIndexes?: number[],
    cellHeight?: number,
    cellWidth?: number,
    elevatedColumnIndexes?: IElevateds,
    elevatedRowIndexes?: IElevateds,
    fixedRowsIndexes?: number[],
    columns?: IColumns
  ) => {
    const {
      globalRowProps,
      globalColumnProps,
      isSelectable,
      selectionProps,
      responsiveContainerProps,
      virtualizerProps,
      isVirtualized,
      initialOpenedTrees,
      ...tableProps
    } = this.props;
    const { indexesMapping, openedTrees } = this.state;
    const renderElementaryTable = (selection: ISelection = { selectedCells: {} }): JSX.Element => (
      <ElementaryTable
        {...tableProps}
        {...selection}
        groupBranches={this.groupBranches}
        columns={columns || tableProps.columns}
        visibleColumnIndexes={visibleColumnIndexes || tableProps.visibleColumnIndexes}
        visibleRowIndexes={visibleRowIndexes || tableProps.visibleRowIndexes}
        fixedRowsIndexes={fixedRowsIndexes}
        globalRowProps={cellHeight ? this.getRowsProps(cellHeight) : globalRowProps}
        globalColumnProps={cellWidth ? this.getColumnsProps(cellWidth) : globalColumnProps}
        elevatedColumnIndexes={elevatedColumnIndexes || tableProps.elevatedColumnIndexes}
        elevatedRowIndexes={elevatedRowIndexes || tableProps.elevatedRowIndexes}
        onRowOpen={this.onRowOpen}
        onRowClose={this.onRowClose}
        indexesMapping={indexesMapping}
        openedTrees={openedTrees}
      />
    );
    return isSelectable ? (
      <SelectionHandler {...selectionProps}>{renderElementaryTable}</SelectionHandler>
    ) : (
      renderElementaryTable()
    );
  };

  private renderVirtualizedTable = (height: number, width: number) => {
    const {
      isSpan,
      virtualizerProps,
      virtualizerProps: { hiddenRows, horizontalPadding = 0 },
      columns,
      groupsProps,
    } = this.props;
    const { rowsLength, indexesMapping, fixedRowsIndexes } = this.state;
    // Include groups in the horizontal Padding
    const groupRowSize = groupsProps?.rowsOptions?.size || DEFAULT_ROW_HEIGHT;
    const tableHorizontalPadding = horizontalPadding + this.groupsDepth * groupRowSize;
    return (
      <Virtualizer
        ref={this.virtualizer}
        {...virtualizerProps}
        horizontalPadding={tableHorizontalPadding}
        fixedRows={fixedRowsIndexes}
        columnsLength={this.columnsLength}
        hiddenRows={hiddenRows && relativeToAbsoluteIndexes(hiddenRows, indexesMapping.relative)}
        rowsLength={rowsLength}
        width={width}
        height={height}
        customCellsHeight={{
          ...this.customCellsHeight,
          customSizes: relativeToAbsoluteObject(this.customCellsHeight.customSizes, indexesMapping.relative),
        }}
        customCellsWidth={this.customCellsWidth}
        verticalPadding={isSpan ? ROW_SPAN_WIDTH : 0}
      >
        {({ visibleColumnIndexes, visibleRowIndexes, elevatedColumnIndexes, elevatedRowIndexes, cellHeight, cellWidth }) => {
          const tableWidth =
            this.customCellsWidth.fixed.sum +
            this.customCellsWidth.scrollable.sum +
            (visibleColumnIndexes.length - this.customCellsWidth.fixed.count - this.customCellsWidth.scrollable.count) *
              cellWidth;
          const adjustedColumns = !virtualizerProps.fixedColumns?.includes(visibleColumnIndexes[visibleColumnIndexes.length - 1])
            ? getDenseColumns(tableWidth, width, this.columnsLength, columns)
            : columns;

          return this.renderTable(
            visibleColumnIndexes,
            visibleRowIndexes,
            cellHeight,
            cellWidth,
            elevatedColumnIndexes,
            elevatedRowIndexes,
            fixedRowsIndexes,
            adjustedColumns
          );
        }}
      </Virtualizer>
    );
  };

  private renderResponsiveTable = () => {
    const {
      responsiveContainerProps: { className },
    } = this.props;
    return (
      <ResponsiveContainer className={className}>
        {({ width, height }) => {
          return this.renderVirtualizedTable(height, width);
        }}
      </ResponsiveContainer>
    );
  };

  public render() {
    const {
      virtualizerProps: { height, width },
      isVirtualized,
    } = this.props;
    if (isVirtualized) {
      if (height && width) {
        return this.renderVirtualizedTable(height, width);
      }
      return this.renderResponsiveTable();
    }
    return this.renderTable();
  }
}

export default Table;
