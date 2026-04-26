import * as React from "react";

import ElementaryTable, { IElementaryTable, ITree, IColumns, ITrees } from "./elementary-table";
import ResponsiveContainer, { IResponsiveContainerOptionalProps } from "../responsive-container";
import Virtualizer, { IVirtualizerHandle, IVirtualizerOptionalProps } from "../virtualizer";
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
} from "../utils/table";
import SelectionHandler, { ISelection, ISelectionHandlerOptionalProps } from "../table-selection/selection-handler";
import { ROW_SPAN_WIDTH } from "../constants";
import { ICell, ICellCoordinates } from "./cell";
import { useGridKeyboardNavigation } from "../../hooks/useGridKeyboardNavigation";

export interface IVirtualizerNumericProps extends Partial<IVirtualizerOptionalProps> {
  width?: number;
  height?: number;
}

export interface ITableProps<IDataCoordinates = any> extends IElementaryTable<IDataCoordinates> {
  responsiveContainerProps?: IResponsiveContainerOptionalProps;
  virtualizerProps?: IVirtualizerNumericProps;
  initialOpenedTrees?: ITrees;
  selectionProps?: ISelectionHandlerOptionalProps;
  isSelectable?: boolean;
  isVirtualized?: boolean;
  onOpenedTreesUpdate?: (openedTrees: ITrees) => void;
  /**
   * Disable the built-in keyboard navigation. Default: navigation is **enabled**:
   * the grid wrapper takes Tab focus and arrow keys / Home / End / PageUp / PageDown
   * move the active cell. Cells are programmatically focusable; off-window cells are
   * scrolled into view automatically.
   */
  disableKeyboardNavigation?: boolean;
  /** Number of rows to step on PageUp/PageDown when keyboard navigation is enabled. */
  keyboardPageSize?: number;
  /**
   * Accessible name announced by screen readers when focus enters the grid.
   * Defaults to no label (the surrounding heading is usually enough). Use this when
   * the grid lives inside a custom container with no associated heading.
   */
  ariaLabel?: string;
  /** Id of the element that labels the grid (`aria-labelledby`). Mutually exclusive with `ariaLabel`. */
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
}

const EMPTY_CUSTOM_SIZES: CustomSizesElements = {
  fixed: { sum: 0, count: 0 },
  scrollable: { sum: 0, count: 0 },
  customSizes: {},
};

function TableInner<IDataCoordinates = any>(
  props: ITableProps<IDataCoordinates>,
  forwardedRef: React.ForwardedRef<ITableHandle<IDataCoordinates>>,
): JSX.Element {
  const {
    isSelectable = true,
    isVirtualized = false,
    virtualizerProps = {},
    responsiveContainerProps = {},
    initialOpenedTrees = {},
    selectionProps,
    rows,
    columns,
    rowsProps,
    isSpan,
    globalRowProps,
    globalColumnProps,
    onOpenedTreesUpdate,
    disableKeyboardNavigation = false,
    keyboardPageSize = 10,
    ariaLabel,
    ariaLabelledBy,
    ...elementaryProps
  } = props;
  const { fixedRows, fixedColumns, hiddenRows, hiddenColumns, ...otherVirtualizerProps } = virtualizerProps;

  const virtualizerRef = React.useRef<IVirtualizerHandle>(null);

  const [openedTrees, setOpenedTrees] = React.useState<ITrees>(initialOpenedTrees);

  const columnsLength = React.useMemo(() => getColumnsLength(rows), [rows]);

  const indexesMapping = React.useMemo(() => getAllIndexesMap(openedTrees, rows), [openedTrees, rows]);

  const rowsLength = React.useMemo(() => {
    const base = rows?.length ?? 0;
    return base + (openedTrees ? getTreesLength(openedTrees, rows) : 0);
  }, [rows, openedTrees]);

  const columnsIndexesIdsMapping = React.useMemo(() => (rows[0] ? getIndexesIdsMapping(rows[0].cells) : {}), [rows]);

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

  // Memoize the absolute-keyed view of customCellsHeight so the Virtualizer's `useMemo`
  // for the cache stays hit when only unrelated props change.
  const customCellsHeightAbsolute = React.useMemo(
    () => ({
      ...customCellsHeight,
      customSizes: relativeToAbsoluteObject(customCellsHeight.customSizes, indexesMapping.relative),
    }),
    [customCellsHeight, indexesMapping.relative],
  );

  const hiddenRowsAbsolute = React.useMemo(
    () => (hiddenRows ? relativeToAbsoluteIndexes(hiddenRows, indexesMapping.relative) : undefined),
    [hiddenRows, indexesMapping.relative],
  );

  const handleRowOpen = React.useCallback(
    (openedTree: ITree) => {
      setOpenedTrees((prev) => {
        const next = { ...prev, [openedTree.rowIndex]: openedTree };
        onOpenedTreesUpdate?.(next);
        return next;
      });
    },
    [onOpenedTreesUpdate],
  );

  const handleRowClose = React.useCallback(
    (closedTree: ITree) => {
      setOpenedTrees((prev) => {
        if (!(closedTree.rowIndex in prev)) return prev;
        const next = { ...prev };
        delete next[closedTree.rowIndex];
        onOpenedTreesUpdate?.(next);
        return next;
      });
    },
    [onOpenedTreesUpdate],
  );

  const openTrees = React.useCallback(
    (trees: ITrees) => {
      setOpenedTrees((prev) => {
        const next = { ...prev, ...trees };
        onOpenedTreesUpdate?.(next);
        return next;
      });
    },
    [onOpenedTreesUpdate],
  );

  const closeTrees = React.useCallback(
    (trees: ITrees) => {
      setOpenedTrees((prev) => {
        const next = { ...prev };
        Object.keys(trees).forEach((id) => delete next[Number(id)]);
        onOpenedTreesUpdate?.(next);
        return next;
      });
    },
    [onOpenedTreesUpdate],
  );

  const goToColumnIndex = React.useCallback(
    (columnIndex: number) => {
      const target = Math.max(Math.min(columnIndex, columnsLength - 1), 0);
      virtualizerRef.current?.scrollToColumnIndex(target);
    },
    [columnsLength],
  );

  const goToRowIndex = React.useCallback(
    (rowIndex: number) => {
      const target = Math.max(Math.min(rowIndex, rowsLength - 1), 0);
      virtualizerRef.current?.scrollToRowIndex(target);
    },
    [rowsLength],
  );

  const getColumnIndex = React.useCallback((columnId: string) => columnsIndexesIdsMapping[columnId], [columnsIndexesIdsMapping]);

  const goToColumnId = React.useCallback(
    (columnId: string) => {
      const idx = getColumnIndex(columnId);
      if (idx !== undefined) goToColumnIndex(idx);
    },
    [getColumnIndex, goToColumnIndex],
  );

  const getColumnId = React.useCallback(
    (columnIndex: number) => {
      const header = rows[0]?.cells;
      return header && header[columnIndex] ? header[columnIndex].id : undefined;
    },
    [rows],
  );

  const getCellByCoordinates = React.useCallback(
    (cellCoordinates: ICellCoordinates): ICell<IDataCoordinates> => {
      const cellPath = getCellPath(cellCoordinates, indexesMapping.absolute, openedTrees);
      return getCell(rows, cellPath);
    },
    [rows, indexesMapping.absolute, openedTrees],
  );

  const openedTreesRef = React.useRef(openedTrees);
  openedTreesRef.current = openedTrees;
  const getOpenedTrees = React.useCallback(() => openedTreesRef.current, []);

  React.useImperativeHandle(
    forwardedRef,
    () => ({
      openTrees,
      closeTrees,
      goToColumnIndex,
      goToRowIndex,
      goToColumnId,
      getColumnIndex,
      getColumnId,
      getCell: getCellByCoordinates,
      getOpenedTrees,
    }),
    [
      openTrees,
      closeTrees,
      goToColumnIndex,
      goToRowIndex,
      goToColumnId,
      getColumnIndex,
      getColumnId,
      getCellByCoordinates,
      getOpenedTrees,
    ],
  );

  const renderTable = React.useCallback(
    (
      visibleColumnIndexes?: number[],
      visibleRowIndexes?: number[],
      cellHeight?: number,
      cellWidth?: number,
      elevatedColumnIndexes?: IElementaryTable["elevatedColumnIndexes"],
      elevatedRowIndexes?: IElementaryTable["elevatedRowIndexes"],
      fixedRowsIdx?: number[],
      adjustedColumns?: IColumns,
    ): JSX.Element => {
      const renderElementaryTable = (selection: ISelection = { selectedCells: {} }) => (
        <ElementaryTable
          {...elementaryProps}
          {...selection}
          rows={rows}
          isSpan={isSpan}
          columns={adjustedColumns ?? columns}
          visibleColumnIndexes={visibleColumnIndexes ?? elementaryProps.visibleColumnIndexes}
          visibleRowIndexes={visibleRowIndexes ?? elementaryProps.visibleRowIndexes}
          fixedRowsIndexes={fixedRowsIdx}
          globalRowProps={cellHeight ? { ...globalRowProps, size: cellHeight } : globalRowProps}
          globalColumnProps={cellWidth ? { ...globalColumnProps, size: cellWidth } : globalColumnProps}
          elevatedColumnIndexes={elevatedColumnIndexes ?? elementaryProps.elevatedColumnIndexes}
          elevatedRowIndexes={elevatedRowIndexes ?? elementaryProps.elevatedRowIndexes}
          rowsProps={rowsProps}
          onRowOpen={handleRowOpen}
          onRowClose={handleRowClose}
          indexesMapping={indexesMapping}
          openedTrees={openedTrees}
          totalRowCount={rowsLength}
          totalColumnCount={columnsLength}
          multiSelectable={isSelectable}
        />
      );
      return isSelectable ? (
        <SelectionHandler {...selectionProps}>{renderElementaryTable as (props: ISelection) => JSX.Element}</SelectionHandler>
      ) : (
        renderElementaryTable()
      );
    },
    [
      elementaryProps,
      rows,
      columns,
      isSpan,
      globalRowProps,
      globalColumnProps,
      handleRowOpen,
      handleRowClose,
      indexesMapping,
      openedTrees,
      isSelectable,
      selectionProps,
      rowsProps,
      rowsLength,
      columnsLength,
    ],
  );

  const renderVirtualizedTable = React.useCallback(
    (height: number, width: number): JSX.Element => (
      <Virtualizer
        ref={virtualizerRef}
        {...otherVirtualizerProps}
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
        {({ visibleColumnIndexes, visibleRowIndexes, elevatedColumnIndexes, elevatedRowIndexes, cellHeight, cellWidth }) => {
          const tableWidth =
            customCellsWidth.fixed.sum +
            customCellsWidth.scrollable.sum +
            (visibleColumnIndexes.length - customCellsWidth.fixed.count - customCellsWidth.scrollable.count) * cellWidth;
          const adjustedColumns = !fixedColumns?.includes(visibleColumnIndexes[visibleColumnIndexes.length - 1])
            ? getDenseColumns(tableWidth, width, columnsLength, columns)
            : columns;
          return renderTable(
            visibleColumnIndexes,
            visibleRowIndexes,
            cellHeight,
            cellWidth,
            elevatedColumnIndexes,
            elevatedRowIndexes,
            fixedRowsIndexes,
            adjustedColumns,
          );
        }}
      </Virtualizer>
    ),
    [
      otherVirtualizerProps,
      fixedColumns,
      hiddenColumns,
      hiddenRowsAbsolute,
      fixedRowsIndexes,
      columnsLength,
      rowsLength,
      customCellsHeightAbsolute,
      customCellsWidth,
      isSpan,
      columns,
      renderTable,
    ],
  );

  // Keyboard navigation: wrap the rendered table in a focusable container that delegates
  // focus to the active cell on Tab-in and handles arrow / Home / End / PageUp/Down keys.
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
    disabled: disableKeyboardNavigation,
  });

  const wrap = (rendered: JSX.Element) => (
    <div
      ref={gridContainerRef}
      className="grid-keyboard-wrapper"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      {...(disableKeyboardNavigation ? {} : keyboardContainerProps)}
    >
      {rendered}
    </div>
  );

  if (isVirtualized) {
    if (virtualizerProps.height && virtualizerProps.width) {
      return wrap(renderVirtualizedTable(virtualizerProps.height, virtualizerProps.width));
    }
    return wrap(
      <ResponsiveContainer className={responsiveContainerProps.className}>
        {({ width, height }) => renderVirtualizedTable(height, width)}
      </ResponsiveContainer>,
    );
  }

  return wrap(renderTable());
}

const Table = React.forwardRef(TableInner) as <IDataCoordinates = any>(
  props: ITableProps<IDataCoordinates> & { ref?: React.ForwardedRef<ITableHandle<IDataCoordinates>> },
) => JSX.Element;

export default Table;
