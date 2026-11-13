import { makeRows, mount } from "./harness";

/**
 * REVIEW FINDING — when the window cannot hold one row (or one column), every row (column) of
 * the table is rendered. Present in 4.0.2 too (run during the review).
 *
 * `getVirtualizerCache` gives an item size of 0 when no item fits (src/components/utils/table.tsx:908-911);
 * `addSequentialIndexesToFixedIndexList` then adds items of size 0 until the space is filled
 * (:193-201): it never is, the loop ends with the data.
 *
 * It happens with a container that is collapsing, a very small browser window, or simply a
 * fixed header with its own size that leaves less than `minRowHeight` under it.
 * Expected: at most one (clipped) row under the header. Observed: the 1000 rows are mounted.
 */
describe("review: window smaller than a row", () => {
  it("height below minRowHeight", () => {
    const table = mount({
      id: "t",
      rows: makeRows(1000, 5),
      isVirtualized: true,
      isSelectable: false,
      virtualizerProps: { width: 500, height: 40, minRowHeight: 56 },
    });
    // CORRECT: 1 row at most. Observed: 1000.
    expect(table.rowIds().length).toBeLessThanOrEqual(1);
  });

  it("less than one row left under a fixed header that has its own height", () => {
    const table = mount({
      id: "t",
      rows: makeRows(1000, 5),
      rowsProps: { 0: { size: 60 } },
      isVirtualized: true,
      isSelectable: false,
      virtualizerProps: { width: 500, height: 100, minRowHeight: 56, fixedRows: [0] },
    });
    // CORRECT: the header and one row. Observed: the 1000 rows.
    expect(table.rowIds().length).toBeLessThanOrEqual(2);
  });

  it("width below minColumnWidth", () => {
    const table = mount({
      id: "t",
      rows: makeRows(20, 300),
      isVirtualized: true,
      isSelectable: false,
      virtualizerProps: { width: 80, height: 500, minColumnWidth: 100 },
    });
    // CORRECT: 1 column at most. Observed: 300.
    expect(table.columnIndexes().length).toBeLessThanOrEqual(1);
  });
});
