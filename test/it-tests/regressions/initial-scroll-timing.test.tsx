import * as React from "react";
import { act, fireEvent, render } from "@testing-library/react";

import Table from "../../../src/components/table/table";
import { makeRows } from "./harness";

/**
 * REVIEW FINDINGS on `virtualizerProps.initialScroll` (src/components/virtualizer.tsx:240-247).
 *
 * STATUS: finding 1 reproduced on the code read at the start of the review and was fixed in
 * the working tree while the review was running (virtualizer.tsx modified at 18:26: the test
 * is now `> 0`). Its test passes and stays as a guard. Finding 2 still reproduces.
 *
 * 1. `initialScroll: { columnIndex: 0 }` (or `rowIndex: 0`) scrolled the table by 1 px at
 *    mount. 4.0.2 tested `if (columnIndex && columnIndex >= 0)`: index 0 did nothing. 5.0 tests
 *    `columnIndex != null && columnIndex >= 0`, and the position of an index is its offset + 1.
 *    Consequences: the scroller is not at its origin (`maxLeftReached` / `maxTopReached` are
 *    false), and the scroll handlers of the application are called at mount for a scroll nobody
 *    asked for. An application that passes the index of its columns cursor as
 *    `initialScroll.columnIndex` passes 0 most of the time.
 *
 * 2. The initial scroll is applied in a passive effect (`useEffect`), 4.0.2 applied it in
 *    `componentDidMount`: with a concurrent root the first paint shows the table at position 0,
 *    then it jumps. Shown here by what a layout effect of the parent sees right after the mount.
 */
const ROWS = makeRows(100, 40);

describe("review: initialScroll", () => {
  it("does not move the table for index 0, like 4.0.2", () => {
    const onScroll = jest.fn();
    const view = render(
      <Table
        id="t"
        rows={ROWS}
        isVirtualized
        isSelectable={false}
        virtualizerProps={{ width: 1000, height: 500, initialScroll: { columnIndex: 0, rowIndex: 0 }, onScroll }}
      />,
    );
    const scroller = view.container.querySelector("[data-testid='scroller-container']") as HTMLElement;
    const position = { scrollLeft: scroller.scrollLeft, scrollTop: scroller.scrollTop };
    // a browser dispatches the scroll event of a programmatic scroll
    if (position.scrollLeft || position.scrollTop) act(() => void fireEvent.scroll(scroller));
    // CORRECT: { scrollLeft: 0, scrollTop: 0 } and no call. Observed: 1 px on both axes, one call.
    expect({ ...position, handlerCalls: onScroll.mock.calls.length }).toEqual({ scrollLeft: 0, scrollTop: 0, handlerCalls: 0 });
  });

  it("is applied before the first paint (layout phase), like 4.0.2", () => {
    let seenByLayoutEffect: number | undefined;
    function Page() {
      const host = React.useRef<HTMLDivElement>(null);
      React.useLayoutEffect(() => {
        seenByLayoutEffect = host.current?.querySelector<HTMLElement>("[data-testid='scroller-container']")?.scrollLeft;
      }, []);
      return (
        <div ref={host}>
          <Table
            id="t"
            rows={ROWS}
            isVirtualized
            isSelectable={false}
            virtualizerProps={{ width: 1000, height: 500, initialScroll: { columnIndex: 20 } }}
          />
        </div>
      );
    }
    const view = render(<Page />);
    const scroller = view.container.querySelector("[data-testid='scroller-container']") as HTMLElement;
    // applied in the end: column 20 is at 20 x 100 px (+ 1)
    expect(scroller.scrollLeft).toBe(2001);
    // CORRECT: 2001 — the scroll is set when the layout effects run, the browser paints the right
    // columns first. Observed: 0 — the table is painted at column 0, then scrolled.
    expect(seenByLayoutEffect).toBe(2001);
  });
});
