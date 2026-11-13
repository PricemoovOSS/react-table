import { act, fireEvent, render } from "@testing-library/react";

import Scroller from "../../../src/components/scroller";
import { getScrollAxes, useVirtualizer } from "../../../src/hooks/useVirtualizer";

/**
 * REVIEW FINDING (new feature only) — "Too many re-renders": a component that calls
 * `useVirtualizer` with an array or an object written inline crashes at its first re-render.
 *
 * The window is now derived state keyed on the cache (src/hooks/useVirtualizer.ts:263-272):
 * `if (windowState.cache !== cache) setWindowState(...)` during the render. The cache is a
 * `useMemo` on the identity of `fixedRows`, `fixedColumns`, `hiddenRows`, `hiddenColumns`,
 * `customCellsHeight`, `customCellsWidth` (:128-192). An input written inline is a new identity at
 * each render, so each render builds a new cache, sets the state, and renders again.
 *
 * It is the second example of docs/use-virtualizer.md ("A 2D virtualized grid":
 * `fixedRows: [0], fixedColumns: [0]`). This derivation was introduced during the review
 * (useVirtualizer.ts modified at 18:24); before it, the window was compared and nothing was set
 * when it did not change.
 * `<Table>` and `<Virtualizer>` are not concerned: the unstable identity has to be created by
 * the component that calls the hook (checked: `<Virtualizer>` with inline `customCellsHeight` /
 * `customCellsWidth` renders).
 *
 * Expected: the grid renders and follows the scroll. Observed: React throws.
 */
const errorsOf = (run: () => void): string => {
  const spy = jest.spyOn(console, "error").mockImplementation(() => {});
  try {
    run();
    return "";
  } catch (error) {
    return String(error);
  } finally {
    spy.mockRestore();
  }
};

describe("review: inputs written inline", () => {
  it("useVirtualizer with inline fixed lists (2D grid of the documentation)", () => {
    function Grid() {
      const v = useVirtualizer({
        width: 800,
        height: 500,
        rowsLength: 100,
        columnsLength: 50,
        fixedRows: [0],
        fixedColumns: [0],
      });
      const onScroll = (s: Parameters<typeof getScrollAxes>[0]) => {
        const axes = getScrollAxes(s);
        if (axes.vertical) v.computeRowsState(s.scrollTop);
        if (axes.horizontal) v.computeColumnsState(s.scrollLeft);
      };
      return (
        <Scroller width={800} height={500} virtualWidth={v.virtualWidth} virtualHeight={v.virtualHeight} onScroll={onScroll}>
          <div data-testid="grid">{v.visibleRowIndexes.join(",")}</div>
        </Scroller>
      );
    }
    let text: string | null | undefined;
    const error = errorsOf(() => {
      const view = render(<Grid />);
      const scroller = view.container.querySelector("[data-testid='scroller-container']") as HTMLElement;
      act(() => void fireEvent.scroll(scroller, { target: { scrollTop: 1000 } }));
      text = view.container.querySelector("[data-testid='grid']")?.textContent;
    });
    // CORRECT: no error, the grid shows the rows at 1000 px. Observed: "Too many re-renders".
    expect({ error, startsWithHeader: text?.startsWith("0,") }).toEqual({ error: "", startsWithHeader: true });
  });
});
