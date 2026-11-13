import * as React from "react";
import { act, fireEvent, render } from "@testing-library/react";

import Table, { ITableHandle, ITableProps } from "../../src/components/table/table";
import { IOnScroll, ScrollDirection } from "../../src/components/scroller";
import { OnHorizontallyScrollProps, OnScrollProps, OnVerticallyScrollProps } from "../../src/components/virtualizer";
import { generateTable } from "../../stories/utils/tables";

/**
 * A scroll event is processed when it is received, as in 4.x: the window first, then the
 * handlers, inside the event. Nothing waits for an animation frame or a timer, so a test that
 * fires a scroll (fake timers or not) sees its effect when `fireEvent` returns.
 */
describe("scroll events", () => {
  const mount = (virtualizerProps: Partial<NonNullable<ITableProps["virtualizerProps"]>> = {}) => {
    const handle = React.createRef<ITableHandle>();
    const { container } = render(
      <Table
        {...generateTable(200, 60, {}, false)}
        ref={handle}
        isSelectable={false}
        isVirtualized
        virtualizerProps={{ minRowHeight: 40, height: 500, width: 1000, ...virtualizerProps }}
      />,
    );
    const scroller = container.querySelector("[data-testid='scroller-container']") as HTMLElement;
    const firstBodyCell = () => container.querySelectorAll("tbody tr")[0].querySelectorAll("td")[0].textContent;
    return { scroller, firstBodyCell, handle };
  };

  /** Runs outside `act`: only a synchronous render can then change the DOM before the action returns. */
  const outsideAct = (action: () => void) => {
    const environment = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
    const previous = environment.IS_REACT_ACT_ENVIRONMENT;
    environment.IS_REACT_ACT_ENVIRONMENT = false;
    try {
      action();
    } finally {
      environment.IS_REACT_ACT_ENVIRONMENT = previous;
    }
  };
  /** A scroll as the browser reports it: the position on the element, then the event. */
  const nativeScroll = (scroller: HTMLElement, position: { scrollTop?: number; scrollLeft?: number }) => {
    Object.assign(scroller, position);
    scroller.dispatchEvent(new Event("scroll"));
  };

  it("moves the window, then calls the handlers, inside the event", () => {
    const calls: string[] = [];
    const onScroll = jest.fn<void, [OnScrollProps]>(() => void calls.push("scroll"));
    const onHorizontallyScroll = jest.fn<void, [OnHorizontallyScrollProps]>(() => void calls.push("horizontal"));
    const onVerticallyScroll = jest.fn<void, [OnVerticallyScrollProps]>(() => void calls.push("vertical"));
    const { scroller, firstBodyCell } = mount({ onScroll, onHorizontallyScroll, onVerticallyScroll });
    expect(firstBodyCell()).toBe("(1,0)");

    act(() => void fireEvent.scroll(scroller, { target: { scrollTop: 900 } }));

    expect(firstBodyCell()).toBe("(21,0)");
    // every handler at each event, in the order of 4.x
    expect(calls).toEqual(["scroll", "horizontal", "vertical"]);
    const scrollValues: IOnScroll = onVerticallyScroll.mock.calls[0][0].scrollValues;
    expect(scrollValues).toMatchObject({ scrollTop: 900, scrollLeft: 0, directions: [ScrollDirection.down] });
    expect(onVerticallyScroll.mock.calls[0][0].newRowsState?.visibleRowIndexes[0]).toBe(21);
    expect(onHorizontallyScroll.mock.calls[0][0].newColumnsState).toBeNull();
  });

  it("updates both axes from one event", () => {
    const onScroll = jest.fn();
    const { scroller, firstBodyCell } = mount({ onScroll });

    act(() => void fireEvent.scroll(scroller, { target: { scrollTop: 900, scrollLeft: 1050 } }));

    expect(firstBodyCell()).toBe("(21,10)");
    expect(onScroll).toHaveBeenCalledTimes(1);
    expect(onScroll.mock.calls[0][0].scrollValues.directions).toEqual([ScrollDirection.down, ScrollDirection.right]);
  });

  it("waits for no animation frame nor timer", () => {
    const requestAnimationFrame = jest.spyOn(window, "requestAnimationFrame");
    const onVerticallyScroll = jest.fn();
    const { scroller, firstBodyCell } = mount({ onVerticallyScroll });
    jest.useFakeTimers();
    try {
      requestAnimationFrame.mockClear();
      act(() => void fireEvent.scroll(scroller, { target: { scrollTop: 900 } }));
      act(() => void fireEvent.scroll(scroller, { target: { scrollTop: 1800 } }));

      // rows of 42 px (500 px for 12 rows): 1800 px is inside the 43rd row
      expect(firstBodyCell()).toBe("(42,0)");
      expect(onVerticallyScroll).toHaveBeenCalledTimes(2);
      expect(requestAnimationFrame).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
      requestAnimationFrame.mockRestore();
    }
  });

  it("renders the new window inside the event: it is painted with its scroll position", () => {
    const { scroller, firstBodyCell } = mount();

    outsideAct(() => nativeScroll(scroller, { scrollTop: 900 }));

    expect(firstBodyCell()).toBe("(21,0)");
  });

  it("lets React schedule the render when synchronousScrollRendering is off", async () => {
    const { scroller, firstBodyCell } = mount({ synchronousScrollRendering: false });

    outsideAct(() => nativeScroll(scroller, { scrollTop: 900 }));

    expect(firstBodyCell()).toBe("(1,0)");
    await act(() => new Promise<void>((resolve) => setTimeout(resolve, 20)));
    expect(firstBodyCell()).toBe("(21,0)");
  });

  it("moves the window at once when the scroll is asked by program; the handlers wait for the event", () => {
    const onVerticallyScroll = jest.fn();
    const { scroller, firstBodyCell, handle } = mount({ onVerticallyScroll, fixedRows: [0] });

    // no scroll event is fired here: jsdom sends none for a scroll made by a script
    act(() => handle.current?.goToRowIndex(30));

    expect(scroller.scrollTop).toBeGreaterThan(0);
    expect(firstBodyCell()).toBe("(30,0)");
    expect(onVerticallyScroll).not.toHaveBeenCalled();

    // the event a browser sends afterwards: the window is already there, the handlers are told
    act(() => void fireEvent.scroll(scroller));
    expect(firstBodyCell()).toBe("(30,0)");
    expect(onVerticallyScroll).toHaveBeenCalledTimes(1);
    expect(onVerticallyScroll.mock.calls[0][0].scrollValues.directions).toEqual([ScrollDirection.down]);
  });

  it("shows the window of `initialScroll` from the first render that follows the mount", () => {
    const { firstBodyCell } = mount({ fixedRows: [0], fixedColumns: [0], initialScroll: { rowIndex: 30, columnIndex: 12 } });

    expect(firstBodyCell()).toBe("(30,0)");
  });
});
