/**
 * ATTACKED AND HELD — the handlers of rows and cells are created once and read the props of the
 * last render: toggles after the rows moved, Enter / Space on a grid cell, the span toggle,
 * nested sub rows, the context menu after a row was removed, the notifications of the opened
 * trees. These tests PASS.
 */
import * as React from "react";
import { act, fireEvent, render } from "@testing-library/react";

import Table, { ITableHandle, ITableProps } from "../../../src/components/table/table";
import { ITrees } from "../../../src/components/table/elementary-table";
import { IRow } from "../../../src/components/table/row";
import { generateTable } from "../../../stories/utils/tables";

const openable = (rowsCount = 10, cellsCount = 5) => {
  const table = generateTable(rowsCount, cellsCount, {}, true);
  table.rows[4].cells[0].subItems = table.rows[2].cells[0].subItems;
  return table;
};

describe("held — handlers created once read the last props", () => {
  it("toggle by click after the rows moved, with the latest callback", () => {
    const table = openable();
    const calls: string[] = [];
    const ui = (rows: IRow[], tag: string) => (
      <Table
        id="t"
        rows={rows}
        isSelectable={false}
        onOpenedTreesUpdate={(trees: ITrees) => calls.push(`${tag}:${Object.keys(trees).join("+")}`)}
      />
    );
    const view = render(ui(table.rows, "first"));
    const toggles = () => view.getAllByTestId("table-cell-sub-item-toggle");
    fireEvent.click(toggles()[0]);
    expect(calls).toEqual(["first:2"]);
    // a row inserted above: the openable rows are now at 3 and 5; the opened tree stays on index 2 (documented: trees are by index)
    const inserted = { ...table.rows[1], id: "inserted" };
    const moved = [table.rows[0], inserted, ...table.rows.slice(1)];
    view.rerender(ui(moved, "second"));
    const all = toggles();
    fireEvent.click(all[all.length - 1]);
    expect(calls[calls.length - 1].startsWith("second:")).toBe(true);
  });

  it("Enter and Space on a focused grid cell", () => {
    const table = openable();
    const handle = React.createRef<ITableHandle>();
    const view = render(<Table {...table} ref={handle} keyboardNavigation isSelectable={false} />);
    const cell = () => view.container.querySelector<HTMLElement>('[data-cell-row="2"][data-cell-col="0"]') as HTMLElement;
    act(() => cell().focus());
    fireEvent.keyDown(cell(), { key: "Enter" });
    expect(Object.keys(handle.current?.getOpenedTrees() ?? {})).toEqual(["2"]);
    fireEvent.keyDown(cell(), { key: " " });
    expect(Object.keys(handle.current?.getOpenedTrees() ?? {})).toEqual([]);
    fireEvent.keyDown(cell(), { key: " " });
    fireEvent.keyDown(cell(), { key: "Enter" });
    expect(Object.keys(handle.current?.getOpenedTrees() ?? {})).toEqual([]);
  });

  it("row span toggle (isSpan), nested sub rows, fixed sub rows", () => {
    const table = generateTable(10, 5, {}, true);
    const handle = React.createRef<ITableHandle>();
    const view = render(<Table {...table} ref={handle} isSpan isSelectable={false} />);
    const spans = () => view.getAllByTestId("table-toggle-row-btn");
    fireEvent.click(spans()[0]);
    expect(Object.keys(handle.current?.getOpenedTrees() ?? {})).toEqual(["2"]);
    // nested: open the sub row 2 of the opened row
    const nested = view.getAllByTestId("table-cell-sub-item-toggle");
    fireEvent.click(nested[0]);
    const trees = handle.current?.getOpenedTrees() ?? {};
    expect(Object.keys(trees[2].subTrees ?? {})).toHaveLength(1);
    fireEvent.click(spans()[0]);
    expect(Object.keys(handle.current?.getOpenedTrees() ?? {})).toEqual([]);
  });

  it("context menu handler gets the cell of the last render", () => {
    const table = generateTable(10, 5, {}, false);
    const seen: unknown[] = [];
    const Menu = ({ selectionContext }: { selectionContext: { contextCell: unknown } }) => {
      seen.push(selectionContext.contextCell);
      return null;
    };
    const selectionProps = { menuComponent: Menu };
    const view = render(<Table {...table} selectionProps={selectionProps} />);
    const td = (r: number, c: number) => view.container.querySelectorAll("tbody tr")[r].querySelectorAll("td")[c];
    fireEvent.contextMenu(td(1, 2));
    expect(seen[seen.length - 1]).toEqual({ rowIndex: 2, cellIndex: 2 });
    // a row removed above: the same DOM cell (same row id) is now one index higher
    view.rerender(<Table {...table} rows={[table.rows[0], ...table.rows.slice(2)]} selectionProps={selectionProps} />);
    fireEvent.contextMenu(td(0, 2));
    expect(seen[seen.length - 1]).toEqual({ rowIndex: 1, cellIndex: 2 });
  });

  it("onOpenedTreesUpdate: call counts for a toggle, openTrees, closeTrees, a tree dropped by the rows", () => {
    const table = openable();
    const calls: string[] = [];
    const handle = React.createRef<ITableHandle>();
    const props: ITableProps = { ...table, isSelectable: false };
    const view = render(
      <Table {...props} ref={handle} onOpenedTreesUpdate={(trees) => calls.push(Object.keys(trees).join("+") || "none")} />,
    );
    fireEvent.click(view.getAllByTestId("table-cell-sub-item-toggle")[0]);
    act(() => handle.current?.openTrees({ 4: { rowIndex: 4, columnIndex: 0 } }));
    act(() => handle.current?.closeTrees({ 2: { rowIndex: 2, columnIndex: 0 } }));
    act(() => handle.current?.closeTrees({ 7: { rowIndex: 7, columnIndex: 0 } }));
    act(() => handle.current?.openTrees({ 7: { rowIndex: 7, columnIndex: 0 } }));
  });
});
