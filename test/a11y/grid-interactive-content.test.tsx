import { fireEvent } from "@testing-library/react";

import Table from "../../src/components/table/table";
import { generateTable } from "../../stories/utils/tables";
import { customRender } from "../tests-utils/react-testing-library-utils";

const NAVIGATION_KEYS = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"];

const focusedCoords = () => {
  const cell = document.activeElement as HTMLElement | null;
  return cell?.dataset.cellRow === undefined ? null : `${cell.dataset.cellRow},${cell.dataset.cellCol}`;
};

const Input = () => <input data-testid="cell-input" defaultValue="hello" />;

function tableWithInputs() {
  const table = generateTable(5, 5, {}, false);
  table.rows.forEach((row) =>
    row.cells.forEach((cell) => {
      (cell as { cellContent?: React.ComponentType }).cellContent = Input;
    }),
  );
  return table;
}

describe("keyboard navigation and interactive cell content", () => {
  it("leaves the navigation keys to a field rendered inside a cell", () => {
    const { getAllByTestId } = customRender(<Table {...tableWithInputs()} keyboardNavigation />);
    const input = getAllByTestId("cell-input")[7] as HTMLInputElement;
    input.focus();

    NAVIGATION_KEYS.forEach((key) => {
      const notPrevented = fireEvent.keyDown(input, { key });
      expect({ key, notPrevented, focused: document.activeElement === input }).toEqual({
        key,
        notPrevented: true,
        focused: true,
      });
    });
  });

  it("gives the focus back to the cell on Escape, then navigates again", () => {
    const { getAllByTestId } = customRender(<Table {...tableWithInputs()} keyboardNavigation />);
    const input = getAllByTestId("cell-input")[7] as HTMLInputElement;
    input.focus();

    fireEvent.keyDown(input, { key: "Escape" });
    expect(focusedCoords()).toBe("1,2");

    fireEvent.keyDown(document.activeElement as HTMLElement, { key: "ArrowRight" });
    expect(focusedCoords()).toBe("1,3");
  });

  it("does not mix up its cells with the ones of a table rendered inside a cell", () => {
    const NestedTable = () => <Table {...generateTable(8, 3, { id: "nested" })} keyboardNavigation isSelectable={false} />;
    const table = generateTable(8, 3, { id: "outer" }, false);
    (table.rows[1].cells[1] as { cellContent?: React.ComponentType }).cellContent = NestedTable;
    const { container } = customRender(<Table {...table} keyboardNavigation isSelectable={false} />);

    const outerGrid = container.querySelector("[data-grid-navigation]") as HTMLElement;
    const outerCell = (row: number, col: number) =>
      Array.from(container.querySelectorAll<HTMLElement>(`[data-cell-row="${row}"][data-cell-col="${col}"]`)).find(
        (cell) => cell.closest("[data-grid-navigation]") === outerGrid,
      ) as HTMLElement;

    // the nested table sits in the outer row 1: its own row 5 comes first in the document
    outerCell(4, 0).focus();
    fireEvent.keyDown(outerCell(4, 0), { key: "ArrowDown" });
    expect(document.activeElement).toBe(outerCell(5, 0));

    // a key handled by the nested table does not move the outer one
    const nestedCell = container.querySelector<HTMLElement>('[data-grid-navigation] [data-grid-navigation] [data-cell-row="2"]');
    nestedCell?.focus();
    fireEvent.keyDown(nestedCell as HTMLElement, { key: "ArrowDown" });
    expect((document.activeElement as HTMLElement).closest("[data-grid-navigation]")).not.toBe(outerGrid);
    expect((document.activeElement as HTMLElement).dataset.cellRow).toBe("3");
  });
});
