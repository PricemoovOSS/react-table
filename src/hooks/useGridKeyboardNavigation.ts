import * as React from "react";

export interface IGridKeyboardNavigationOptions {
  /**
   * Total number of rows in the underlying data (NOT just the visible window).
   * Defaults to `Infinity` — clamped on the actual DOM presence.
   */
  totalRows?: number;
  /** Total number of columns. */
  totalColumns?: number;
  /**
   * Number of rows to step on PageUp/PageDown. Defaults to 10. Set this to roughly the
   * number of rows in the viewport for a "real" page jump.
   */
  pageSize?: number;
  /**
   * Indexes of rows hidden from layout (e.g. `virtualizerProps.hiddenRows`). The keyboard
   * navigation will skip them when computing the next focused row.
   */
  hiddenRows?: number[];
  /** Indexes of columns hidden from layout. Same behaviour as `hiddenRows`. */
  hiddenColumns?: number[];
  /**
   * Optional callback fired when the keyboard nav needs a target cell that isn't in the
   * current visible window — typically wired to `Table.goToRowIndex` /
   * `Table.goToColumnIndex` so the cell mounts before we focus it.
   */
  scrollToCell?: (rowIndex: number, columnIndex: number) => void;
  /** Disable the hook entirely (e.g. for read-only tables that don't want focus management) */
  disabled?: boolean;
}

export interface IGridKeyboardNavigationResult {
  /** Spread these on the grid wrapper element (the one with `role="grid"` or its parent). */
  containerProps: {
    tabIndex: 0;
    onKeyDown: React.KeyboardEventHandler<HTMLElement>;
    onFocus: React.FocusEventHandler<HTMLElement>;
  };
  /** Imperatively move focus to a given cell. Returns true if the request was honored. */
  focusCell: (rowIndex: number, columnIndex: number) => boolean;
}

interface ICellCoords {
  row: number;
  col: number;
}

const CELL_SELECTOR = "[data-cell-row][data-cell-col]";

function findCell(root: HTMLElement, row: number, col: number): HTMLElement | null {
  return root.querySelector<HTMLElement>(`[data-cell-row="${row}"][data-cell-col="${col}"]`);
}

function readCoords(node: Element | null): ICellCoords | null {
  if (!node) return null;
  const cell = (node as HTMLElement).closest<HTMLElement>(CELL_SELECTOR);
  if (!cell) return null;
  const row = Number(cell.getAttribute("data-cell-row"));
  const col = Number(cell.getAttribute("data-cell-col"));
  if (!Number.isFinite(row) || !Number.isFinite(col)) return null;
  return { row, col };
}

function findFirstCell(root: HTMLElement): HTMLElement | null {
  return root.querySelector<HTMLElement>('tbody [role="gridcell"][data-cell-row][data-cell-col]');
}

/**
 * Walk the row axis from `start` toward `direction` (+1 / -1), skipping `hidden` indexes,
 * and clamping to `[0, max-1]`. If the caller asked to step `delta` rows but every step
 * lands on a hidden row, we keep walking until we find a visible one (or hit the boundary).
 */
function nextVisibleIndex(start: number, delta: number, max: number, hidden: ReadonlySet<number>): number {
  if (delta === 0) return start;
  const direction = delta > 0 ? 1 : -1;
  let remaining = Math.abs(delta);
  let current = start;
  while (remaining > 0) {
    const candidate = current + direction;
    if (candidate < 0 || candidate >= max) return current;
    current = candidate;
    if (!hidden.has(candidate)) remaining -= 1;
  }
  return current;
}

function clampVisibleIndex(target: number, max: number, hidden: ReadonlySet<number>): number {
  if (max <= 0) return 0;
  let bounded = Math.max(0, Math.min(max - 1, target));
  if (!hidden.has(bounded)) return bounded;
  // Walk forward for an "end" target, backward for a "start" target.
  if (target >= max - 1) {
    while (bounded > 0 && hidden.has(bounded)) bounded -= 1;
  } else {
    while (bounded < max - 1 && hidden.has(bounded)) bounded += 1;
  }
  return bounded;
}

/**
 * Keyboard navigation for `<table role="grid">` following the W3C ARIA APG patterns
 * (https://www.w3.org/WAI/ARIA/apg/patterns/grid/).
 *
 * Single roving tabIndex: cells render with `tabIndex={-1}`; the grid wrapper takes Tab.
 * On focus into the wrapper, the hook redirects focus to the active cell (last focused, or
 * the first body cell). Arrow keys move the focus in 4 directions, Home/End jump to the
 * row's edges, Ctrl+Home/Ctrl+End jump to the grid's corners, PageUp/PageDown step by
 * `pageSize`. Hidden rows/columns are skipped.
 *
 * For coordinates that aren't currently mounted (off-window under virtualization), the hook
 * calls `scrollToCell(row, col)` to ask the grid to bring them into view, then focuses on
 * the next animation frame once the cell has mounted.
 */
export function useGridKeyboardNavigation(
  containerRef: React.RefObject<HTMLElement | null>,
  options: IGridKeyboardNavigationOptions = {},
): IGridKeyboardNavigationResult {
  const {
    totalRows = Infinity,
    totalColumns = Infinity,
    pageSize = 10,
    hiddenRows,
    hiddenColumns,
    scrollToCell,
    disabled = false,
  } = options;

  /** Last cell that received focus. Restored on Tab into the wrapper. */
  const activeCellRef = React.useRef<ICellCoords | null>(null);
  /** Pending rAF id from `focusCell` — cancelled on next call or unmount. */
  const pendingRafRef = React.useRef<number | null>(null);

  const hiddenRowSet = React.useMemo(() => new Set(hiddenRows ?? []), [hiddenRows]);
  const hiddenColSet = React.useMemo(() => new Set(hiddenColumns ?? []), [hiddenColumns]);

  const cancelPendingRaf = React.useCallback(() => {
    if (pendingRafRef.current != null) {
      cancelAnimationFrame(pendingRafRef.current);
      pendingRafRef.current = null;
    }
  }, []);

  const focusCell = React.useCallback(
    (row: number, col: number): boolean => {
      const root = containerRef.current;
      if (!root) return false;
      cancelPendingRaf();
      const cell = findCell(root, row, col);
      if (cell) {
        cell.focus();
        activeCellRef.current = { row, col };
        return true;
      }
      // Off-window: ask the grid to scroll, then retry on the next frame.
      if (scrollToCell) {
        scrollToCell(row, col);
        pendingRafRef.current = requestAnimationFrame(() => {
          pendingRafRef.current = null;
          const r = containerRef.current;
          if (!r) return;
          const c = findCell(r, row, col);
          if (c) {
            c.focus();
            activeCellRef.current = { row, col };
          }
        });
        return true;
      }
      return false;
    },
    [containerRef, scrollToCell, cancelPendingRaf],
  );

  // Cancel any pending rAF on unmount to avoid focus jumping after the table disappears.
  React.useEffect(() => cancelPendingRaf, [cancelPendingRaf]);

  const onKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      if (disabled) return;
      const root = containerRef.current;
      if (!root) return;

      const current = readCoords(document.activeElement) ?? activeCellRef.current;
      if (!current) return;

      let { row, col } = current;
      let handled = true;

      switch (event.key) {
        case "ArrowDown":
          row = nextVisibleIndex(row, 1, totalRows, hiddenRowSet);
          break;
        case "ArrowUp":
          row = nextVisibleIndex(row, -1, totalRows, hiddenRowSet);
          break;
        case "ArrowRight":
          col = nextVisibleIndex(col, 1, totalColumns, hiddenColSet);
          break;
        case "ArrowLeft":
          col = nextVisibleIndex(col, -1, totalColumns, hiddenColSet);
          break;
        case "Home":
          if (event.ctrlKey || event.metaKey) {
            row = clampVisibleIndex(0, totalRows, hiddenRowSet);
            col = clampVisibleIndex(0, totalColumns, hiddenColSet);
          } else {
            col = clampVisibleIndex(0, totalColumns, hiddenColSet);
          }
          break;
        case "End":
          if (event.ctrlKey || event.metaKey) {
            row = clampVisibleIndex(totalRows - 1, totalRows, hiddenRowSet);
            col = clampVisibleIndex(totalColumns - 1, totalColumns, hiddenColSet);
          } else {
            col = clampVisibleIndex(totalColumns - 1, totalColumns, hiddenColSet);
          }
          break;
        case "PageDown":
          row = nextVisibleIndex(row, pageSize, totalRows, hiddenRowSet);
          break;
        case "PageUp":
          row = nextVisibleIndex(row, -pageSize, totalRows, hiddenRowSet);
          break;
        default:
          handled = false;
      }

      if (!handled) return;
      if (row === current.row && col === current.col) return;

      event.preventDefault();
      event.stopPropagation();
      focusCell(row, col);
    },
    [containerRef, disabled, totalRows, totalColumns, pageSize, hiddenRowSet, hiddenColSet, focusCell],
  );

  /**
   * Focus events bubble. We need to:
   * - Capture focus that lands on a cell (via click / programmatic / etc.) so
   *   `activeCellRef` stays in sync. Without this, leaving the grid via Tab and coming
   *   back via Shift+Tab would lose the user's place.
   * - When focus lands on the wrapper itself (Tab into the grid), redirect it to the
   *   active cell.
   */
  const onFocus = React.useCallback(
    (event: React.FocusEvent<HTMLElement>) => {
      if (disabled) return;
      if (event.target === event.currentTarget) {
        // Tab into the wrapper → delegate to the active (or first) cell.
        const root = containerRef.current;
        if (!root) return;
        const target = activeCellRef.current
          ? (findCell(root, activeCellRef.current.row, activeCellRef.current.col) ?? findFirstCell(root))
          : findFirstCell(root);
        if (target) {
          target.focus();
          const coords = readCoords(target);
          if (coords) activeCellRef.current = coords;
        }
      } else {
        // A descendant cell received focus — track it.
        const coords = readCoords(event.target);
        if (coords) activeCellRef.current = coords;
      }
    },
    [containerRef, disabled],
  );

  return {
    containerProps: { tabIndex: 0, onKeyDown, onFocus },
    focusCell,
  };
}
