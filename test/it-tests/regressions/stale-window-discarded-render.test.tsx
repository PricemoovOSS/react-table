import * as React from "react";
import { act, render } from "@testing-library/react";

import Table from "../../../src/components/table/table";
import { IRow } from "../../../src/components/table/row";
import { makeRows } from "./harness";

/**
 * REVIEW FINDING — a render that React discards (Suspense, interrupted transition) leaves the
 * window stale.
 *
 * STATUS: reproduced (4 tests below failing, 4.0.2 correct on 4 of the 5 scenarios) on the code
 * read at the start of the review. `src/hooks/useVirtualizer.ts` was rewritten in the working
 * tree while the review was running (18:24: the window is now state kept with its cache, lines
 * 257-273): these tests pass on that version and stay as guards. What follows describes the
 * previous code. The new derivation has its own defect: unstable-inputs-render-loop.test.tsx.
 *
 * `useVirtualizer` derives the window from the cache during render: it writes the new window
 * in `rowsStateRef` / `previousCacheRef` (refs) and calls `setRowsState`. When React throws
 * that render away, the state update goes with it but the refs keep the new window. The
 * render is done again: the window is compared with the ref, found "unchanged", and no state
 * update is scheduled. The table is committed with the window of the previous data.
 *
 * Scenarios (concurrent root, what `createRoot` and RTL 15 give):
 * - StrictMode, in development: every render is done twice, the first one is discarded;
 * - a table of 3 rows receives 100 rows in the same update as a sibling that suspends (lazy
 *   component, suspense query), with or without a transition;
 * - interrupted transition: see interrupted-transition-stale-window.test.tsx.
 *
 * Expected: once the sibling is ready, the table shows a full window (header + 9 rows for
 * 500 px of 50 px rows). Observed: it still shows the 3 rows of the previous data.
 */
const SMALL = makeRows(3, 5);
const BIG = makeRows(100, 5);

interface IGate {
  ready: boolean;
  promise: Promise<void>;
  open: () => void;
}

function createGate(): IGate {
  const gate = { ready: false } as IGate;
  gate.promise = new Promise<void>((resolve) => {
    gate.open = () => {
      gate.ready = true;
      resolve();
    };
  });
  return gate;
}

function Sibling({ gate }: { gate: IGate | null }) {
  // a component suspends by throwing a promise
  // eslint-disable-next-line @typescript-eslint/no-throw-literal
  if (gate && !gate.ready) throw gate.promise;
  return <span data-testid="sibling" />;
}

function Page({ rows, gate }: { rows: IRow[]; gate: IGate | null }) {
  return (
    <React.Suspense fallback={<span data-testid="fallback" />}>
      <Table
        id="t"
        rows={rows}
        isVirtualized
        isSelectable={false}
        virtualizerProps={{ width: 500, height: 500, minRowHeight: 50, fixedRows: [0] }}
      />
      <Sibling gate={gate} />
    </React.Suspense>
  );
}

const bodyRows = (container: HTMLElement) => container.querySelectorAll("tbody tr.table-row").length;

describe("review: window after a discarded render", () => {
  it("reference: the same change without a suspending sibling fills the window", () => {
    const view = render(<Page rows={SMALL} gate={null} />);
    expect(bodyRows(view.container)).toBe(2);
    view.rerender(<Page rows={BIG} gate={null} />);
    expect(bodyRows(view.container)).toBe(9);
  });

  it("StrictMode (development): follows its props", () => {
    // StrictMode renders twice and keeps the second render: the first one is a discarded render.
    const view = render(
      <React.StrictMode>
        <Page rows={SMALL} gate={null} />
      </React.StrictMode>,
    );
    expect(bodyRows(view.container)).toBe(2);
    view.rerender(
      <React.StrictMode>
        <Page rows={BIG} gate={null} />
      </React.StrictMode>,
    );
    expect(view.container.querySelector<HTMLElement>(".scroller-scrollbar")?.style.minHeight).toBe("4500px");
    // CORRECT: 9. Observed: 2 — in development, under StrictMode, every change of rows, size,
    // fixed or hidden items that moves the window is ignored.
    expect(bodyRows(view.container)).toBe(9);
  });

  it("StrictMode (development): a smaller container shows fewer rows", () => {
    const table = (height: number) => (
      <React.StrictMode>
        <Table id="t" rows={BIG} isVirtualized isSelectable={false} virtualizerProps={{ width: 500, height, minRowHeight: 50 }} />
      </React.StrictMode>
    );
    const view = render(table(500));
    expect(view.container.querySelectorAll("tr.table-row").length).toBe(10);
    view.rerender(table(200));
    // CORRECT: 4 rows of 50 px in 200 px. Observed: the 10 rows of the previous size.
    expect(view.container.querySelectorAll("tr.table-row").length).toBe(4);
  });

  it("fills the window when the update that brings the rows suspended first", async () => {
    const view = render(<Page rows={SMALL} gate={null} />);
    expect(bodyRows(view.container)).toBe(2);

    const gate = createGate();
    // the table is rendered with the 100 rows, then the sibling suspends: the render is discarded
    view.rerender(<Page rows={BIG} gate={gate} />);
    await act(async () => {
      gate.open();
      await gate.promise;
    });

    expect(view.container.querySelector("[data-testid='sibling']")).not.toBeNull();
    // 100 rows are there: the scroll range says so
    expect(view.container.querySelector<HTMLElement>(".scroller-scrollbar")?.style.minHeight).toBe("4500px");
    // CORRECT: 9 (a full window). The stale window [0, 1, 2] gives 2.
    expect(bodyRows(view.container)).toBe(9);
  });

  it("fills the window when a transition that brings the rows suspended first", async () => {
    let setState: (state: { rows: IRow[]; gate: IGate | null }) => void = () => {};
    function Stateful() {
      const [state, set] = React.useState<{ rows: IRow[]; gate: IGate | null }>({ rows: SMALL, gate: null });
      setState = set;
      return <Page rows={state.rows} gate={state.gate} />;
    }
    const view = render(<Stateful />);
    expect(bodyRows(view.container)).toBe(2);

    const gate = createGate();
    act(() => React.startTransition(() => setState({ rows: BIG, gate })));
    // a transition keeps what is displayed while it is suspended
    expect(bodyRows(view.container)).toBe(2);
    await act(async () => {
      gate.open();
      await gate.promise;
    });

    expect(view.container.querySelector<HTMLElement>(".scroller-scrollbar")?.style.minHeight).toBe("4500px");
    // CORRECT: 9. Observed: 2.
    expect(bodyRows(view.container)).toBe(9);
  });
});
