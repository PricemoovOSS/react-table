import * as React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

import Virtualizer, { IVirtualizerHandle } from "../../src/components/virtualizer";

type ChildrenArgs = Parameters<React.ComponentProps<typeof Virtualizer>["children"]>[0];

const baseProps = {
  width: 400,
  height: 400,
  columnsLength: 50,
  rowsLength: 50,
};

function renderVirtualizer(overrides: Partial<React.ComponentProps<typeof Virtualizer>> = {}) {
  const children = jest.fn<JSX.Element, [ChildrenArgs]>(() => <div data-testid="grid" />);
  const ref = React.createRef<IVirtualizerHandle>();
  const utils = render(
    <Virtualizer ref={ref} {...baseProps} {...(overrides as object)}>
      {children}
    </Virtualizer>,
  );
  return { ...utils, children, ref };
}

function lastCall(children: jest.Mock): ChildrenArgs {
  return children.mock.calls[children.mock.calls.length - 1][0];
}

describe("Virtualizer", () => {
  it("renders the children render-prop", () => {
    renderVirtualizer({
      width: 200,
      height: 100,
    });
    expect(screen.getByTestId("grid")).toBeInTheDocument();
  });

  it("computes the visible window for a default grid", () => {
    const { children } = renderVirtualizer();
    expect(lastCall(children)).toEqual({
      visibleColumnIndexes: [0, 1, 2, 3, 4],
      visibleRowIndexes: [0, 1, 2, 3, 4, 5, 6],
      elevatedColumnIndexes: { absoluteEndPositions: {}, elevations: {} },
      elevatedRowIndexes: { absoluteEndPositions: {}, elevations: {} },
      cellHeight: 58,
      cellWidth: 100,
    });
  });

  it("returns empty visible windows when the viewport is 0×0", () => {
    const { children } = renderVirtualizer({ width: 0, height: 0 });
    expect(lastCall(children)).toEqual({
      visibleColumnIndexes: [],
      visibleRowIndexes: [],
      elevatedColumnIndexes: { absoluteEndPositions: {}, elevations: {} },
      elevatedRowIndexes: { absoluteEndPositions: {}, elevations: {} },
      cellHeight: 0,
      cellWidth: 0,
    });
  });

  it("elevates fixed rows/columns at the end", () => {
    const { children } = renderVirtualizer({ fixedColumns: [30], fixedRows: [15] });
    expect(lastCall(children)).toEqual({
      visibleColumnIndexes: [0, 1, 2, 3, 30],
      visibleRowIndexes: [0, 1, 2, 3, 4, 5, 15],
      elevatedColumnIndexes: {
        absoluteEndPositions: { 30: 0 },
        elevations: { 3: "end", 30: "absolute" },
      },
      elevatedRowIndexes: {
        absoluteEndPositions: { 15: 0 },
        elevations: { 15: "absolute" },
      },
      cellHeight: 58,
      cellWidth: 100,
    });
  });

  it("supports hidden + fixed indexes simultaneously", () => {
    const { children } = renderVirtualizer({
      fixedColumns: [0, 14],
      hiddenColumns: [0, 2],
      fixedRows: [0, 3, 15],
      hiddenRows: [0, 2, 6],
    });
    expect(lastCall(children)).toEqual({
      visibleColumnIndexes: [1, 3, 4, 5, 14],
      visibleRowIndexes: [1, 3, 4, 5, 7, 8, 15],
      elevatedColumnIndexes: {
        absoluteEndPositions: { 14: 0 },
        elevations: { 14: "absolute", 5: "end" },
      },
      elevatedRowIndexes: {
        absoluteEndPositions: { 15: 0 },
        elevations: { 15: "absolute" },
      },
      cellHeight: 58,
      cellWidth: 100,
    });
  });

  it("elevates fixed rows/columns at the start", () => {
    const { children } = renderVirtualizer({ fixedColumns: [0], fixedRows: [0] });
    expect(lastCall(children)).toEqual(
      expect.objectContaining({
        elevatedColumnIndexes: { absoluteEndPositions: {}, elevations: { 0: "start" } },
        elevatedRowIndexes: { absoluteEndPositions: {}, elevations: { 0: "start" } },
      }),
    );
  });

  it("respects rowsCount and columnsCount", () => {
    const { children } = renderVirtualizer({ rowsCount: 3, columnsCount: 3 });
    expect(lastCall(children)).toEqual(
      expect.objectContaining({
        visibleColumnIndexes: [0, 1, 2],
        visibleRowIndexes: [0, 1, 2],
        cellHeight: 134,
        cellWidth: 134,
      }),
    );
  });

  it("respects minColumnWidth and minRowHeight", () => {
    const { children } = renderVirtualizer({ minColumnWidth: 100, minRowHeight: 100 });
    expect(lastCall(children)).toEqual(
      expect.objectContaining({
        visibleColumnIndexes: [0, 1, 2, 3, 4],
        visibleRowIndexes: [0, 1, 2, 3, 4],
        cellHeight: 100,
        cellWidth: 100,
      }),
    );
  });

  it("recomputes the visible row window on vertical scroll", () => {
    const { children } = renderVirtualizer({
      columnsLength: 100,
      rowsLength: 100,
      rowsCount: 4,
      columnsCount: 4,
    });
    const container = screen.getByTestId("scroller-container");
    children.mockClear();
    container.scrollTop = 100;
    fireEvent.scroll(container);
    expect(lastCall(children).visibleRowIndexes).toEqual([1, 2, 3, 4, 5]);

    container.scrollTop = 9600;
    fireEvent.scroll(container);
    expect(lastCall(children).visibleRowIndexes).toEqual([96, 97, 98, 99]);
  });

  it("recomputes the visible column window on horizontal scroll", () => {
    const { children } = renderVirtualizer({
      columnsLength: 100,
      rowsLength: 100,
      rowsCount: 4,
      columnsCount: 4,
    });
    const container = screen.getByTestId("scroller-container");
    children.mockClear();
    container.scrollLeft = 100;
    fireEvent.scroll(container);
    expect(lastCall(children).visibleColumnIndexes).toEqual([1, 2, 3, 4, 5]);

    container.scrollLeft = 100 * 100 - baseProps.width;
    fireEvent.scroll(container);
    expect(lastCall(children).visibleColumnIndexes).toEqual([96, 97, 98, 99]);
  });

  it("invokes onScroll, onVerticallyScroll and onHorizontallyScroll with cursors", () => {
    const onScroll = jest.fn();
    const onVerticallyScroll = jest.fn();
    const onHorizontallyScroll = jest.fn();
    renderVirtualizer({
      columnsLength: 100,
      rowsLength: 100,
      rowsCount: 4,
      columnsCount: 4,
      onScroll,
      onVerticallyScroll,
      onHorizontallyScroll,
    });

    const container = screen.getByTestId("scroller-container");
    container.scrollLeft = 100;
    fireEvent.scroll(container);
    expect(onScroll).toHaveBeenCalledWith(
      expect.objectContaining({
        columnsCursor: 1,
        newColumnsState: expect.objectContaining({ visibleColumnIndexes: [1, 2, 3, 4, 5] }),
      }),
    );
    expect(onHorizontallyScroll).toHaveBeenCalledWith(expect.objectContaining({ columnsCursor: 1 }));

    onScroll.mockClear();
    onVerticallyScroll.mockClear();
    container.scrollLeft = 0;
    container.scrollTop = 100;
    fireEvent.scroll(container);
    expect(onVerticallyScroll).toHaveBeenCalledWith(
      expect.objectContaining({
        rowsCursor: 1,
        newRowsState: expect.objectContaining({ visibleRowIndexes: [1, 2, 3, 4, 5] }),
      }),
    );
  });

  it("places a 'start' elevation when a fixed row has a custom size", () => {
    const { children } = renderVirtualizer({
      fixedRows: [0, 2],
      customCellsHeight: {
        fixed: { sum: 200, count: 2 },
        scrollable: { sum: 0, count: 0 },
        customSizes: { 0: 100, 2: 100 },
      },
    });
    expect(lastCall(children)).toEqual(
      expect.objectContaining({
        elevatedRowIndexes: { absoluteEndPositions: {}, elevations: { 0: "start" } },
      }),
    );
  });

  it("scrollToColumnIndex / scrollToRowIndex delegate to the underlying Scroller", () => {
    const { ref } = renderVirtualizer({
      fixedColumns: [0, 2],
      customCellsWidth: {
        fixed: { sum: 200, count: 2 },
        scrollable: { sum: 0, count: 0 },
        customSizes: { 0: 100, 2: 100 },
      },
    });
    const container = screen.getByTestId("scroller-container") as HTMLDivElement;
    ref.current?.scrollToColumnIndex(25);
    expect(container.scrollLeft).toBeGreaterThan(0);
    ref.current?.scrollToRowIndex(30);
    expect(container.scrollTop).toBeGreaterThan(0);
  });
});
