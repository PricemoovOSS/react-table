import * as React from "react";

import { IOnScroll, IScrollerHandle, ScrollDirection } from "../components/scroller";
import {
  CustomSizesElements,
  IElevateds,
  VirtualizerCache,
  findFirstNotIncluded,
  getElevatedIndexes,
  getIndexScrollMapping,
  getVirtualizerCache,
  getVisibleIndexesInsideDatalength,
  getVisibleItemIndexes,
} from "../components/utils/table";
import { DEFAULT_ROW_HEIGHT, MIN_COLUMN_WIDTH } from "../components/constants";
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
  /** Size of the scrollbar (defaults to the size measured at module load) */
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
export function useVirtualizer({
  width,
  height,
  rowsLength,
  columnsLength,
  fixedRows = EMPTY_INDEXES as number[],
  fixedColumns = EMPTY_INDEXES as number[],
  hiddenRows = EMPTY_INDEXES as number[],
  hiddenColumns = EMPTY_INDEXES as number[],
  rowsCount,
  columnsCount,
  minRowHeight = DEFAULT_ROW_HEIGHT,
  minColumnWidth = MIN_COLUMN_WIDTH,
  customCellsHeight = EMPTY_CUSTOM_SIZES,
  customCellsWidth = EMPTY_CUSTOM_SIZES,
  verticalPadding = 0,
  horizontalPadding = 0,
  scrollbarSize,
  overscan = 0,
}: IUseVirtualizerProps): IUseVirtualizerResult {
  const lastScrollRef = React.useRef<{ top: number; left: number }>({ top: 0, left: 0 });

  // Cache regeneration. We accept O(width × cells) rebuild whenever any input changes —
  // this matches the legacy class implementation's `componentDidUpdate` path.
  const cache: ICacheBundle = React.useMemo(() => {
    const sb = scrollbarSize ?? 0;

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
    const horizontalScrollBarSize = vertical.virtualSize > (vertical.scrollableItemsSize ?? 0) ? sb : 0;
    const horizontal = buildHorizontal(verticalPadding + horizontalScrollBarSize);
    const verticalScrollBarSize = horizontal.virtualSize > (horizontal.scrollableItemsSize ?? 0) ? sb : 0;
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

  // Initial state derived from scroll position 0. We use the lazy initializer once to
  // avoid recomputing in StrictMode's double-invocation.
  const [rowsState, setRowsState] = React.useState<IRowsState>(() => buildRowsState(computeRowsAt(0)));
  const [columnsState, setColumnsState] = React.useState<IColumnState>(() => buildColumnsState(computeColumnsAt(0)));

  // When the cache regenerates (size, fixed items, hidden items, …), recompute the visible
  // window AT THE CURRENT scroll position — preserving what the user is looking at.
  // We compare with `shallowSameIndexes` to avoid spurious re-renders.
  const previousCacheRef = React.useRef(cache);
  if (previousCacheRef.current !== cache) {
    previousCacheRef.current = cache;
    const nextRows = buildRowsState(computeRowsAt(lastScrollRef.current.top));
    const nextColumns = buildColumnsState(computeColumnsAt(lastScrollRef.current.left));
    if (!shallowSameIndexes(rowsState.visibleRowIndexes, nextRows.visibleRowIndexes)) {
      // Scheduled state update during render is allowed for derived state in React 18+.
      setRowsState(nextRows);
    }
    if (!shallowSameIndexes(columnsState.visibleColumnIndexes, nextColumns.visibleColumnIndexes)) {
      setColumnsState(nextColumns);
    }
  }

  const computeRowsState = React.useCallback(
    (scrollTop: number): Nullable<IRowsState> => {
      lastScrollRef.current.top = scrollTop;
      const visible = computeRowsAt(scrollTop);
      if (shallowSameIndexes(rowsState.visibleRowIndexes, visible)) return null;
      const next = buildRowsState(visible);
      setRowsState(next);
      return next;
    },
    [computeRowsAt, buildRowsState, rowsState.visibleRowIndexes],
  );

  const computeColumnsState = React.useCallback(
    (scrollLeft: number): Nullable<IColumnState> => {
      lastScrollRef.current.left = scrollLeft;
      const visible = computeColumnsAt(scrollLeft);
      if (shallowSameIndexes(columnsState.visibleColumnIndexes, visible)) return null;
      const next = buildColumnsState(visible);
      setColumnsState(next);
      return next;
    },
    [computeColumnsAt, buildColumnsState, columnsState.visibleColumnIndexes],
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

  return {
    visibleRowIndexes: getVisibleIndexesInsideDatalength(rowsLength, rowsState.visibleRowIndexes),
    visibleColumnIndexes: getVisibleIndexesInsideDatalength(columnsLength, columnsState.visibleColumnIndexes),
    elevatedRowIndexes: rowsState.elevatedRowIndexes,
    elevatedColumnIndexes: columnsState.elevatedColumnIndexes,
    visibleFixedRowIndexes: cache.vertical.visibleFixedItems,
    visibleFixedColumnIndexes: cache.horizontal.visibleFixedItems,
    cellHeight: cache.vertical.itemSize,
    cellWidth: cache.horizontal.itemSize,
    virtualHeight: cache.vertical.virtualSize + (cache.vertical.scrollableCustomSize ?? 0),
    virtualWidth: cache.horizontal.virtualSize + (cache.horizontal.scrollableCustomSize ?? 0),
    computeRowsState,
    computeColumnsState,
    getCursors,
    getScrollLeftForColumnIndex,
    getScrollTopForRowIndex,
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
