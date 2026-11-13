import { fireEvent } from "@testing-library/react";

import Table from "../../src/components/table/table";
import { generateTable } from "../../stories/utils/tables";
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

describe("Grid keyboard navigation", () => {
  it("Tab into the wrapper redirects focus to the first body cell", () => {
    const props = generateTable(5, 3);
    const { container } = customRender(<Table {...props} keyboardNavigation />);
    const wrapper = container.querySelector(".grid-keyboard-wrapper") as HTMLElement;

    expect(wrapper.getAttribute("tabindex")).toBe("0");
    // focus() fires the onFocus handler which synchronously redirects to the first body cell.
    wrapper.focus();
    fireEvent.focus(wrapper);
    expect(focusedCoords()).toEqual({ row: 1, col: 0 });
  });

  it("ArrowDown / ArrowRight move focus by one cell", () => {
    const props = generateTable(5, 3);
    customRender(<Table {...props} keyboardNavigation />);
    const start = findCell(1, 0);
    start.focus();

    fireEvent.keyDown(start, { key: "ArrowRight" });
    expect(focusedCoords()).toEqual({ row: 1, col: 1 });

    fireEvent.keyDown(document.activeElement!, { key: "ArrowDown" });
    expect(focusedCoords()).toEqual({ row: 2, col: 1 });
  });

  it("ArrowUp / ArrowLeft clamp at 0", () => {
    const props = generateTable(5, 3);
    customRender(<Table {...props} keyboardNavigation />);
    const start = findCell(0, 0);
    start.focus();

    fireEvent.keyDown(start, { key: "ArrowUp" });
    expect(focusedCoords()).toEqual({ row: 0, col: 0 });

    fireEvent.keyDown(document.activeElement!, { key: "ArrowLeft" });
    expect(focusedCoords()).toEqual({ row: 0, col: 0 });
  });

  it("ArrowDown clamps at totalRows-1", () => {
    const props = generateTable(3, 2);
    customRender(<Table {...props} keyboardNavigation />);
    const start = findCell(2, 0);
    start.focus();

    fireEvent.keyDown(start, { key: "ArrowDown" });
    expect(focusedCoords()).toEqual({ row: 2, col: 0 });
  });

  it("Home moves to col 0 of the current row, End to last col", () => {
    const props = generateTable(5, 4);
    customRender(<Table {...props} keyboardNavigation />);
    const start = findCell(2, 1);
    start.focus();

    fireEvent.keyDown(start, { key: "End" });
    expect(focusedCoords()).toEqual({ row: 2, col: 3 });

    fireEvent.keyDown(document.activeElement!, { key: "Home" });
    expect(focusedCoords()).toEqual({ row: 2, col: 0 });
  });

  it("Ctrl+Home goes to (0,0) and Ctrl+End to last cell", () => {
    const props = generateTable(5, 4);
    customRender(<Table {...props} keyboardNavigation />);
    const start = findCell(2, 2);
    start.focus();

    fireEvent.keyDown(start, { key: "End", ctrlKey: true });
    expect(focusedCoords()).toEqual({ row: 4, col: 3 });

    fireEvent.keyDown(document.activeElement!, { key: "Home", ctrlKey: true });
    expect(focusedCoords()).toEqual({ row: 0, col: 0 });
  });

  it("PageDown / PageUp move by `keyboardPageSize`", () => {
    const props = generateTable(20, 3);
    customRender(<Table {...props} keyboardNavigation keyboardPageSize={5} />);
    const start = findCell(2, 0);
    start.focus();

    fireEvent.keyDown(start, { key: "PageDown" });
    expect(focusedCoords()).toEqual({ row: 7, col: 0 });

    fireEvent.keyDown(document.activeElement!, { key: "PageUp" });
    expect(focusedCoords()).toEqual({ row: 2, col: 0 });
  });

  it("is off by default: plain table, no focusable cell, no key handled", () => {
    const { container } = customRender(<Table {...generateTable(5, 3)} />);

    expect(container.querySelector(".grid-keyboard-wrapper")).toBeNull();
    expect(container.querySelector('[role="grid"], [role="gridcell"], [role="columnheader"]')).toBeNull();
    expect(container.querySelector("[data-cell-row], td[tabindex], th[tabindex]")).toBeNull();
    // the positions in the whole table are still announced
    const table = container.querySelector("table") as HTMLElement;
    expect(table.getAttribute("aria-rowcount")).toBe("5");
    expect(container.querySelectorAll("tbody td")[1].getAttribute("aria-colindex")).toBe("2");

    const cell = container.querySelectorAll("tbody td")[0] as HTMLElement;
    expect(fireEvent.keyDown(cell, { key: "ArrowRight" })).toBe(true);
  });
});
