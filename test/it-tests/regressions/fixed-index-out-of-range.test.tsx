import { makeRows, mount } from "./harness";

/**
 * REVIEW FINDING — a fixed column whose index is out of range (a column removed while the
 * application still pins its former index) leaves an empty band on the right of the window.
 *
 * `getVirtualizerCache` (src/components/utils/table.tsx:902) keeps every fixed index that is not
 * hidden in `visibleFixedItems`, existing or not, and takes one column width per index off the
 * space of the scrolling columns (:923-924). In 4.0.2 the window always had one column more
 * than what fits (`<=` at :193, now `<`), which filled that band; 5.0 renders exactly what
 * fits in the reduced space.
 *
 * 20 columns, window of 1000 px, columns of 100 px, `fixedColumns: [0, 99]`.
 * Expected: 10 columns, the window is full (4.0.2 renders 0…9).
 * Observed: 9 columns (0…8): 100 px of the window are empty, at every scroll position but the last.
 */
describe("review: fixed index out of range", () => {
  it("fills the window", () => {
    const table = mount({
      id: "t",
      rows: makeRows(30, 20),
      isVirtualized: true,
      isSelectable: false,
      virtualizerProps: { width: 1000, height: 500, minColumnWidth: 100, fixedColumns: [0, 99] },
    });
    const widths = () =>
      Array.from(
        table.container
          .querySelectorAll<HTMLElement>("tr.table-row")[0]
          .querySelectorAll<HTMLElement>("[data-testid='table-column']"),
      ).reduce((sum, cell) => sum + parseFloat(cell.style.width) + (parseFloat(cell.style.paddingRight) || 0), 0);
    // CORRECT: 1000 px of columns in a window of 1000 px. Observed: 900.
    expect({ columns: table.columnIndexes().length, width: widths() }).toEqual({ columns: 10, width: 1000 });
    table.scroll({ scrollLeft: 300 });
    expect({ columns: table.columnIndexes().length, width: widths() }).toEqual({ columns: 10, width: 1000 });
  });
});
