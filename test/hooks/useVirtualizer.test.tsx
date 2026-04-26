import * as React from "react";
import { act, render } from "@testing-library/react";

import { useVirtualizer, IUseVirtualizerProps, IUseVirtualizerResult } from "../../src/hooks/useVirtualizer";

function Probe({ onResult, ...props }: IUseVirtualizerProps & { onResult: (r: IUseVirtualizerResult) => void }) {
  const result = useVirtualizer(props);
  onResult(result);
  return null;
}

function runHook(initial: IUseVirtualizerProps) {
  let captured!: IUseVirtualizerResult;
  const utils = render(
    <Probe
      {...initial}
      onResult={(r) => {
        captured = r;
      }}
    />,
  );
  return {
    get: () => captured,
    rerender: (next: IUseVirtualizerProps) =>
      utils.rerender(
        <Probe
          {...next}
          onResult={(r) => {
            captured = r;
          }}
        />,
      ),
  };
}

describe("useVirtualizer", () => {
  it("computes a default visible window", () => {
    const { get } = runHook({ width: 400, height: 400, rowsLength: 50, columnsLength: 50 });
    expect(get().visibleColumnIndexes).toEqual([0, 1, 2, 3, 4]);
    expect(get().visibleRowIndexes).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(get().cellHeight).toBe(58);
    expect(get().cellWidth).toBe(100);
  });

  it("respects fixed indexes (start)", () => {
    const { get } = runHook({
      width: 400,
      height: 400,
      rowsLength: 50,
      columnsLength: 50,
      fixedColumns: [0],
      fixedRows: [0],
    });
    expect(get().elevatedColumnIndexes).toEqual({ absoluteEndPositions: {}, elevations: { 0: "start" } });
    expect(get().elevatedRowIndexes).toEqual({ absoluteEndPositions: {}, elevations: { 0: "start" } });
  });

  it("computes a new column window when computeColumnsState is called", () => {
    const { get } = runHook({
      width: 400,
      height: 400,
      rowsLength: 100,
      columnsLength: 100,
      rowsCount: 4,
      columnsCount: 4,
    });
    let next: ReturnType<IUseVirtualizerResult["computeColumnsState"]>;
    act(() => {
      next = get().computeColumnsState(100);
    });
    expect(next!).toEqual(expect.objectContaining({ visibleColumnIndexes: [1, 2, 3, 4, 5] }));
    expect(get().visibleColumnIndexes).toEqual([1, 2, 3, 4, 5]);
  });

  it("returns null from computeRowsState when the visible window did not change", () => {
    const { get } = runHook({
      width: 400,
      height: 400,
      rowsLength: 100,
      columnsLength: 100,
      rowsCount: 4,
      columnsCount: 4,
    });
    let result: ReturnType<IUseVirtualizerResult["computeRowsState"]>;
    act(() => {
      result = get().computeRowsState(0);
    });
    expect(result!).toBeNull();
  });

  it("preserves scroll position when inputs change (regression: 'jump to top' bug)", () => {
    const { get, rerender } = runHook({
      width: 400,
      height: 400,
      rowsLength: 100,
      columnsLength: 100,
      rowsCount: 4,
      columnsCount: 4,
    });

    // Scroll past the start.
    act(() => {
      get().computeRowsState(500);
    });
    expect(get().visibleRowIndexes).toEqual([5, 6, 7, 8, 9]);

    // Now change an input that triggers cache rebuild — visible window should remain anchored.
    rerender({
      width: 400,
      height: 400,
      rowsLength: 200, // changed
      columnsLength: 100,
      rowsCount: 4,
      columnsCount: 4,
    });
    expect(get().visibleRowIndexes).toEqual([5, 6, 7, 8, 9]);
  });

  it("exposes scrollTo* helpers translating an index to a scroll value", () => {
    const { get } = runHook({
      width: 400,
      height: 400,
      rowsLength: 50,
      columnsLength: 50,
      fixedColumns: [0, 2],
      customCellsWidth: {
        fixed: { sum: 200, count: 2 },
        scrollable: { sum: 0, count: 0 },
        customSizes: { 0: 100, 2: 100 },
      },
    });
    expect(get().getScrollLeftForColumnIndex(25)).toBe(2301);
    expect(get().getScrollLeftForColumnIndex(99999)).toBeUndefined();
  });

  it("computes virtualWidth/virtualHeight including custom scrollable sizes", () => {
    const { get } = runHook({
      width: 400,
      height: 400,
      rowsLength: 50,
      columnsLength: 50,
      customCellsHeight: {
        fixed: { sum: 0, count: 0 },
        scrollable: { sum: 100, count: 1 },
        customSizes: { 5: 100 },
      },
    });
    expect(get().virtualHeight).toBeGreaterThan(0);
    expect(get().virtualWidth).toBeGreaterThan(0);
  });

  it("computes cursor positions skipping fixed indexes", () => {
    const { get } = runHook({
      width: 400,
      height: 400,
      rowsLength: 50,
      columnsLength: 50,
      rowsCount: 4,
      columnsCount: 4,
      fixedRows: [0],
      fixedColumns: [0],
    });
    const cursors = get().getCursors(
      { visibleRowIndexes: get().visibleRowIndexes, elevatedRowIndexes: get().elevatedRowIndexes },
      { visibleColumnIndexes: get().visibleColumnIndexes, elevatedColumnIndexes: get().elevatedColumnIndexes },
    );
    expect(cursors.rowsCursor).toBe(1);
    expect(cursors.columnsCursor).toBe(1);
  });

  it("extends the visible window with overscan in both directions", () => {
    const { get } = runHook({
      width: 400,
      height: 400,
      rowsLength: 100,
      columnsLength: 100,
      rowsCount: 4,
      columnsCount: 4,
      overscan: 2,
    });
    // Default scroll → row window starts at 0, overscan only adds tail.
    expect(get().visibleRowIndexes).toEqual([0, 1, 2, 3, 4, 5, 6]);

    act(() => {
      get().computeRowsState(500);
    });
    // Window was [5,6,7,8,9]; +2 head, +2 tail => [3..11].
    expect(get().visibleRowIndexes).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });

  it("does not duplicate fixed indexes when overscan is enabled", () => {
    const { get } = runHook({
      width: 400,
      height: 400,
      rowsLength: 100,
      columnsLength: 100,
      rowsCount: 4,
      columnsCount: 4,
      fixedRows: [10],
      overscan: 2,
    });
    act(() => {
      get().computeRowsState(500);
    });
    const idx = get().visibleRowIndexes;
    expect(new Set(idx).size).toBe(idx.length);
  });
});
