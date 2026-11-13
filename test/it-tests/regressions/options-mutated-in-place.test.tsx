/**
 * FINDING 4 — an option changed in place inside `columns` (same for `rowsProps`,
 * `globalColumnProps`, `globalRowProps`, `groupsProps`) is never displayed, even when a new
 * container object is given to the table.
 *
 * Cause: src/components/table/table.tsx:300-304 — `useStableValue(value, isEqual)`
 * (src/hooks/useStableValue.ts:9) keeps the previous container while it is deep-equal to the
 * new one. The previous container holds the very objects that were mutated, so it is always
 * equal: the table keeps the old container, `TableContent` is memoized on it and nothing
 * renders. One level below, `getColumnLayout` (src/components/table/row.tsx:178-197) caches the
 * layout by the identity of the column object and would return the stale layout as well.
 *
 * Correct result: class `b`, width 200px. 4.0.2 is correct (executed): a new `columns`
 * container re-rendered the rows, which read the options again.
 */
import { render } from "@testing-library/react";

import Table from "../../../src/components/table/table";
import { generateTable } from "../../../stories/utils/tables";

describe("FINDING 4 — options mutated in place", () => {
  it("displays the new size and class of a column (observed: class a, width 100px)", () => {
    const table = generateTable(10, 8, {}, false);
    const column = { className: "a", size: 100 };
    const ui = () => <Table {...table} isSelectable={false} columns={{ 1: column }} />;
    const view = render(ui());
    const cell = () => view.container.querySelectorAll("tbody tr")[0].querySelectorAll("td")[1] as HTMLElement;
    expect(cell().className).toContain("a");

    column.className = "b";
    column.size = 200;
    view.rerender(ui());

    expect(cell().className).toContain("b");
    expect(cell().style.width).toBe("200px");
  });
});
