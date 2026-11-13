import { loggedErrors, makeRows, mount } from "./harness";

/**
 * REVIEW FINDING — an index given twice in `fixedRows` / `fixedColumns` renders the row (the
 * cells) twice with the same key: React logs "Encountered two children with the same key",
 * and from there may keep a stale copy of the row in the DOM after the list is corrected.
 * Present in 4.0.2 too (run during the review). The duplicate also takes the room of one more
 * row off the window.
 *
 * `getVirtualizerCache` (src/components/utils/table.tsx:902) and
 * `addSequentialIndexesToFixedIndexList` (:218) keep the list as given.
 *
 * Expected: the header once, no error. Observed: the header twice, one React error.
 */
describe("review: duplicated fixed index", () => {
  it("renders the row once", () => {
    const table = mount({
      id: "t",
      rows: makeRows(30, 8),
      isVirtualized: true,
      isSelectable: false,
      virtualizerProps: { width: 800, height: 500, minRowHeight: 50, fixedRows: [0, 0] },
    });
    const errors = loggedErrors(table.errors).map((message) => message.slice(0, 60));
    table.errors.mockClear();
    // CORRECT: 1 and []. Observed: 2 and ["Warning: Encountered two children with the same key, …"].
    expect({ headers: table.rowIds().filter((id) => id === "r0").length, errors }).toEqual({ headers: 1, errors: [] });
  });
});
