import * as React from "react";

import { IOnScroll, IScrollerHandle, ScrollDirection, useScrollbarSize } from "../components/scroller";
import {
  CustomSizesElements,
  IElevateds,
  VirtualizerCache,
  findFirstNotIncluded,
  getElevatedIndexes,
  getIndexScrollMapping,
  getVirtualizerCache,
  getVirtualSizeReachingLastWindow,
  getVisibleIndexesInsideDatalength,
  getVisibleItemIndexes,
  getValidIndexes,
} from "../components/utils/table";
import { DEFAULT_ROW_HEIGHT, MIN_COLUMN_WIDTH } from "../components/constants";
import { sameCustomSizes, sameIndexes, useStableValue } from "./useStableValue";
import { Nullable } from "../components/typing";

const VERTICAL = [ScrollDirection.up, ScrollDirection.down] as const;
const HORIZONTAL = [ScrollDirection.left, ScrollDirection.right] as const;

// Stable defaults — avoids breaking memoization for callers that don't pre-memoize their array literals.
const EMPTY_INDEXES: ReadonlyArray<number> = Object.freeze([]);
const EMPTY_CUSTOM_SIZES: CustomSizesElements = {
  fixed: { sum: 0, count: 0 },
  scrollable: { sum: 0, count: 0 },
  customSizes: {},
};

export interface IRowsState {
  visibleRowIndexes: number[];
  elevatedRowIndexes: IElevateds;
}

export interface IColumnState {
  visibleColumnIndexes: number[];
  elevatedColumnIndexes: IElevateds;
}

export interface IUseVirtualizerProps {
  width: number;
  height: number;
  rowsLength: number;
  columnsLength: number;
  fixedRows?: number[];
  fixedColumns?: number[];
  hiddenRows?: number[];
  hiddenColumns?: number[];
  rowsCount?: number;
  columnsCount?: number;
  minRowHeight?: number;
  minColumnWidth?: number;
  customCellsHeight?: CustomSizesElements;
  customCellsWidth?: CustomSizesElements;
  verticalPadding?: number;
  horizontalPadding?: number;
  /** Size of the scroll bars (defaults to the one of the browser, measured when the table renders) */
  scrollbarSize?: number;
  /**
   * Number of items to render above and below the visible window in each axis.
   * Trades memory for smoother scrolling. Default `0` matches the legacy behaviour.
   */
  overscan?: number;
}

export interface IUseVirtualizerResult extends IRowsState, IColumnState {
  cellHeight: number;
  cellWidth: number;
  virtualWidth: number;
  virtualHeight: number;
  visibleFixedColumnIndexes: number[];
  visibleFixedRowIndexes: number[];
  /** Push a new vertical scroll position; returns the new state, or `null` if nothing changed */
  computeRowsState: (scrollTop: number) => Nullable<IRowsState>;
  /** Push a new horizontal scroll position; returns the new state, or `null` if nothing changed */
  computeColumnsState: (scrollLeft: number) => Nullable<IColumnState>;
  getCursors: (rowState: IRowsState, columnState: IColumnState) => { rowsCursor: number; columnsCursor: number };
  getScrollLeftForColumnIndex: (columnIndex: number) => number | undefined;
  getScrollTopForRowIndex: (rowIndex: number) => number | undefined;
}

interface ICacheBundle {
  vertical: VirtualizerCache;
  horizontal: VirtualizerCache;
}

/** The visible window, with the cache it was computed for */
interface IWindowState {
  cache: ICacheBundle;
  rows: IRowsState;
  columns: IColumnState;
}

/**
 * Pure virtualization hook.
 *
 * Given the viewport size, the total number of items and the fixed/hidden/custom-size
 * descriptors, returns the visible row & column indexes plus a set of helpers any
 * scroll container can consume — including the bundled `<Scroller>`.
 *
 * The hook tracks the **last applied scroll position** internally (via a ref, not state)
 * so that when its inputs change — `rowsLength`, `fixedRows`, viewport size, … — the
 * visible window is recomputed at the position the user is actually looking at, not 0.
 */
export function useVirtualizer(props: IUseVirtualizerProps): IUseVirtualizerResult {
  const {
    width,
    height,
    rowsLength,
    columnsLength,
    rowsCount,
    columnsCount,
    minRowHeight = DEFAULT_ROW_HEIGHT,
    minColumnWidth = MIN_COLUMN_WIDTH,
    verticalPadding = 0,
    horizontalPadding = 0,
    overscan = 0,
  } = props;
  const scrollbarSize = useScrollbarSize(props.scrollbarSize);
  // Lists and sizes are often written inline: they are compared by content, the window is
  // derived from them during the render and a new object at every render would never settle.
  const givenFixedRows = useStableValue(props.fixedRows ?? (EMPTY_INDEXES as number[]), sameIndexes);
  const givenFixedColumns = useStableValue(props.fixedColumns ?? (EMPTY_INDEXES as number[]), sameIndexes);
  const hiddenRows = useStableValue(props.hiddenRows ?? (EMPTY_INDEXES as number[]), sameIndexes);
  const hiddenColumns = useStableValue(props.hiddenColumns ?? (EMPTY_INDEXES as number[]), sameIndexes);
  const customCellsHeight = useStableValue(props.customCellsHeight ?? EMPTY_CUSTOM_SIZES, sameCustomSizes);
  const customCellsWidth = useStableValue(props.customCellsWidth ?? EMPTY_CUSTOM_SIZES, sameCustomSizes);
  const fixedRows = React.useMemo(() => getValidIndexes(givenFixedRows, rowsLength), [givenFixedRows, rowsLength]);
  const fixedColumns = React.useMemo(() => getValidIndexes(givenFixedColumns, columnsLength), [givenFixedColumns, columnsLength]);

  const lastScrollRef = React.useRef<{ top: number; left: number }>({ top: 0, left: 0 });

  // Cache regeneration. We accept O(width × cells) rebuild whenever any input changes —
  // this matches the legacy class implementation's `componentDidUpdate` path.
  const cache: ICacheBundle = React.useMemo(() => {
    const buildVertical = (extraPadding: number): VirtualizerCache =>
      getVirtualizerCache({
        minItemSize: minRowHeight,
        fixedItems: fixedRows,
        padding: extraPadding,
        hiddenItems: hiddenRows,
        customSizesElements: customCellsHeight,
        containerSize: height,
        itemsLength: rowsLength,
        itemsCount: rowsCount,
      });

    const buildHorizontal = (extraPadding: number): VirtualizerCache =>
      getVirtualizerCache({
        minItemSize: minColumnWidth,
        fixedItems: fixedColumns,
        padding: extraPadding,
        hiddenItems: hiddenColumns,
        customSizesElements: customCellsWidth,
        containerSize: width,
        itemsLength: columnsLength,
        itemsCount: columnsCount,
      });

    // Two-pass to settle on whether each axis needs the opposite scrollbar's size as padding.
    let vertical = buildVertical(horizontalPadding);
    const horizontalScrollBarSize = vertical.virtualSize > (vertical.scrollableItemsSize ?? 0) ? scrollbarSize : 0;
    const horizontal = buildHorizontal(verticalPadding + horizontalScrollBarSize);
    const verticalScrollBarSize = horizontal.virtualSize > (horizontal.scrollableItemsSize ?? 0) ? scrollbarSize : 0;
    vertical = buildVertical(verticalScrollBarSize + horizontalPadding);

    vertical.itemIndexesScrollMapping = getIndexScrollMapping(rowsLength, customCellsHeight.customSizes, vertical.itemSize, [
      ...vertical.visibleFixedItems,
      ...hiddenRows,
    ]);
    horizontal.itemIndexesScrollMapping = getIndexScrollMapping(
      columnsLength,
      customCellsWidth.customSizes,
      horizontal.itemSize,
      [...horizontal.visibleFixedItems, ...hiddenColumns],
    );
    vertical.virtualSize = getVirtualSizeReachingLastWindow(rowsLength, customCellsHeight.customSizes, height, vertical);
    horizontal.virtualSize = getVirtualSizeReachingLastWindow(columnsLength, customCellsWidth.customSizes, width, horizontal);

    return { vertical, horizontal };
  }, [
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
  ]);

  const computeRowsAt = React.useCallback(
    (scrollTop: number): number[] => {
      const visible = getVisibleItemIndexes(scrollTop, rowsLength, customCellsHeight.customSizes, cache.vertical);
      return overscan > 0 ? extendWithOverscan(visible, rowsLength, overscan, cache.vertical.ignoredIndexes) : visible;
    },
    [rowsLength, customCellsHeight.customSizes, cache.vertical, overscan],
  );

  const computeColumnsAt = React.useCallback(
    (scrollLeft: number): number[] => {
      const visible = getVisibleItemIndexes(scrollLeft, columnsLength, customCellsWidth.customSizes, cache.horizontal);
      return overscan > 0 ? extendWithOverscan(visible, columnsLength, overscan, cache.horizontal.ignoredIndexes) : visible;
    },
    [columnsLength, customCellsWidth.customSizes, cache.horizontal, overscan],
  );

  // Structural sharing: if the freshly computed `elevatedRowIndexes` / `elevatedColumnIndexes`
  // is content-equal to the previous one, we reuse the previous reference. This keeps
  // `<Row>`'s memoization on `===` for these slots and avoids deep `isEqual` per cell.
  const lastRowsElevatedRef = React.useRef<IElevateds | null>(null);
  const lastColumnsElevatedRef = React.useRef<IElevateds | null>(null);

  const buildRowsState = React.useCallback(
    (visible: number[]): IRowsState => {
      const next = getElevatedIndexes(
        visible,
        cache.vertical.ignoredIndexes,
        customCellsHeight.customSizes,
        cache.vertical.itemSize,
      );
      const elevated =
        lastRowsElevatedRef.current && elevatedEqual(lastRowsElevatedRef.current, next) ? lastRowsElevatedRef.current : next;
      lastRowsElevatedRef.current = elevated;
      return { visibleRowIndexes: visible, elevatedRowIndexes: elevated };
    },
    [cache.vertical, customCellsHeight.customSizes],
  );

  const buildColumnsState = React.useCallback(
    (visible: number[]): IColumnState => {
      const next = getElevatedIndexes(
        visible,
        cache.horizontal.ignoredIndexes,
        customCellsWidth.customSizes,
        cache.horizontal.itemSize,
        true,
      );
      const elevated =
        lastColumnsElevatedRef.current && elevatedEqual(lastColumnsElevatedRef.current, next)
          ? lastColumnsElevatedRef.current
          : next;
      lastColumnsElevatedRef.current = elevated;
      return { visibleColumnIndexes: visible, elevatedColumnIndexes: elevated };
    },
    [cache.horizontal, customCellsWidth.customSizes],
  );

  // The window is kept with the cache it was computed for. When the cache changes (sizes,
  // fixed or hidden items, number of items…), the window is computed again AT THE CURRENT
  // scroll position, during the render and from the state alone: a render that React runs
  // twice or discards (strict mode, an interrupted transition) leaves nothing behind it.
  // The elevations can change while the visible indexes stay the same (an item gets fixed,
  // a size changes): both are compared, and what did not change keeps its reference.
  const [windowState, setWindowState] = React.useState<IWindowState>(() => ({
    cache,
    rows: buildRowsState(computeRowsAt(0)),
    columns: buildColumnsState(computeColumnsAt(0)),
  }));
  let currentWindow = windowState;
  if (windowState.cache !== cache) {
    const rows = buildRowsState(computeRowsAt(lastScrollRef.current.top));
    const columns = buildColumnsState(computeColumnsAt(lastScrollRef.current.left));
    currentWindow = {
      cache,
      rows: mergeRowsState(windowState.rows, rows) ?? windowState.rows,
      columns: mergeColumnsState(windowState.columns, columns) ?? windowState.columns,
    };
    setWindowState(currentWindow);
  }
  const { rows: rowsState, columns: columnsState } = currentWindow;

  // Last requested window: the scroll handlers compare against it before it is committed.
  const requestedWindowRef = React.useRef(currentWindow);
  React.useLayoutEffect(() => {
    requestedWindowRef.current = currentWindow;
  });

  const computeRowsState = React.useCallback(
    (scrollTop: number): Nullable<IRowsState> => {
      lastScrollRef.current.top = scrollTop;
      const next = mergeRowsState(requestedWindowRef.current.rows, buildRowsState(computeRowsAt(scrollTop)));
      if (next) {
        requestedWindowRef.current = { ...requestedWindowRef.current, rows: next };
        setWindowState((state) => ({ ...state, rows: next }));
      }
      return next;
    },
    [computeRowsAt, buildRowsState],
  );

  const computeColumnsState = React.useCallback(
    (scrollLeft: number): Nullable<IColumnState> => {
      lastScrollRef.current.left = scrollLeft;
      const next = mergeColumnsState(requestedWindowRef.current.columns, buildColumnsState(computeColumnsAt(scrollLeft)));
      if (next) {
        requestedWindowRef.current = { ...requestedWindowRef.current, columns: next };
        setWindowState((state) => ({ ...state, columns: next }));
      }
      return next;
    },
    [computeColumnsAt, buildColumnsState],
  );

  const getCursors = React.useCallback(
    (rowState: IRowsState, columnState: IColumnState) => ({
      rowsCursor: findFirstNotIncluded(rowState.visibleRowIndexes, cache.vertical.visibleFixedItems),
      columnsCursor: findFirstNotIncluded(columnState.visibleColumnIndexes, cache.horizontal.visibleFixedItems),
    }),
    [cache.vertical.visibleFixedItems, cache.horizontal.visibleFixedItems],
  );

  const getScrollLeftForColumnIndex = React.useCallback(
    (columnIndex: number): number | undefined => {
      const offset = cache.horizontal.itemIndexesScrollMapping[columnIndex];
      return offset != null ? offset + 1 : undefined;
    },
    [cache.horizontal.itemIndexesScrollMapping],
  );

  const getScrollTopForRowIndex = React.useCallback(
    (rowIndex: number): number | undefined => {
      const offset = cache.vertical.itemIndexesScrollMapping[rowIndex];
      return offset != null ? offset + 1 : undefined;
    },
    [cache.vertical.itemIndexesScrollMapping],
  );

  // Same array for as long as the window does not change: the rows are memoized on it.
  const visibleRowIndexes = React.useMemo(
    () => getVisibleIndexesInsideDatalength(rowsLength, rowsState.visibleRowIndexes),
    [rowsLength, rowsState.visibleRowIndexes],
  );
  const visibleColumnIndexes = React.useMemo(
    () => getVisibleIndexesInsideDatalength(columnsLength, columnsState.visibleColumnIndexes),
    [columnsLength, columnsState.visibleColumnIndexes],
  );

  return {
    visibleRowIndexes,
    visibleColumnIndexes,
    elevatedRowIndexes: rowsState.elevatedRowIndexes,
    elevatedColumnIndexes: columnsState.elevatedColumnIndexes,
    visibleFixedRowIndexes: cache.vertical.visibleFixedItems,
    visibleFixedColumnIndexes: cache.horizontal.visibleFixedItems,
    cellHeight: cache.vertical.itemSize,
    cellWidth: cache.horizontal.itemSize,
    // `virtualSize` already counts the items that have a size of their own
    virtualHeight: cache.vertical.virtualSize,
    virtualWidth: cache.horizontal.virtualSize,
    computeRowsState,
    computeColumnsState,
    getCursors,
    getScrollLeftForColumnIndex,
    getScrollTopForRowIndex,
  };
}

/** Returns the state to apply, keeping the unchanged references, or `null` if nothing changed. */
function mergeRowsState(current: IRowsState, next: IRowsState): Nullable<IRowsState> {
  const hasSameIndexes = shallowSameIndexes(current.visibleRowIndexes, next.visibleRowIndexes);
  const sameElevations = elevatedEqual(current.elevatedRowIndexes, next.elevatedRowIndexes);
  if (hasSameIndexes && sameElevations) return null;
  return {
    visibleRowIndexes: hasSameIndexes ? current.visibleRowIndexes : next.visibleRowIndexes,
    elevatedRowIndexes: sameElevations ? current.elevatedRowIndexes : next.elevatedRowIndexes,
  };
}

function mergeColumnsState(current: IColumnState, next: IColumnState): Nullable<IColumnState> {
  const hasSameIndexes = shallowSameIndexes(current.visibleColumnIndexes, next.visibleColumnIndexes);
  const sameElevations = elevatedEqual(current.elevatedColumnIndexes, next.elevatedColumnIndexes);
  if (hasSameIndexes && sameElevations) return null;
  return {
    visibleColumnIndexes: hasSameIndexes ? current.visibleColumnIndexes : next.visibleColumnIndexes,
    elevatedColumnIndexes: sameElevations ? current.elevatedColumnIndexes : next.elevatedColumnIndexes,
  };
}

function shallowSameIndexes(a: number[], b: number[]) {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/**
 * Structural equality check on the elevated descriptor. Both `elevations` and
 * `absoluteEndPositions` are flat numeric records — a single-level key/value comparison
 * is enough and ~20× faster than lodash.isEqual on these objects.
 */
function elevatedEqual(a: IElevateds, b: IElevateds): boolean {
  if (a === b) return true;
  const ea = a.elevations;
  const eb = b.elevations;
  const eaKeys = Object.keys(ea);
  const ebKeys = Object.keys(eb);
  if (eaKeys.length !== ebKeys.length) return false;
  for (let i = 0; i < eaKeys.length; i++) {
    const k = eaKeys[i] as unknown as number;
    if (ea[k] !== eb[k]) return false;
  }
  const pa = a.absoluteEndPositions;
  const pb = b.absoluteEndPositions;
  const paKeys = Object.keys(pa);
  const pbKeys = Object.keys(pb);
  if (paKeys.length !== pbKeys.length) return false;
  for (let i = 0; i < paKeys.length; i++) {
    const k = paKeys[i] as unknown as number;
    if (pa[k] !== pb[k]) return false;
  }
  return true;
}

/**
 * Pads the visible window with `overscan` items on each side, skipping ignored indexes
 * (fixed and hidden). Items are always re-sorted to keep callers' index-based logic happy.
 */
function extendWithOverscan(visible: number[], itemsLength: number, overscan: number, ignored: Record<number, true>): number[] {
  if (!visible.length) return visible;
  const seen = new Set<number>(visible);
  const firstScrollable = visible.find((i) => !ignored[i]);
  const lastScrollable = [...visible].reverse().find((i) => !ignored[i]);
  if (firstScrollable === undefined || lastScrollable === undefined) return visible;

  let added = 0;
  for (let i = firstScrollable - 1; i >= 0 && added < overscan; i--) {
    if (ignored[i] || seen.has(i)) continue;
    seen.add(i);
    added++;
  }
  added = 0;
  for (let i = lastScrollable + 1; i < itemsLength && added < overscan; i++) {
    if (ignored[i] || seen.has(i)) continue;
    seen.add(i);
    added++;
  }

  return Array.from(seen).sort((a, b) => a - b);
}

/**
 * Determines whether a scroll event affects rows, columns or both.
 * Exported as a convenience for consumers building their own scroll container.
 */
export function getScrollAxes(scroll: IOnScroll): { vertical: boolean; horizontal: boolean } {
  return {
    vertical: VERTICAL.some((d) => scroll.directions.includes(d)),
    horizontal: HORIZONTAL.some((d) => scroll.directions.includes(d)),
  };
}

/** Helper to call scrollTo* on a Scroller ref returned by `useRef<IScrollerHandle>(null)`. */
export function bindScrollerToVirtualizer(
  scroller: { current: IScrollerHandle | null },
  getScrollLeftForColumnIndex: (columnIndex: number) => number | undefined,
  getScrollTopForRowIndex: (rowIndex: number) => number | undefined,
) {
  return {
    scrollToColumnIndex: (columnIndex: number): boolean => {
      const left = getScrollLeftForColumnIndex(columnIndex);
      return left != null ? !!scroller.current?.scrollToLeft(left) : false;
    },
    scrollToRowIndex: (rowIndex: number): boolean => {
      const top = getScrollTopForRowIndex(rowIndex);
      return top != null ? !!scroller.current?.scrollToTop(top) : false;
    },
  };
}
