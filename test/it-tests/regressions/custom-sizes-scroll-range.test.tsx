import { makeRows, mount } from "./harness";

/**
 * REVIEW FINDING — wrong scroll range: the sizes given to scrolling items (`columns[i].size`,
 * `rowsProps[i].size`) are counted twice. Present in 4.0.2 too (same formula, run during the review).
 *
 * `getVirtualizerCache` already adds them to `virtualSize` (src/components/utils/table.tsx:914-915)
 * and `useVirtualizer` adds `scrollableCustomSize` again (src/hooks/useVirtualizer.ts:350-351).
 * The end of the scroll range is dead: the window does not change any more, the thumb of the
 * scrollbar is too small, and `maxRightReached` / `maxBottomReached` (next page) come late.
 *
 * 30 columns of 150 px (all sized by the application) in a window of 900 px: the content is
 * 4500 px wide, the last window (columns 24…29) is reached at scrollLeft 3600.
 * Expected: a scroll range of 4500 px. Observed: 9000 px — the second half of the scrollbar does nothing.
 */
describe("review: scroll range with sized items", () => {
  it("columns: the range is the width of the columns", () => {
    const columns = Object.fromEntries(Array.from(Array(30), (_, index) => [index, { size: 150 }]));
    const table = mount({
      id: "t",
      rows: makeRows(30, 30),
      columns,
      isVirtualized: true,
      isSelectable: false,
      virtualizerProps: { width: 900, height: 500 },
    });
    table.scroll({ scrollLeft: 3600 });
    expect(table.columnIndexes()).toEqual([24, 25, 26, 27, 28, 29]);
    // CORRECT: 4500px. Observed: 9000px.
    expect(table.container.querySelector<HTMLElement>(".scroller-scrollbar")?.style.minWidth).toBe("4500px");
  });

  it("columns that fit in the window: no scrollbar", () => {
    const columns = Object.fromEntries(Array.from(Array(5), (_, index) => [index, { size: 150 }]));
    const table = mount({
      id: "t",
      rows: makeRows(30, 5),
      columns,
      isVirtualized: true,
      isSelectable: false,
      virtualizerProps: { width: 900, height: 500 },
    });
    // 5 columns of 150 px = 750 px in a window of 900 px
    // CORRECT: "hidden". Observed: "scroll" — a horizontal scrollbar that scrolls 600 px of nothing.
    expect(table.scroller()?.style.overflowX).toBe("hidden");
  });

  it("rows: the range is the height of the rows", () => {
    const table = mount({
      id: "t",
      rows: makeRows(30, 5),
      rowsProps: { 5: { size: 300 } },
      isVirtualized: true,
      isSelectable: false,
      virtualizerProps: { width: 500, height: 500, minRowHeight: 50 },
    });
    table.scroll({ scrollTop: 1250 });
    expect(table.rowIds().slice(-1)).toEqual(["r29"]);
    // 29 rows of 50 px + 1 of 300 px = 1750 px, minus the 500 px of the window (the spacer comes after it)
    // CORRECT: 1250px. Observed: 1550px — 300 px of dead scroll.
    expect(table.container.querySelector<HTMLElement>(".scroller-scrollbar")?.style.minHeight).toBe("1250px");
  });
});
