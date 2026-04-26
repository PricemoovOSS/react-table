import * as React from "react";

import Scroller, { IOnScroll, IScrollerHandle, SCROLLBAR_SIZE } from "./scroller";
import { CustomSizesElements, IElevateds } from "./utils/table";
import { useVirtualizer, getScrollAxes, bindScrollerToVirtualizer, IUseVirtualizerProps } from "../hooks/useVirtualizer";
import { Nullable } from "./typing";

export interface IRowsState {
  /** Indexes of the rows to be always displayed */
  visibleRowIndexes: number[];
  /** Indexes of the rows that need to appear "elevated" thanks to a shadow */
  elevatedRowIndexes: IElevateds;
}

export interface IColumnState {
  /** Indexes of the columns to be always displayed */
  visibleColumnIndexes: number[];
  /** Indexes of the columns that need to appear "elevated" thanks to a shadow */
  elevatedColumnIndexes: IElevateds;
}

export interface OnVerticallyScrollProps {
  scrollValues: IOnScroll;
  newRowsState: Nullable<IRowsState>;
  rowsCursor: number;
}

export interface OnHorizontallyScrollProps {
  scrollValues: IOnScroll;
  newColumnsState: Nullable<IColumnState>;
  columnsCursor: number;
}

export interface OnScrollProps extends OnVerticallyScrollProps, OnHorizontallyScrollProps {}

export interface IVirtualizerChildrenProps extends IRowsState, IColumnState {
  /** The height of one cell of the grid */
  cellHeight: number;
  /** The width of one cell of the grid */
  cellWidth: number;
}

export interface IVirtualizerOptionalProps {
  /** List of fixed columns on the left or right of your table */
  fixedColumns: number[];
  /** List of fixed rows on the top or bottom of your table */
  fixedRows: number[];
  /** Number of rows that should be visible on screen */
  rowsCount?: number;
  /** Number of columns that should be visible on screen */
  columnsCount?: number;
  /** Minimal width of a column */
  minColumnWidth?: number;
  /** Minimal height of a row */
  minRowHeight?: number;
  /** Sum of the height of fixed rows with a pre-defined height */
  customCellsHeight: CustomSizesElements;
  /** Sum of the width of fixed columns with a pre-defined width */
  customCellsWidth: CustomSizesElements;
  /** A pre-defined vertical padding of the grid */
  verticalPadding: number;
  /** A pre-defined horizontal padding of the grid */
  horizontalPadding: number;
  /** Generic scroll handler. Called for both axes. */
  onScroll?: (props: OnScrollProps) => void;
  /** Vertical-only scroll handler */
  onVerticallyScroll?: (props: OnVerticallyScrollProps) => void;
  /** Horizontal-only scroll handler */
  onHorizontallyScroll?: (props: OnHorizontallyScrollProps) => void;
  /** Initial scroll positions */
  initialScroll: {
    columnIndex?: number;
    rowIndex?: number;
  };
  /** Indexes of the columns to be hidden */
  hiddenColumns: number[];
  /** Indexes of the rows to be hidden */
  hiddenRows: number[];
}

export interface IVirtualizerProps extends Partial<IVirtualizerOptionalProps> {
  /** Visible viewport width */
  width: number;
  /** Visible viewport height */
  height: number;
  /** Total number of columns */
  columnsLength: number;
  /** Total number of rows */
  rowsLength: number;
  /** Render-prop receiving the visible window descriptor */
  children: (props: IVirtualizerChildrenProps) => JSX.Element;
}

export interface IVirtualizerHandle {
  scrollToColumnIndex: (columnIndex: number) => boolean;
  scrollToRowIndex: (rowIndex: number) => boolean;
}

const EMPTY_CUSTOM_SIZES: CustomSizesElements = {
  fixed: { sum: 0, count: 0 },
  scrollable: { sum: 0, count: 0 },
  customSizes: {},
};

const Virtualizer = React.forwardRef<IVirtualizerHandle, IVirtualizerProps>(function Virtualizer(props, ref) {
  const {
    width,
    height,
    rowsLength,
    columnsLength,
    fixedColumns = [],
    fixedRows = [],
    hiddenColumns = [],
    hiddenRows = [],
    rowsCount,
    columnsCount,
    minColumnWidth,
    minRowHeight,
    customCellsHeight = EMPTY_CUSTOM_SIZES,
    customCellsWidth = EMPTY_CUSTOM_SIZES,
    horizontalPadding = 0,
    verticalPadding = 0,
    initialScroll = {},
    onScroll,
    onHorizontallyScroll,
    onVerticallyScroll,
    children,
  } = props;

  const virtualizerProps: IUseVirtualizerProps = React.useMemo(
    () => ({
      width,
      height,
      rowsLength,
      columnsLength,
      fixedRows,
      fixedColumns,
      hiddenRows,
      hiddenColumns,
      rowsCount,
      columnsCount,
      minRowHeight,
      minColumnWidth,
      customCellsHeight,
      customCellsWidth,
      verticalPadding,
      horizontalPadding,
      scrollbarSize: SCROLLBAR_SIZE,
    }),
    [
      width,
      height,
      rowsLength,
      columnsLength,
      fixedRows,
      fixedColumns,
      hiddenRows,
      hiddenColumns,
      rowsCount,
      columnsCount,
      minRowHeight,
      minColumnWidth,
      customCellsHeight,
      customCellsWidth,
      verticalPadding,
      horizontalPadding,
    ],
  );

  const virtualizer = useVirtualizer(virtualizerProps);
  const scrollerRef = React.useRef<IScrollerHandle>(null);

  const { getScrollLeftForColumnIndex, getScrollTopForRowIndex } = virtualizer;
  const handlers = React.useMemo(
    () => bindScrollerToVirtualizer(scrollerRef, getScrollLeftForColumnIndex, getScrollTopForRowIndex),
    [getScrollLeftForColumnIndex, getScrollTopForRowIndex],
  );

  React.useImperativeHandle(ref, () => handlers, [handlers]);

  // Apply initial scroll once on mount.
  const initialScrollAppliedRef = React.useRef(false);
  React.useEffect(() => {
    if (initialScrollAppliedRef.current) return;
    initialScrollAppliedRef.current = true;
    const { columnIndex, rowIndex } = initialScroll;
    if (columnIndex != null && columnIndex >= 0) handlers.scrollToColumnIndex(columnIndex);
    if (rowIndex != null && rowIndex >= 0) handlers.scrollToRowIndex(rowIndex);
  }, [handlers, initialScroll]);

  // Coalesce scroll events with rAF: trackpads can emit 100+ events/sec, but the visible
  // window changes at most once per frame. We keep only the latest scroll position and
  // process it on the next animation frame. We use two refs: a boolean for the "is a flush
  // pending" check (resilient to a synchronous rAF polyfill), and the rAF id for cancellation.
  const rafPendingRef = React.useRef(false);
  const rafIdRef = React.useRef<number | undefined>(undefined);
  const latestScrollRef = React.useRef<IOnScroll | undefined>(undefined);

  const flushScroll = React.useCallback(() => {
    rafPendingRef.current = false;
    rafIdRef.current = undefined;
    const scrollValues = latestScrollRef.current;
    if (!scrollValues) return;
    latestScrollRef.current = undefined;

    const axes = getScrollAxes(scrollValues);
    const newRowsState = axes.vertical ? virtualizer.computeRowsState(scrollValues.scrollTop) : null;
    const newColumnsState = axes.horizontal ? virtualizer.computeColumnsState(scrollValues.scrollLeft) : null;

    if (!onScroll && !onVerticallyScroll && !onHorizontallyScroll) return;

    const cursors = virtualizer.getCursors(
      newRowsState ?? {
        visibleRowIndexes: virtualizer.visibleRowIndexes,
        elevatedRowIndexes: virtualizer.elevatedRowIndexes,
      },
      newColumnsState ?? {
        visibleColumnIndexes: virtualizer.visibleColumnIndexes,
        elevatedColumnIndexes: virtualizer.elevatedColumnIndexes,
      },
    );

    onScroll?.({
      scrollValues,
      newRowsState,
      newColumnsState,
      rowsCursor: cursors.rowsCursor,
      columnsCursor: cursors.columnsCursor,
    });
    onVerticallyScroll?.({ scrollValues, newRowsState, rowsCursor: cursors.rowsCursor });
    onHorizontallyScroll?.({ scrollValues, newColumnsState, columnsCursor: cursors.columnsCursor });
  }, [virtualizer, onScroll, onHorizontallyScroll, onVerticallyScroll]);

  const handleScroll = React.useCallback(
    (scrollValues: IOnScroll) => {
      latestScrollRef.current = scrollValues;
      if (rafPendingRef.current) return;
      rafPendingRef.current = true;
      rafIdRef.current = requestAnimationFrame(flushScroll);
    },
    [flushScroll],
  );

  // Cancel any pending rAF on unmount.
  React.useEffect(
    () => () => {
      if (rafIdRef.current != null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = undefined;
      }
    },
    [],
  );

  return (
    <Scroller
      ref={scrollerRef}
      width={width}
      height={height}
      virtualWidth={virtualizer.virtualWidth}
      virtualHeight={virtualizer.virtualHeight}
      onScroll={handleScroll}
      horizontalPartWidth={virtualizer.cellWidth}
      ignoredHorizontalParts={hiddenColumns}
    >
      {children({
        visibleColumnIndexes: virtualizer.visibleColumnIndexes,
        visibleRowIndexes: virtualizer.visibleRowIndexes,
        elevatedColumnIndexes: virtualizer.elevatedColumnIndexes,
        elevatedRowIndexes: virtualizer.elevatedRowIndexes,
        cellHeight: virtualizer.cellHeight,
        cellWidth: virtualizer.cellWidth,
      })}
    </Scroller>
  );
});

export default Virtualizer;
