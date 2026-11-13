/**
 * FINDING 1 — the visible window is not recomputed when React renders the table twice for one
 * update (StrictMode) or throws a render away and starts it again (transition interrupted by
 * an urgent update).
 *
 * Cause: src/hooks/useVirtualizer.ts:256-273. When the cache changes, the hook writes the new
 * window in `rowsStateRef.current` / `columnsStateRef.current` DURING RENDER and calls
 * `setRowsState` / `setColumnsState`. A ref survives a render that React discards, the state
 * update does not. On the next pass `mergeRowsState(rowsStateRef.current, …)` compares the new
 * window with the ref — already up to date — returns `null`, and no state update is requested:
 * the committed state is the window of the previous props.
 *
 * Correct result: the same rows and columns as without StrictMode / without the interruption.
 * 4.0.2 (class component, window recomputed in componentDidUpdate) is correct in the
 * StrictMode and interrupted-transition cases, on React 17 and on React 18.3.1 createRoot.
 */
import * as React from "react";
import { flushSync } from "react-dom";
import { render } from "@testing-library/react";

import Table, { ITableProps } from "../../../src/components/table/table";
import { generateTable } from "../../../stories/utils/tables";

const VIRTUALIZER = { minRowHeight: 40, height: 500, width: 1000 };

const bodyRowIds = (container: HTMLElement) =>
  Array.from(container.querySelectorAll("tbody tr")).map((row) => row.getAttribute("data-testid"));
const headerCells = (container: HTMLElement) =>
  Array.from(container.querySelectorAll("thead tr th")).map((cell) => `${cell.textContent} ${cell.className}`);

/** What the table shows after `before` then `after`, with and without StrictMode. */
function afterUpdate(before: ITableProps, after: ITableProps, read: (container: HTMLElement) => unknown) {
  const run = (strict: boolean) => {
    const wrap = (props: ITableProps) =>
      strict ? (
        <React.StrictMode>
          <Table {...props} />
        </React.StrictMode>
      ) : (
        <Table {...props} />
      );
    const view = render(wrap(before));
    view.rerender(wrap(after));
    const result = read(view.container);
    view.unmount();
    return result;
  };
  return { plain: run(false), strict: run(true) };
}

describe("FINDING 1 — StrictMode: the window keeps the rows and columns of the previous props", () => {
  const small = generateTable(3, 20, {}, false);
  const big = generateTable(200, 20, {}, false);
  const base = (table: typeof small, virtualizerProps: object = {}): ITableProps => ({
    ...table,
    isSelectable: false,
    isVirtualized: true,
    virtualizerProps: { ...VIRTUALIZER, ...virtualizerProps },
  });

  it("data arrives: 3 rows then 200 rows (observed: 2 body rows instead of 11)", () => {
    const { plain, strict } = afterUpdate(base(small), base(big), bodyRowIds);
    expect(plain).toHaveLength(11);
    expect(strict).toEqual(plain);
  });

  it("the window gets taller: 200px then 800px (observed: 4 body rows instead of 19)", () => {
    const { plain, strict } = afterUpdate(base(big, { height: 200 }), base(big, { height: 800 }), bodyRowIds);
    expect(strict).toEqual(plain);
  });

  it("a column gets hidden (observed: the column is still displayed)", () => {
    const { plain, strict } = afterUpdate(base(big), base(big, { hiddenColumns: [1] }), headerCells);
    expect(String(plain)).not.toContain("(0,1)");
    expect(strict).toEqual(plain);
  });

  it("a column gets pinned (observed: no relief, the column is not fixed)", () => {
    const { plain, strict } = afterUpdate(base(big), base(big, { fixedColumns: [0] }), headerCells);
    expect(String(plain)).toContain("elevated-start");
    expect(strict).toEqual(plain);
  });
});

describe("FINDING 1 — production build path: a transition interrupted by an urgent update", () => {
  const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

  /**
   * The rows are replaced inside `startTransition`. React renders the transition by slices;
   * between two slices an urgent update (here a counter, in an application: a scroll frame of
   * the table itself, which uses flushSync, a hover, a keystroke…) makes React throw the
   * unfinished render away and start it again.
   */
  async function growInTransition(interrupt: boolean) {
    const small = generateTable(3, 20, {}, false);
    const big = generateTable(200, 20, {}, false);
    let passes = 0;
    /** Rendered before the table: counts how many times React starts the render of the new rows. */
    const Probe = ({ active }: { active: boolean }) => {
      if (active) passes += 1;
      return <i />;
    };
    /** Rendered after the table, longer than a slice: the concurrent render yields right after it. */
    const Slow = ({ active }: { active: boolean }) => {
      if (active) {
        const end = performance.now() + 30;
        while (performance.now() < end) {
          /* busy */
        }
      }
      return <i />;
    };
    let grow: () => void = () => undefined;
    let bump: () => void = () => undefined;
    const Counter = () => {
      const [tick, setTick] = React.useState(0);
      bump = () => flushSync(() => setTick((value) => value + 1));
      return <span data-testid="tick">{tick}</span>;
    };
    const App = () => {
      const [isBig, setIsBig] = React.useState(false);
      grow = () => React.startTransition(() => setIsBig(true));
      return (
        <div>
          <Probe active={isBig} />
          <Table {...(isBig ? big : small)} isSelectable={false} isVirtualized virtualizerProps={VIRTUALIZER} />
          <Slow active={isBig} />
          <u />
          <Counter />
        </div>
      );
    };
    const view = render(<App />);
    await wait(30);
    grow();
    if (interrupt) setTimeout(() => bump(), 0);
    await wait(400);
    const result = { rows: bodyRowIds(view.container).length, passes };
    view.unmount();
    return result;
  }

  it("shows the window of the new rows (observed: 2 body rows instead of 11)", async () => {
    const environment = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
    const previous = environment.IS_REACT_ACT_ENVIRONMENT;
    // outside act: React schedules and slices the transition as it does in a browser
    environment.IS_REACT_ACT_ENVIRONMENT = false;
    try {
      const control = await growInTransition(false);
      expect(control).toEqual({ rows: 11, passes: 1 });

      const interrupted = await growInTransition(true);
      // 2 passes: the first render of the transition was thrown away and started again
      expect(interrupted.passes).toBe(2);
      expect(interrupted.rows).toBe(11);
    } finally {
      environment.IS_REACT_ACT_ENVIRONMENT = previous;
    }
  });
});
