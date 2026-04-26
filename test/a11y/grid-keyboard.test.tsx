import * as React from "react";
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
    const { container } = customRender(<Table {...props} />);
    const wrapper = container.querySelector(".grid-keyboard-wrapper") as HTMLElement;

    expect(wrapper.getAttribute("tabindex")).toBe("0");
    // focus() fires the onFocus handler which synchronously redirects to the first body cell.
    wrapper.focus();
    fireEvent.focus(wrapper);
    expect(focusedCoords()).toEqual({ row: 1, col: 0 });
  });

  it("ArrowDown / ArrowRight move focus by one cell", () => {
    const props = generateTable(5, 3);
    customRender(<Table {...props} />);
    const start = findCell(1, 0);
    start.focus();

    fireEvent.keyDown(start, { key: "ArrowRight" });
    expect(focusedCoords()).toEqual({ row: 1, col: 1 });

    fireEvent.keyDown(document.activeElement!, { key: "ArrowDown" });
    expect(focusedCoords()).toEqual({ row: 2, col: 1 });
  });

  it("ArrowUp / ArrowLeft clamp at 0", () => {
    const props = generateTable(5, 3);
    customRender(<Table {...props} />);
    const start = findCell(0, 0);
    start.focus();

    fireEvent.keyDown(start, { key: "ArrowUp" });
    expect(focusedCoords()).toEqual({ row: 0, col: 0 });

    fireEvent.keyDown(document.activeElement!, { key: "ArrowLeft" });
    expect(focusedCoords()).toEqual({ row: 0, col: 0 });
  });

  it("ArrowDown clamps at totalRows-1", () => {
    const props = generateTable(3, 2);
    customRender(<Table {...props} />);
    const start = findCell(2, 0);
    start.focus();

    fireEvent.keyDown(start, { key: "ArrowDown" });
    expect(focusedCoords()).toEqual({ row: 2, col: 0 });
  });

  it("Home moves to col 0 of the current row, End to last col", () => {
    const props = generateTable(5, 4);
    customRender(<Table {...props} />);
    const start = findCell(2, 1);
    start.focus();

    fireEvent.keyDown(start, { key: "End" });
    expect(focusedCoords()).toEqual({ row: 2, col: 3 });

    fireEvent.keyDown(document.activeElement!, { key: "Home" });
    expect(focusedCoords()).toEqual({ row: 2, col: 0 });
  });

  it("Ctrl+Home goes to (0,0) and Ctrl+End to last cell", () => {
    const props = generateTable(5, 4);
    customRender(<Table {...props} />);
    const start = findCell(2, 2);
    start.focus();

    fireEvent.keyDown(start, { key: "End", ctrlKey: true });
    expect(focusedCoords()).toEqual({ row: 4, col: 3 });

    fireEvent.keyDown(document.activeElement!, { key: "Home", ctrlKey: true });
    expect(focusedCoords()).toEqual({ row: 0, col: 0 });
  });

  it("PageDown / PageUp move by `keyboardPageSize`", () => {
    const props = generateTable(20, 3);
    customRender(<Table {...props} keyboardPageSize={5} />);
    const start = findCell(2, 0);
    start.focus();

    fireEvent.keyDown(start, { key: "PageDown" });
    expect(focusedCoords()).toEqual({ row: 7, col: 0 });

    fireEvent.keyDown(document.activeElement!, { key: "PageUp" });
    expect(focusedCoords()).toEqual({ row: 2, col: 0 });
  });

  it("does not handle keys when disableKeyboardNavigation is true", () => {
    const props = generateTable(5, 3);
    const { container } = customRender(<Table {...props} disableKeyboardNavigation />);
    const wrapper = container.querySelector(".grid-keyboard-wrapper") as HTMLElement;
    // Without nav, the wrapper isn't tabbable and arrow keys don't move focus.
    expect(wrapper.hasAttribute("tabindex")).toBe(false);

    const start = findCell(1, 0);
    start.focus();
    fireEvent.keyDown(start, { key: "ArrowRight" });
    expect(focusedCoords()).toEqual({ row: 1, col: 0 });
  });
});
