import { makeRows, mount } from "./harness";

/**
 * REVIEW FINDING — rows appended to the same array (`rows.push(...)`, then a render of the
 * parent) are ignored. In 4.0.2 the table followed them as soon as the parent rendered with
 * anything new — in practice always, `virtualizerProps` and its arrays being written inline
 * (`getDerivedStateFromProps` recomputed the number of rows at every render).
 *
 * 5.0 derives everything from the identity of `rows`: `rowsLength`, `columnsLength`, the index
 * maps (src/components/table/table.tsx:331-338, useMemo on `[rows]`), the sync of the opened
 * trees (src/hooks/useOpenedTrees.ts:24), and the content is memoized on it (table.tsx:274).
 * Mutating props is not the React way, but it worked, it is not in the migration guide, and
 * the failure is silent: no new row, same scroll range.
 *
 * Expected (4.0.2): 60 rows of 50 px → the scroll range grows (spacer of 2500px after the
 * window) and a scroll to the end shows the last row. Observed: the range stays the one of 10 rows.
 */
describe("review: rows appended in place", () => {
  it("follows the rows like 4.0.2", () => {
    const rows = makeRows(10, 5);
    const props = () => ({
      id: "t",
      rows,
      isVirtualized: true,
      isSelectable: false,
      // inline, like in an application: new object and arrays at every render
      virtualizerProps: { width: 500, height: 500, minRowHeight: 50, fixedRows: [0] },
    });
    const table = mount(props());
    const range = () => table.container.querySelector<HTMLElement>(".scroller-scrollbar")?.style.minHeight;
    // 10 rows of 50 px fill the window: nothing to scroll
    expect(range()).toBe("500px");

    rows.push(...makeRows(50, 5, "more"));
    table.rerender(props());
    table.scroll({ scrollTop: 2500 });
    // CORRECT (4.0.2, run during the review): 2500px and "more49". Observed: 500px and "r9".
    expect({ range: range(), last: table.rowIds().slice(-1)[0] }).toEqual({ range: "2500px", last: "more49" });
  });
});
