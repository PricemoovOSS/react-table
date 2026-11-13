import { act } from "@testing-library/react";

import { makeRows, mount } from "./harness";

/**
 * REVIEW FINDING — a programmatic scroll cannot reach the end of the table: it is clamped to
 * `maximum - scrollEndThreshold` (src/components/scroller.tsx:106-107, used as the upper bound
 * at :141 and :154). The threshold is meant for the scroll handlers ("how close to an edge the
 * handlers report it as reached"), not as a limit of `goToRowIndex` / `goToColumnIndex` /
 * `goToColumnId` / `initialScroll` / the keyboard navigation.
 *
 * - With the default threshold (5 px) the last row is left out whenever the rows fill the
 *   window to less than 5 px (500 px of 50 px rows here). 4.0.2 had the same clamp (5 px, not
 *   configurable) and rendered one more row, hidden by the overflow of the content: the last
 *   row was in the DOM but not visible either. With `keyboardNavigation` (new), Ctrl+End then
 *   targets a cell that never mounts: the focus stays on the wrapper.
 * - With a larger threshold (new prop, e.g. 300 px to ask for the next page early) the last
 *   rows cannot be reached by program at all.
 *
 * A native scroll does reach the end: the test "reference" below shows the expected window.
 */
const ROWS = makeRows(100, 40);
const base = { id: "t", rows: ROWS, isVirtualized: true, isSelectable: false } as const;

describe("review: programmatic scroll to the end", () => {
  it("reference: a native scroll to the end shows the last rows", () => {
    const table = mount({ ...base, virtualizerProps: { width: 1000, height: 500, minRowHeight: 50, fixedRows: [0] } });
    table.scroll({ scrollTop: 100 * 50 - 500 });
    expect(table.rowIds().slice(-3)).toEqual(["r97", "r98", "r99"]);
  });

  it("goToRowIndex(last) shows the last row (default threshold)", () => {
    const table = mount({ ...base, virtualizerProps: { width: 1000, height: 500, minRowHeight: 50, fixedRows: [0] } });
    act(() => table.handle()?.goToRowIndex(99));
    table.flushScroll();
    // CORRECT: the window ends with r99, like after a native scroll to the end (scrollTop 4500).
    // Observed: scrollTop 4495, window r90…r98.
    expect({ scrollTop: table.scroller()?.scrollTop, last: table.rowIds().slice(-1)[0] }).toEqual({
      scrollTop: 4500,
      last: "r99",
    });
  });

  it("goToColumnIndex(last) shows the last column (default threshold)", () => {
    const table = mount({ ...base, virtualizerProps: { width: 1000, height: 500, minColumnWidth: 100 } });
    act(() => table.handle()?.goToColumnIndex(39));
    table.flushScroll();
    // CORRECT: column 39 is in the window. Observed: the window stops at column 38.
    expect(table.columnIndexes().slice(-1)[0]).toBe(39);
  });

  it("goToRowIndex(last) shows the last row with scrollEndThreshold: 300", () => {
    const table = mount({
      ...base,
      virtualizerProps: { width: 1000, height: 500, minRowHeight: 50, fixedRows: [0], scrollEndThreshold: 300 },
    });
    act(() => table.handle()?.goToRowIndex(99));
    table.flushScroll();
    // CORRECT: r99. Observed: the scroll stops 300 px before the end, the window ends 6 rows earlier.
    expect({ scrollTop: table.scroller()?.scrollTop, last: table.rowIds().slice(-1)[0] }).toEqual({
      scrollTop: 4500,
      last: "r99",
    });
  });
});
