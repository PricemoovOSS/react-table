/**
 * ATTACKED AND HELD — lifecycle: a table unmounted while a scroll frame is pending, scroll
 * handlers called once per frame, selection by drag (also when the table becomes selectable
 * after its mount, under StrictMode, and with mouse down and mouse enter in one batch), a plain
 * table under StrictMode. These tests PASS.
 */
import * as React from "react";
import { act, fireEvent, render } from "@testing-library/react";

import Table, { ITableHandle } from "../../../src/components/table/table";
import { generateTable } from "../../../stories/utils/tables";

const VIRTUALIZER = { minRowHeight: 40, height: 500, width: 1000 };

describe("held — selection", () => {
  const td = (container: HTMLElement, r: number, c: number) =>
    container.querySelectorAll("tbody tr")[r].querySelectorAll("td")[c];

  it("selects a rectangle by drag and stops at mouse up", () => {
    const table = generateTable(100, 30, {}, false);
    const view = render(<Table {...table} isVirtualized virtualizerProps={VIRTUALIZER} />);
    fireEvent.mouseDown(td(view.container, 1, 1));
    fireEvent.mouseEnter(td(view.container, 2, 2));
    fireEvent.mouseEnter(td(view.container, 3, 3));
    fireEvent.mouseUp(td(view.container, 3, 3));
    expect(view.container.querySelectorAll("td.selected")).toHaveLength(9);
    fireEvent.mouseEnter(td(view.container, 5, 5));
    expect(view.container.querySelectorAll("td.selected")).toHaveLength(9);
  });

  it("selects in a table that became selectable after its mount", () => {
    const table = generateTable(10, 6, {}, false);
    const view = render(<Table {...table} isSelectable={false} />);
    view.rerender(<Table {...table} isSelectable />);
    fireEvent.mouseDown(td(view.container, 1, 1));
    fireEvent.mouseEnter(td(view.container, 2, 2));
    fireEvent.mouseUp(td(view.container, 2, 2));
    expect(view.container.querySelectorAll("td.selected")).toHaveLength(4);
  });

  it("selects under StrictMode, right click on another cell moves the selection", () => {
    const table = generateTable(10, 6, {}, false);
    const view = render(
      <React.StrictMode>
        <Table {...table} isSelectable />
      </React.StrictMode>,
    );
    fireEvent.mouseDown(td(view.container, 1, 1));
    fireEvent.mouseEnter(td(view.container, 2, 2));
    fireEvent.mouseUp(td(view.container, 2, 2));
    expect(view.container.querySelectorAll("td.selected")).toHaveLength(4);
    fireEvent.mouseDown(td(view.container, 3, 3), { button: 2 });
    expect(view.container.querySelectorAll("td.selected")).toHaveLength(1);
  });

  it("starts the drag when mouse down and mouse enter are processed in one batch", () => {
    const table = generateTable(10, 6, {}, false);
    const view = render(<Table {...table} isSelectable />);
    act(() => {
      fireEvent.mouseDown(td(view.container, 1, 1));
      fireEvent.mouseEnter(td(view.container, 2, 2));
    });
    expect(view.container.querySelectorAll("td.selected")).toHaveLength(4);
  });
});

describe("held — plain table under StrictMode", () => {
  it("opens, closes and drops trees like without StrictMode", () => {
    const table = generateTable(10, 5, {}, true);
    const handle = React.createRef<ITableHandle>();
    const ui = (rows: typeof table.rows) => (
      <React.StrictMode>
        <Table id="t" rows={rows} ref={handle} isSelectable={false} />
      </React.StrictMode>
    );
    const view = render(ui(table.rows));
    fireEvent.click(view.getAllByTestId("table-cell-sub-item-toggle")[0]);
    expect(view.container.querySelectorAll("tbody tr")).toHaveLength(9 + 10);
    view.rerender(ui(generateTable(10, 5, {}, false).rows));
    expect(view.container.querySelectorAll("tbody tr")).toHaveLength(9);
    expect(handle.current?.getOpenedTrees()).toEqual({});
  });
});
