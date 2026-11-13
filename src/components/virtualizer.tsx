import * as React from "react";
import { flushSync } from "react-dom";

import Scroller, { IOnScroll, IScrollerHandle, SCROLLBAR_SIZE } from "./scroller";
import { CustomSizesElements, IElevateds } from "./utils/table";
import { useVirtualizer, getScrollAxes, bindScrollerToVirtualizer, IUseVirtualizerProps } from "../hooks/useVirtualizer";
import { Nullable } from "./typing";
import { useLatest } from "../hooks/useLatest";
import { sameIndexes, useStableValue } from "../hooks/useStableValue";

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
  /** The custom scrollbar size */
  scrollbarSize?: number;
  /**
   * Distance to the bottom or right edge, in pixels, from which the scroll handlers get
   * `maxBottomReached` / `maxRightReached`: how early the next page is asked for. Default: 5.
   */
  scrollEndThreshold?: number;
  /**
   * Renders the new window inside the scroll event: it is painted with the scroll position
   * that caused it. `false` lets React schedule that render: it is painted one frame later,
   * and other updates of the application can come first. Default: true.
   */
  synchronousScrollRendering?: boolean;
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

export interface VirtualizerContextProps {
  cellHeight: number;
  cellWidth: number;
  visibleColumnIndexes: number[];
  visibleRowIndexes: number[];
}

export const VirtualizerContext: React.Context<VirtualizerContextProps> = React.createContext<VirtualizerContextProps>({
  cellHeight: 0,
  cellWidth: 0,
  visibleColumnIndexes: [],
  visibleRowIndexes: [],
});

const EMPTY_CUSTOM_SIZES: CustomSizesElements = {
  fixed: { sum: 0, count: 0 },
  scrollable: { sum: 0, count: 0 },
  customSizes: {},
};
const NO_INDEXES: number[] = [];
const NO_INITIAL_SCROLL: NonNullable<IVirtualizerProps["initialScroll"]> = {};

/** A synchronous render, in a scroll event, is painted by the frame of that event: with the scroll that caused it. */
function renderAtOnce<Result>(isSynchronous: boolean, update: () => Result): Result {
  return isSynchronous ? flushSync(update) : update();
}

const Virtualizer = React.forwardRef<IVirtualizerHandle, IVirtualizerProps>(function Virtualizer(props, ref) {
  const {
    width,
    height,
    rowsLength,
    columnsLength,
    rowsCount,
    columnsCount,
    minColumnWidth,
    minRowHeight,
    scrollbarSize = SCROLLBAR_SIZE,
    scrollEndThreshold,
    synchronousScrollRendering = true,
    customCellsHeight = EMPTY_CUSTOM_SIZES,
    customCellsWidth = EMPTY_CUSTOM_SIZES,
    horizontalPadding = 0,
    verticalPadding = 0,
    initialScroll = NO_INITIAL_SCROLL,
    onScroll,
    onHorizontallyScroll,
    onVerticallyScroll,
    children,
  } = props;
  // Index lists are often passed inline: only a change of content rebuilds the cache.
  const fixedColumns = useStableValue(props.fixedColumns ?? NO_INDEXES, sameIndexes);
  const fixedRows = useStableValue(props.fixedRows ?? NO_INDEXES, sameIndexes);
  const hiddenColumns = useStableValue(props.hiddenColumns ?? NO_INDEXES, sameIndexes);
  const hiddenRows = useStableValue(props.hiddenRows ?? NO_INDEXES, sameIndexes);

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
      scrollbarSize,
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
      scrollbarSize,
    ],
  );

  const virtualizer = useVirtualizer(virtualizerProps);
  const scrollerRef = React.useRef<IScrollerHandle>(null);

  const { getScrollLeftForColumnIndex, getScrollTopForRowIndex, computeRowsState, computeColumnsState } = virtualizer;
  const handlers = React.useMemo(() => {
    const scrollTo = bindScrollerToVirtualizer(scrollerRef, getScrollLeftForColumnIndex, getScrollTopForRowIndex);
    // A scroll asked by program moves the window without waiting for the scroll event: the frame
    // that shows the new position shows its items, and where no event follows (jsdom) the window
    // moves all the same, as it did in 4.x. The handlers are called by the event, when there is one.
    const moveWindow = (hasScrolled: boolean) => {
      const position = hasScrolled ? scrollerRef.current?.getScrollValues() : undefined;
      if (position) {
        computeRowsState(position.scrollTop);
        computeColumnsState(position.scrollLeft);
      }
      return hasScrolled;
    };
    return {
      scrollToColumnIndex: (columnIndex: number) => moveWindow(scrollTo.scrollToColumnIndex(columnIndex)),
      scrollToRowIndex: (rowIndex: number) => moveWindow(scrollTo.scrollToRowIndex(rowIndex)),
    };
  }, [getScrollLeftForColumnIndex, getScrollTopForRowIndex, computeRowsState, computeColumnsState]);

  React.useImperativeHandle(ref, () => handlers, [handlers]);

  // Apply initial scroll once on mount, before the first paint: the table is never shown at
  // the start to jump afterwards, and a layout effect of the parent reads the final position.
  const initialScrollAppliedRef = React.useRef(false);
  React.useLayoutEffect(() => {
    if (initialScrollAppliedRef.current) return;
    initialScrollAppliedRef.current = true;
    const { columnIndex, rowIndex } = initialScroll;
    // the first item is where the table starts: asking for it must not scroll, nor call the scroll handlers
    if (columnIndex != null && columnIndex > 0) handlers.scrollToColumnIndex(columnIndex);
    if (rowIndex != null && rowIndex > 0) handlers.scrollToRowIndex(rowIndex);
  }, [handlers, initialScroll]);

  // A scroll event is processed when it is received, as in 4.x: browsers send one per frame and
  // per element, before the animation callbacks of that frame. The new window is rendered at
  // once, so the frame that shows a scroll position also shows its rows and columns.
  const latest = useLatest({
    virtualizer,
    onScroll,
    onHorizontallyScroll,
    onVerticallyScroll,
    synchronousScrollRendering,
  });

  const handleScroll = React.useCallback(
    (scrollValues: IOnScroll) => {
      const current = latest.current;
      const axes = getScrollAxes(scrollValues);
      const [newRowsState, newColumnsState] = renderAtOnce<[Nullable<IRowsState>, Nullable<IColumnState>]>(
        current.synchronousScrollRendering,
        () => [
          axes.vertical ? current.virtualizer.computeRowsState(scrollValues.scrollTop) : null,
          axes.horizontal ? current.virtualizer.computeColumnsState(scrollValues.scrollLeft) : null,
        ],
      );

      if (!current.onScroll && !current.onVerticallyScroll && !current.onHorizontallyScroll) return;

      const { rowsCursor, columnsCursor } = current.virtualizer.getCursors(
        newRowsState ?? {
          visibleRowIndexes: current.virtualizer.visibleRowIndexes,
          elevatedRowIndexes: current.virtualizer.elevatedRowIndexes,
        },
        newColumnsState ?? {
          visibleColumnIndexes: current.virtualizer.visibleColumnIndexes,
          elevatedColumnIndexes: current.virtualizer.elevatedColumnIndexes,
        },
      );

      current.onScroll?.({ scrollValues, newRowsState, newColumnsState, rowsCursor, columnsCursor });
      current.onHorizontallyScroll?.({ scrollValues, newColumnsState, columnsCursor });
      current.onVerticallyScroll?.({ scrollValues, newRowsState, rowsCursor });
    },
    [latest],
  );

  const { cellHeight, cellWidth, visibleColumnIndexes, visibleRowIndexes } = virtualizer;
  const contextValue = React.useMemo(
    () => ({ cellHeight, cellWidth, visibleColumnIndexes, visibleRowIndexes }),
    [cellHeight, cellWidth, visibleColumnIndexes, visibleRowIndexes],
  );

  return (
    <Scroller
      ref={scrollerRef}
      width={width}
      height={height}
      virtualWidth={virtualizer.virtualWidth}
      virtualHeight={virtualizer.virtualHeight}
      onScroll={handleScroll}
      horizontalPartWidth={cellWidth}
      ignoredHorizontalParts={hiddenColumns}
      scrollbarSize={scrollbarSize}
      scrollEndThreshold={scrollEndThreshold}
    >
      <VirtualizerContext.Provider value={contextValue}>
        {children({
          visibleColumnIndexes,
          visibleRowIndexes,
          elevatedColumnIndexes: virtualizer.elevatedColumnIndexes,
          elevatedRowIndexes: virtualizer.elevatedRowIndexes,
          cellHeight,
          cellWidth,
        })}
      </VirtualizerContext.Provider>
    </Scroller>
  );
});

export function useVirtualizerManager() {
  return React.useContext(VirtualizerContext);
}

export default Virtualizer;
