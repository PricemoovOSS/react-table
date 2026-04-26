import * as React from "react";
import { fireEvent } from "@testing-library/react";

import Table from "../../src/components/table/table";
import { generateTable, subRows, subMiam } from "../../stories/utils/tables";
import { customRender } from "../tests-utils/react-testing-library-utils";

function findCell(row: number, col: number): HTMLElement {
  const el = document.querySelector<HTMLElement>(`[data-cell-row="${row}"][data-cell-col="${col}"]`);
  if (!el) throw new Error(`No cell at row=${row} col=${col}`);
  return el;
}

function focusedCoords(): { row: number; col: number } | null {
  const cell = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>("[data-cell-row][data-cell-col]");
  if (!cell) return null;
  return { row: Number(cell.dataset.cellRow), col: Number(cell.dataset.cellCol) };
}

describe("Grid keyboard navigation (advanced)", () => {
  it("focus restoration after a click, leaving and re-entering", () => {
    const props = generateTable(5, 4);
    const { container } = customRender(<Table {...props} />);
    const wrapper = container.querySelector(".grid-keyboard-wrapper") as HTMLElement;

    // User clicks cell (2,2) — DOM .focus() moves activeElement AND fires the focus
    // event that bubbles to the wrapper, which records the cell as active.
    const cell = findCell(2, 2);
    cell.focus();
    expect(focusedCoords()).toEqual({ row: 2, col: 2 });

    // User Tabs out and Tabs back in — focus lands on the wrapper itself, which
    // synchronously delegates back to the recorded active cell.
    cell.blur();
    wrapper.focus();
    expect(focusedCoords()).toEqual({ row: 2, col: 2 });
  });

  it("ArrowDown skips hidden rows", () => {
    const props = generateTable(10, 3);
    customRender(<Table {...props} isVirtualized virtualizerProps={{ height: 500, width: 600, hiddenRows: [2, 3] }} />);
    const start = findCell(1, 0);
    start.focus();
    fireEvent.keyDown(start, { key: "ArrowDown" });
    // Row 2 and 3 hidden → land on row 4.
    expect(focusedCoords()).toEqual({ row: 4, col: 0 });
  });

  it("ArrowRight skips hidden columns", () => {
    const props = generateTable(3, 10);
    customRender(<Table {...props} isVirtualized virtualizerProps={{ height: 500, width: 1000, hiddenColumns: [2, 3, 4] }} />);
    const start = findCell(1, 1);
    start.focus();
    fireEvent.keyDown(start, { key: "ArrowRight" });
    // Cols 2, 3, 4 hidden → land on col 5.
    expect(focusedCoords()).toEqual({ row: 1, col: 5 });
  });

  it("Ctrl+Home lands on the first visible cell, not on a hidden one", () => {
    const props = generateTable(5, 5);
    customRender(
      <Table {...props} isVirtualized virtualizerProps={{ height: 500, width: 600, hiddenRows: [0], hiddenColumns: [0] }} />,
    );
    const start = findCell(2, 2);
    start.focus();
    fireEvent.keyDown(start, { key: "Home", ctrlKey: true });
    expect(focusedCoords()).toEqual({ row: 1, col: 1 });
  });

  it("Enter on a cell with subItems toggles the open state", () => {
    const onOpenedTreesUpdate = jest.fn();
    const rows = subRows({ subsubRows: subMiam });
    customRender(<Table id="t" rows={rows} isSelectable={false} onOpenedTreesUpdate={onOpenedTreesUpdate} />);

    // The third cell in the first row has subItems in this fixture.
    const cell = findCell(0, 2);
    cell.focus();
    fireEvent.keyDown(cell, { key: "Enter" });
    expect(onOpenedTreesUpdate).toHaveBeenCalledWith(expect.objectContaining({ 0: { rowIndex: 0, columnIndex: 2 } }));
  });

  it("Space on a cell with subItems also toggles", () => {
    const onOpenedTreesUpdate = jest.fn();
    const rows = subRows({ subsubRows: subMiam });
    customRender(<Table id="t" rows={rows} isSelectable={false} onOpenedTreesUpdate={onOpenedTreesUpdate} />);

    const cell = findCell(0, 2);
    cell.focus();
    fireEvent.keyDown(cell, { key: " " });
    expect(onOpenedTreesUpdate).toHaveBeenCalled();
  });

  it("Enter on a leaf cell does nothing", () => {
    const onOpenedTreesUpdate = jest.fn();
    const props = generateTable(3, 3);
    customRender(<Table {...props} onOpenedTreesUpdate={onOpenedTreesUpdate} />);

    const cell = findCell(1, 1);
    cell.focus();
    fireEvent.keyDown(cell, { key: "Enter" });
    expect(onOpenedTreesUpdate).not.toHaveBeenCalled();
  });

  it("emits aria-multiselectable on the grid when isSelectable", () => {
    const props = generateTable(3, 3);
    customRender(<Table {...props} />);
    expect(document.querySelector('[role="grid"]')?.getAttribute("aria-multiselectable")).toBe("true");
  });

  it("does not emit aria-multiselectable when isSelectable=false", () => {
    const props = generateTable(3, 3);
    customRender(<Table {...props} isSelectable={false} />);
    expect(document.querySelector('[role="grid"]')?.hasAttribute("aria-multiselectable")).toBe(false);
  });

  it("emits aria-colspan on cells with colspan > 1", () => {
    const props = generateTable(3, 3);
    props.rows[1].cells[0] = { ...props.rows[1].cells[0], colspan: 2 };
    customRender(<Table {...props} />);
    const cell = findCell(1, 0);
    expect(cell.getAttribute("aria-colspan")).toBe("2");
  });

  it("the chevron IconButton is not in the tab order (tabIndex=-1)", () => {
    const rows = subRows({ subsubRows: subMiam });
    customRender(<Table id="t" rows={rows} isSelectable={false} />);
    const button = document.querySelector('[data-testid="table-cell-sub-item-toggle"]');
    expect(button).not.toBeNull();
    expect(button?.getAttribute("tabindex")).toBe("-1");
    // aria-label gives screen-reader users a hint about what the chevron does.
    expect(button?.getAttribute("aria-label")).toBe("Expand sub-rows");
  });

  it("supports ariaLabel on the wrapper", () => {
    const props = generateTable(3, 3);
    const { container } = customRender(<Table {...props} ariaLabel="Q4 Revenue" />);
    expect(container.querySelector(".grid-keyboard-wrapper")?.getAttribute("aria-label")).toBe("Q4 Revenue");
  });

  it("supports ariaLabelledBy", () => {
    const props = generateTable(3, 3);
    const { container } = customRender(
      <>
        <h2 id="grid-title">Sales</h2>
        <Table {...props} ariaLabelledBy="grid-title" />
      </>,
    );
    expect(container.querySelector(".grid-keyboard-wrapper")?.getAttribute("aria-labelledby")).toBe("grid-title");
  });
});
