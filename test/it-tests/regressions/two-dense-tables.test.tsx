/**
 * FINDING 8 — with two virtualized tables narrower than their window on the same page, a
 * vertical scroll step of one renders ALL its rows as soon as the other table rendered in
 * between (tables scrolled in turn, synchronised scroll, data refreshed in both).
 *
 * Cause: src/components/utils/table.tsx:804-821 — `getDenseColumns` is memoized with
 * `memoize-one`: ONE result for the whole module, shared by every table. Each table evicts the
 * result of the other, gets a new `columns` object at every render of its content
 * (src/components/table/table.tsx:228), and `Row` compares `columns` by identity
 * (src/components/table/row.tsx:488-499).
 *
 * The cells are not rendered again (their props are equal): the cost is the 12 rows, their
 * cell elements and comparators, at every scroll step. The changelog of 5.0 states "a vertical
 * scroll step renders the entering row only".
 *
 * Correct result: 1 row per step, as for a table alone. Present in 4.0.2 as well (executed:
 * 1 row alone, 12 with a second table).
 */
import { act, fireEvent, render } from "@testing-library/react";

import Table, { ITableProps } from "../../../src/components/table/table";
import * as tableUtils from "../../../src/components/utils/table";
import { generateTable } from "../../../stories/utils/tables";

describe("FINDING 8 — two tables narrower than their window", () => {
  it("a vertical scroll step renders the entering row only (observed: 12 rows per step)", () => {
    // called once each time a row renders
    const rowRenders = jest.spyOn(tableUtils, "computeRowStyle");
    const props = (id: string, width: number): ITableProps => ({
      ...generateTable(200, 6, {}, false),
      id,
      isSelectable: false,
      isVirtualized: true,
      virtualizerProps: { height: 500, width, minRowHeight: 40, fixedRows: [0] },
    });

    const view = render(
      <div>
        <div data-testid="a">
          <Table {...props("a", 3000)} />
        </div>
        <div data-testid="b">
          <Table {...props("b", 3100)} />
        </div>
      </div>,
    );
    const scrollerOf = (id: string) => view.getByTestId(id).querySelector("[data-testid='scroller-container']") as HTMLElement;
    const scrollTo = (id: string, scrollTop: number) =>
      act(() => void fireEvent.scroll(scrollerOf(id), { target: { scrollTop } }));

    scrollTo("a", 80);
    scrollTo("b", 80);
    const rowsPerStep: number[] = [];
    for (let step = 3; step <= 5; step++) {
      rowRenders.mockClear();
      scrollTo("a", 40 * step);
      rowsPerStep.push(rowRenders.mock.calls.length);
      scrollTo("b", 40 * step);
    }
    rowRenders.mockRestore();

    expect(rowsPerStep).toEqual([1, 1, 1]);
  });
});
