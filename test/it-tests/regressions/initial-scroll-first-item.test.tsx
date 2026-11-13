/**
 * FINDING 6 — `initialScroll: { columnIndex: 0 }` / `{ rowIndex: 0 }` scrolls the table by one
 * pixel when it mounts. In a browser that scroll emits a scroll event: `onScroll`,
 * `onVerticallyScroll` and `onHorizontallyScroll` are called right after the mount, with
 * `scrollOrigin: "external"` (jsdom emits no scroll event for an assignment: only the position
 * is asserted here).
 *
 * Cause: src/components/virtualizer.tsx:244-245 — `columnIndex != null && columnIndex >= 0`
 * accepts 0, and `getScrollLeftForColumnIndex(0)` is `0 + 1`
 * (src/hooks/useVirtualizer.ts:309-313). 4.0.2 tested `columnIndex && columnIndex >= 0`:
 * index 0 did nothing.
 *
 * Correct result (4.0.2, executed): scrollLeft 0, scrollTop 0. An application that gives the
 * cursor of its manager as `initialScroll` (`columnIndex: columnsCursor.index`) hits it each
 * time the cursor is on the first column.
 */
import { render } from "@testing-library/react";

import Table from "../../../src/components/table/table";
import { generateTable } from "../../../stories/utils/tables";

describe("FINDING 6 — initialScroll on index 0", () => {
  it("leaves the table at its origin (observed: scrollLeft 1, scrollTop 1)", () => {
    const table = generateTable(100, 30, {}, false);
    const view = render(
      <Table
        {...table}
        isSelectable={false}
        isVirtualized
        virtualizerProps={{ minRowHeight: 40, height: 500, width: 1000, initialScroll: { columnIndex: 0, rowIndex: 0 } }}
      />,
    );
    const scroller = view.container.querySelector("[data-testid='scroller-container']") as HTMLElement;
    expect({ scrollLeft: scroller.scrollLeft, scrollTop: scroller.scrollTop }).toEqual({ scrollLeft: 0, scrollTop: 0 });
  });
});
