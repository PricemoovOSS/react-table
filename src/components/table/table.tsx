import * as React from "react";
import ElementaryTable, { IElementaryTable, IColumns, ITrees, IColumnOptions } from "./elementary-table";
import ResponsiveContainer, { IResponsiveContainerOptionalProps } from "../responsive-container";
import Virtualizer, { IVirtualizerChildrenProps, IVirtualizerHandle, IVirtualizerOptionalProps } from "../virtualizer";
import {
  getTreesLength,
  getAllIndexesMap,
  getItemsCustomSizes,
  relativeToAbsoluteIndexes,
  getIndexesIdsMapping,
  getColumnsLength,
  getCellPath,
  getCell,
  getDenseColumns,
  CustomSizesElements,
  relativeToAbsoluteObject,
  IIndexesMap,
  IIndexesIdsMapping,
} from "../utils/table";
import SelectionHandler, { ISelection, ISelectionHandlerOptionalProps } from "../table-selection/selection-handler";
import { DEFAULT_ROW_HEIGHT, ROW_SPAN_WIDTH } from "../constants";
import { ICell, ICellCoordinates } from "./cell";
import { IRow, IRowOptions } from "./row";
import { Group, getGroupBranches } from "../utils/group";
import { useGridKeyboardNavigation } from "../../hooks/useGridKeyboardNavigation";
import { useOpenedTrees } from "../../hooks/useOpenedTrees";
import { sameCustomSizes, sameIndexes, useStableOptions, useStableValue } from "../../hooks/useStableValue";
import shallowEqual from "../utils/shallowEqual";
import { isEmptyObj } from "../utils/common";

export interface IVirtualizerNumericProps extends Partial<IVirtualizerOptionalProps> {
  width?: number;
  height?: number;
}

export interface ITableProps<IDataCoordinates = any> extends IElementaryTable<IDataCoordinates> {
  responsiveContainerProps?: IResponsiveContainerOptionalProps;
  virtualizerProps?: IVirtualizerNumericProps;
  /** To specify column groups tree structure  */
  groups?: Group[];
  initialOpenedTrees?: ITrees;
  selectionProps?: ISelectionHandlerOptionalProps;
  isSelectable?: boolean;
  isVirtualized?: boolean;
  onOpenedTreesUpdate?: (openedTrees: ITrees) => void;
  /**
   * Keyboard navigation between cells (WAI-ARIA grid pattern): arrow keys, Home / End,
   * PageUp / PageDown. Off by default. Keys typed in a field, a button or any other
   * element rendered inside a cell are never handled.
   */
  keyboardNavigation?: boolean;
  /** Number of rows to step on PageUp/PageDown when keyboard navigation is enabled. */
  keyboardPageSize?: number;
  /** Accessible name of the table. Mutually exclusive with `ariaLabelledBy`. */
  ariaLabel?: string;
  /** Id of the element that labels the table (`aria-labelledby`). */
  ariaLabelledBy?: string;
}

export interface ITableHandle<IDataCoordinates = any> {
  openTrees: (trees: ITrees) => void;
  closeTrees: (trees: ITrees) => void;
  goToColumnIndex: (columnIndex: number) => void;
  goToRowIndex: (rowIndex: number) => void;
  goToColumnId: (columnId: string) => void;
  getColumnIndex: (columnId: string) => number | undefined;
  getColumnId: (columnIndex: number) => string | undefined;
  getCell: (cellCoordinates: ICellCoordinates) => ICell<IDataCoordinates>;
  /** Returns the currently opened trees (read-only snapshot). */
  getOpenedTrees: () => ITrees;
  /**
   * Calls the listener each time the columns change (inserted, removed, moved): column ids
   * resolved through `getColumnIndex` have to be resolved again. Returns how to stop.
   */
  onColumnsChange: (listener: () => void) => () => void;
}

const EMPTY_CUSTOM_SIZES: CustomSizesElements = {
  fixed: { sum: 0, count: 0 },
  scrollable: { sum: 0, count: 0 },
  customSizes: {},
};
const EMPTY_TREES: ITrees = {};
const EMPTY_VIRTUALIZER_PROPS: IVirtualizerNumericProps = {};
const EMPTY_RESPONSIVE_PROPS: IResponsiveContainerOptionalProps = {};
const NO_SELECTION: ISelection = { selectedCells: {} };

/** What the handle methods read when they are called. */
interface ITableSnapshot {
  rows: IRow[];
  indexesMapping: IIndexesMap;
  columnsIndexesIdsMapping: IIndexesIdsMapping;
  columnsLength: number;
  rowsLength: number;
}

type TreesActions = Pick<ITableHandle, "openTrees" | "closeTrees" | "getOpenedTrees">;

/**
 * Place of every row among the displayed rows. Without any opened row it only depends on the
 * number of rows: new rows of the same length (updated values) keep the same mapping, and
 * nothing that depends on it is computed again.
 */
function useIndexesMapping(openedTrees: ITrees, rows: IRow[]): IIndexesMap {
  const last = React.useRef<{ trees: ITrees; length: number; mapping: IIndexesMap } | null>(null);
  return React.useMemo(() => {
    const known = last.current;
    const isSameMapping = known && known.length === rows.length && isEmptyObj(known.trees) && isEmptyObj(openedTrees);
    if (known && isSameMapping) return known.mapping;
    const mapping = getAllIndexesMap(openedTrees, rows);
    last.current = { trees: openedTrees, length: rows.length, mapping };
    return mapping;
    // the number of rows: rows appended to the same array are seen at the next render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openedTrees, rows, rows.length]);
}

const clampIndex = (index: number, length: number) => Math.max(Math.min(index, length - 1), 0);

/** The handle is created once: its methods read the current table through the refs. */
function createTableHandle<IDataCoordinates>(
  snapshot: React.MutableRefObject<ITableSnapshot>,
  virtualizer: React.RefObject<IVirtualizerHandle>,
  trees: TreesActions,
  columnsListeners: Set<() => void>,
): ITableHandle<IDataCoordinates> {
  const getColumnIndex = (columnId: string) => snapshot.current.columnsIndexesIdsMapping[columnId];
  const goToColumnIndex = (columnIndex: number) => {
    virtualizer.current?.scrollToColumnIndex(clampIndex(columnIndex, snapshot.current.columnsLength));
  };
  return {
    ...trees,
    getColumnIndex,
    goToColumnIndex,
    onColumnsChange: (listener) => {
      columnsListeners.add(listener);
      return () => void columnsListeners.delete(listener);
    },
    goToRowIndex: (rowIndex) => {
      virtualizer.current?.scrollToRowIndex(clampIndex(rowIndex, snapshot.current.rowsLength));
    },
    goToColumnId: (columnId) => {
      const columnIndex = getColumnIndex(columnId);
      if (columnIndex !== undefined) goToColumnIndex(columnIndex);
    },
    getColumnId: (columnIndex) => snapshot.current.rows[0]?.cells[columnIndex]?.id,
    getCell: (cellCoordinates) => {
      const { rows, indexesMapping } = snapshot.current;
      return getCell(rows, getCellPath(cellCoordinates, indexesMapping.absolute, trees.getOpenedTrees()));
    },
  };
}

interface ITableContentProps<IDataCoordinates = any>
  extends IElementaryTable<IDataCoordinates>, Partial<IVirtualizerChildrenProps> {
  indexesMapping: IIndexesMap;
  openedTrees: ITrees;
  groupBranches: React.ComponentProps<typeof ElementaryTable>["groupBranches"];
  fixedRowsIndexes?: number[];
  fixedColumns?: number[];
  customCellsWidth: CustomSizesElements;
  columnsLength: number;
  rowsLength: number;
  /** Width of the visible window, only known when the table is virtualized */
  viewportWidth?: number;
  isSelectable: boolean;
  selectionProps?: ISelectionHandlerOptionalProps;
  keyboardNavigation: boolean;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  onRowOpen: React.ComponentProps<typeof ElementaryTable>["onRowOpen"];
  onRowClose: React.ComponentProps<typeof ElementaryTable>["onRowClose"];
}

/** The last column takes the remaining width when the visible columns do not fill the window. */
function getWindowColumns(
  columns: IColumns | undefined,
  {
    visibleColumnIndexes,
    cellWidth,
    viewportWidth,
    fixedColumns,
    customCellsWidth,
    columnsLength,
  }: Pick<
    ITableContentProps,
    "visibleColumnIndexes" | "cellWidth" | "viewportWidth" | "fixedColumns" | "customCellsWidth" | "columnsLength"
  >,
): IColumns | undefined {
  if (!visibleColumnIndexes || cellWidth === undefined || viewportWidth === undefined) return columns;
  const lastVisibleColumn = visibleColumnIndexes[visibleColumnIndexes.length - 1];
  if (fixedColumns?.includes(lastVisibleColumn)) return columns;
  const { fixed, scrollable } = customCellsWidth;
  const defaultSizedColumns = visibleColumnIndexes.length - fixed.count - scrollable.count;
  const tableWidth = fixed.sum + scrollable.sum + defaultSizedColumns * cellWidth;
  return getDenseColumns(tableWidth, viewportWidth, columnsLength, columns);
}

const withSize = <Options extends IRowOptions | IColumnOptions>(options: Options | undefined, size?: number) =>
  size ? ({ ...options, size } as Options) : options;

/**
 * The table for a given visible window. Memoized: a render of the parent that changes
 * neither the data nor the window does not reach the rows.
 */
function TableContentInner<IDataCoordinates = any>(props: ITableContentProps<IDataCoordinates>): JSX.Element {
  const {
    visibleColumnIndexes,
    visibleRowIndexes,
    elevatedColumnIndexes,
    elevatedRowIndexes,
    cellHeight,
    cellWidth,
    viewportWidth,
    fixedRowsIndexes,
    fixedColumns,
    customCellsWidth,
    columnsLength,
    rowsLength,
    isSelectable,
    selectionProps,
    columns,
    globalRowProps,
    globalColumnProps,
    ...tableProps
  } = props;

  const sizedRowProps = React.useMemo(() => withSize(globalRowProps, cellHeight), [globalRowProps, cellHeight]);
  const sizedColumnProps = React.useMemo(() => withSize(globalColumnProps, cellWidth), [globalColumnProps, cellWidth]);
  // Kept by each table: two tables narrower than their window must not take each other's columns
  const windowColumns = React.useMemo(
    () =>
      getWindowColumns(columns, {
        visibleColumnIndexes,
        cellWidth,
        viewportWidth,
        fixedColumns,
        customCellsWidth,
        columnsLength,
      }),
    [columns, visibleColumnIndexes, cellWidth, viewportWidth, fixedColumns, customCellsWidth, columnsLength],
  );

  const renderElementaryTable = (selection: ISelection = NO_SELECTION) => (
    <ElementaryTable
      {...tableProps}
      {...selection}
      columns={windowColumns}
      visibleColumnIndexes={visibleColumnIndexes}
      visibleRowIndexes={visibleRowIndexes}
      elevatedColumnIndexes={elevatedColumnIndexes}
      elevatedRowIndexes={elevatedRowIndexes}
      fixedRowsIndexes={cellHeight === undefined ? undefined : fixedRowsIndexes}
      globalRowProps={sizedRowProps}
      globalColumnProps={sizedColumnProps}
      totalRowCount={rowsLength}
      totalColumnCount={columnsLength}
      multiSelectable={isSelectable}
    />
  );

  return isSelectable ? (
    <SelectionHandler {...selectionProps}>{renderElementaryTable}</SelectionHandler>
  ) : (
    renderElementaryTable()
  );
}

const TableContent = React.memo(TableContentInner) as typeof TableContentInner;

function TableInner<IDataCoordinates = any>(
  props: ITableProps<IDataCoordinates>,
  forwardedRef: React.ForwardedRef<ITableHandle<IDataCoordinates>>,
): JSX.Element {
  const {
    isSelectable = true,
    isVirtualized = false,
    virtualizerProps = EMPTY_VIRTUALIZER_PROPS,
    responsiveContainerProps = EMPTY_RESPONSIVE_PROPS,
    initialOpenedTrees = EMPTY_TREES,
    selectionProps,
    rows,
    columns: inlineColumns,
    rowsProps: inlineRowsProps,
    isSpan,
    onOpenedTreesUpdate,
    groups,
    keyboardNavigation = false,
    keyboardPageSize = 10,
    ...elementaryProps
  } = props;
  const {
    fixedRows: inlineFixedRows,
    fixedColumns: inlineFixedColumns,
    hiddenRows: inlineHiddenRows,
    hiddenColumns: inlineHiddenColumns,
    horizontalPadding = 0,
    ...otherVirtualizerProps
  } = virtualizerProps;

  // Applications pass these as inline arrays and objects: their content is what matters.
  const fixedRows = useStableValue(inlineFixedRows, sameIndexes);
  const fixedColumns = useStableValue(inlineFixedColumns, sameIndexes);
  const hiddenRows = useStableValue(inlineHiddenRows, sameIndexes);
  const hiddenColumns = useStableValue(inlineHiddenColumns, sameIndexes);
  // Options given by index are often rebuilt with the data: the same content is the same options
  const columns = useStableOptions(inlineColumns);
  const rowsProps = useStableOptions(inlineRowsProps);
  const groupsProps = useStableOptions(props.groupsProps);
  const globalRowProps = useStableOptions(props.globalRowProps);
  const globalColumnProps = useStableOptions(props.globalColumnProps);

  const virtualizerRef = React.useRef<IVirtualizerHandle>(null);

  const { openedTrees, openRow, closeRow, openTrees, closeTrees, getOpenedTrees } = useOpenedTrees(
    initialOpenedTrees,
    rows,
    onOpenedTreesUpdate,
  );

  const { depth: groupsDepth, groupBranches } = React.useMemo(() => getGroupBranches(groups), [groups]);
  // The group rows take their height from the space given to the rows
  const groupRowSize = groupsProps?.rowsOptions?.size || DEFAULT_ROW_HEIGHT;
  const tableHorizontalPadding = horizontalPadding + groupsDepth * groupRowSize;

  const columnsLength = React.useMemo(() => getColumnsLength(rows), [rows]);

  const indexesMapping = useIndexesMapping(openedTrees, rows);

  const rowsLength = React.useMemo(() => {
    const base = rows?.length ?? 0;
    return base + (openedTrees ? getTreesLength(openedTrees, rows) : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, rows?.length, openedTrees]);

  const columnsIndexesIdsMapping = useStableValue(
    React.useMemo(() => (rows[0] ? getIndexesIdsMapping(rows[0].cells) : {}), [rows]),
    shallowEqual,
  );

  const fixedRowsIndexes = React.useMemo(() => {
    const newFixedAbsolute = (fixedRows && relativeToAbsoluteIndexes(fixedRows, indexesMapping.relative)) || [];
    return Object.keys(openedTrees).reduce<number[]>((result, rowIndex) => {
      const row = rows[Number(rowIndex)];
      if (!row?.fixSubRows) return result;
      const relMapping = indexesMapping.relative[Number(rowIndex)];
      const subItems = relMapping?.subItems || {};
      Object.keys(subItems).forEach((subKey) => {
        result.push(subItems[Number(subKey)].index);
      });
      return result;
    }, newFixedAbsolute);
  }, [fixedRows, indexesMapping.relative, openedTrees, rows]);

  const customCellsHeight = React.useMemo(
    () => (isVirtualized ? getItemsCustomSizes(rowsProps, fixedRows, hiddenRows) : EMPTY_CUSTOM_SIZES),
    [isVirtualized, rowsProps, fixedRows, hiddenRows],
  );

  const customCellsWidth = React.useMemo(
    () => (isVirtualized ? getItemsCustomSizes(columns, fixedColumns, hiddenColumns) : EMPTY_CUSTOM_SIZES),
    [isVirtualized, columns, fixedColumns, hiddenColumns],
  );

  const customCellsHeightAbsolute = useStableValue(
    React.useMemo(
      () => ({
        ...customCellsHeight,
        customSizes: relativeToAbsoluteObject(customCellsHeight.customSizes, indexesMapping.relative),
      }),
      [customCellsHeight, indexesMapping.relative],
    ),
    sameCustomSizes,
  );

  const hiddenRowsAbsolute = React.useMemo(
    () => (hiddenRows ? relativeToAbsoluteIndexes(hiddenRows, indexesMapping.relative) : undefined),
    [hiddenRows, indexesMapping.relative],
  );

  // Written during the render: a cell content or a menu that calls the handle while it renders
  // reads the rows being rendered, as it did on the instance of the former class component.
  const snapshot = React.useRef<ITableSnapshot>({ rows, indexesMapping, columnsIndexesIdsMapping, columnsLength, rowsLength });
  snapshot.current = { rows, indexesMapping, columnsIndexesIdsMapping, columnsLength, rowsLength };
  const [columnsListeners] = React.useState(() => new Set<() => void>());
  const handle = React.useMemo(
    () =>
      createTableHandle<IDataCoordinates>(snapshot, virtualizerRef, { openTrees, closeTrees, getOpenedTrees }, columnsListeners),
    [openTrees, closeTrees, getOpenedTrees, columnsListeners],
  );
  // The handle stays the same object: who resolved column ids through it is told to do it again.
  const notifiedColumns = React.useRef(columnsIndexesIdsMapping);
  React.useLayoutEffect(() => {
    if (notifiedColumns.current === columnsIndexesIdsMapping) return;
    notifiedColumns.current = columnsIndexesIdsMapping;
    columnsListeners.forEach((listener) => listener());
  }, [columnsIndexesIdsMapping, columnsListeners]);
  React.useImperativeHandle(forwardedRef, () => handle, [handle]);

  const gridContainerRef = React.useRef<HTMLDivElement | null>(null);
  const scrollToCell = React.useCallback((rowIndex: number, columnIndex: number) => {
    virtualizerRef.current?.scrollToRowIndex(rowIndex);
    virtualizerRef.current?.scrollToColumnIndex(columnIndex);
  }, []);
  const { containerProps: keyboardContainerProps } = useGridKeyboardNavigation(gridContainerRef, {
    totalRows: rowsLength,
    totalColumns: columnsLength,
    pageSize: keyboardPageSize,
    hiddenRows: hiddenRowsAbsolute,
    hiddenColumns,
    scrollToCell: isVirtualized ? scrollToCell : undefined,
    disabled: !keyboardNavigation,
  });

  const renderContent = (window?: IVirtualizerChildrenProps, viewportWidth?: number) => (
    <TableContent
      {...elementaryProps}
      {...window}
      viewportWidth={viewportWidth}
      rows={rows}
      columns={columns}
      rowsProps={rowsProps}
      isSpan={isSpan}
      groupBranches={groupBranches}
      groupsProps={groupsProps}
      globalRowProps={globalRowProps}
      globalColumnProps={globalColumnProps}
      indexesMapping={indexesMapping}
      openedTrees={openedTrees}
      fixedRowsIndexes={fixedRowsIndexes}
      fixedColumns={fixedColumns}
      customCellsWidth={customCellsWidth}
      columnsLength={columnsLength}
      rowsLength={rowsLength}
      isSelectable={isSelectable}
      selectionProps={selectionProps}
      keyboardNavigation={keyboardNavigation}
      onRowOpen={openRow}
      onRowClose={closeRow}
    />
  );

  const renderVirtualizedTable = (height: number, width: number) => (
    <Virtualizer
      ref={virtualizerRef}
      {...otherVirtualizerProps}
      horizontalPadding={tableHorizontalPadding}
      fixedRows={fixedRowsIndexes}
      fixedColumns={fixedColumns}
      hiddenColumns={hiddenColumns}
      columnsLength={columnsLength}
      hiddenRows={hiddenRowsAbsolute}
      rowsLength={rowsLength}
      width={width}
      height={height}
      customCellsHeight={customCellsHeightAbsolute}
      customCellsWidth={customCellsWidth}
      verticalPadding={isSpan ? ROW_SPAN_WIDTH : 0}
    >
      {(window) => renderContent(window, width)}
    </Virtualizer>
  );

  const renderTable = () => {
    if (!isVirtualized) return renderContent();
    if (virtualizerProps.height && virtualizerProps.width) {
      return renderVirtualizedTable(virtualizerProps.height, virtualizerProps.width);
    }
    return (
      <ResponsiveContainer className={responsiveContainerProps.className}>
        {({ width, height }) => renderVirtualizedTable(height, width)}
      </ResponsiveContainer>
    );
  };

  if (!keyboardNavigation) return renderTable();

  // The container takes the Tab stop and hands the focus over to the active cell.
  return (
    <div ref={gridContainerRef} className="grid-keyboard-wrapper" {...keyboardContainerProps}>
      {renderTable()}
    </div>
  );
}

const Table = React.forwardRef(TableInner) as <IDataCoordinates = any>(
  props: ITableProps<IDataCoordinates> & { ref?: React.ForwardedRef<ITableHandle<IDataCoordinates>> },
) => JSX.Element;

export default Table;
