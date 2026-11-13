import * as React from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";

import Table from "../../../src/components/table/table";
import * as tableUtils from "../../../src/components/utils/table";
import { IRow } from "../../../src/components/table/row";
import { makeRows } from "./harness";

/**
 * REVIEW FINDING (fixed in the working tree during the review, see the status in
 * discarded-render-stale-window.test.tsx: this test passes now and stays as a guard) —
 * same defect as discarded-render-stale-window.test.tsx, without Suspense:
 * a transition (`startTransition`, `useDeferredValue`) that renders the table with new rows is
 * interrupted by an urgent update elsewhere in the page (a keystroke in a search field, a
 * hover…). React restarts the transition; the second render of `useVirtualizer` finds its refs
 * already holding the new window and schedules no state update.
 *
 * Real scheduler here (no `act`): the transition is time-sliced, the urgent update lands
 * between two slices.
 *
 * Expected: header + 9 rows once the transition is committed. Observed: the 2 rows of the
 * previous data, in front of a scroll range of 100 rows.
 */
const SMALL = makeRows(3, 5);
const BIG = makeRows(100, 5);

const sleep = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

/** Renders long enough for React to yield after it. */
function Slow() {
  const end = performance.now() + 8;
  while (performance.now() < end);
  return null;
}

let setRows: (rows: IRow[]) => void = () => {};
let setTick: (tick: number) => void = () => {};

function Toolbar() {
  const [tick, set] = React.useState(0);
  setTick = set;
  return <span data-testid="tick">{tick}</span>;
}

function TablePart() {
  const [rows, set] = React.useState(SMALL);
  setRows = set;
  return (
    <>
      <Table
        id="t"
        rows={rows}
        isVirtualized
        isSelectable={false}
        virtualizerProps={{ width: 500, height: 500, minRowHeight: 50, fixedRows: [0] }}
      />
      {rows === BIG ? Array.from(Array(30), (_, index) => <Slow key={index} />) : null}
    </>
  );
}

const bodyRows = (container: HTMLElement) => container.querySelectorAll("tbody tr.table-row").length;
const scrollRange = (container: HTMLElement) => container.querySelector<HTMLElement>(".scroller-scrollbar")?.style.minHeight;

describe("review: window after an interrupted transition", () => {
  const environment = globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean };
  let previous: boolean | undefined;
  beforeEach(() => {
    previous = environment.IS_REACT_ACT_ENVIRONMENT;
    environment.IS_REACT_ACT_ENVIRONMENT = false;
  });
  afterEach(() => {
    environment.IS_REACT_ACT_ENVIRONMENT = previous;
  });

  it("shows a full window once the restarted transition is committed", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    flushSync(() =>
      root.render(
        <>
          <Toolbar />
          <TablePart />
        </>,
      ),
    );
    expect(bodyRows(container)).toBe(2);

    const cacheBuilds = jest.spyOn(tableUtils, "getVirtualizerCache");
    React.startTransition(() => setRows(BIG));
    // wait for the transition to have rendered the table (not committed: the slow siblings come after)
    for (let i = 0; i < 200 && cacheBuilds.mock.calls.length === 0; i++) await sleep();
    expect(cacheBuilds.mock.calls.length).toBeGreaterThan(0);
    expect(scrollRange(container)).not.toBe("4500px");

    // urgent update elsewhere: React drops the transition in progress and restarts it afterwards
    flushSync(() => setTick(1));
    expect(container.querySelector("[data-testid='tick']")?.textContent).toBe("1");
    expect(scrollRange(container)).not.toBe("4500px");

    for (let i = 0; i < 500 && scrollRange(container) !== "4500px"; i++) await sleep(5);
    expect(scrollRange(container)).toBe("4500px");
    // CORRECT: 9. Observed: 2.
    const shown = bodyRows(container);
    root.unmount();
    container.remove();
    expect(shown).toBe(9);
  });
});
