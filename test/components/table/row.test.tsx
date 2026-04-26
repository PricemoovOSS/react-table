import * as React from "react";
import { fireEvent } from "@testing-library/react";

import Row from "../../../src/components/table/row";
import { subRows, subMiam, tableWithDifferentRowSizes } from "../../../stories/utils/tables";
import { ITree } from "../../../src/components/table/elementary-table";
import { customRender, screen, within } from "../../tests-utils/react-testing-library-utils";

const baseProps = {
  globalColumnProps: {},
  selectedCells: {},
  relativeSubIndexesMapping: {},
  getVisibleRows: ((rows: unknown[]) => [null, rows]) as never,
};

function renderRow(extra: Record<string, unknown>) {
  return customRender(
    <table>
      <tbody>
        <Row {...(baseProps as never)} {...(extra as never)} />
      </tbody>
    </table>,
  );
}

describe("Row", () => {
  it("renders a single row with the right testid", () => {
    const props = subRows({})[0];
    renderRow(props);
    expect(screen.getByTestId(`table-row-${props.id}`)).toBeInTheDocument();
  });

  it("renders one cell per cell descriptor", () => {
    const props = subRows({})[0];
    renderRow(props);
    const tr = screen.getByTestId(`table-row-${props.id}`);
    expect(within(tr).getAllByTestId("table-column")).toHaveLength(props.cells.length);
  });

  it("applies the row size to the row style", () => {
    const props = tableWithDifferentRowSizes[2];
    renderRow(props);
    expect(screen.getByTestId(`table-row-${props.id}`)).toHaveStyle({ height: `${props.size}px` });
  });

  it("renders a row-span column when isSpan is true and there are subItems", () => {
    const props = subRows({ subsubRows: subMiam })[0];
    renderRow({ ...props, isSpan: true, rowSpanProps: { title: "foo", color: "gray" } });
    expect(screen.getByTestId("table-toggle-row-btn")).toBeInTheDocument();
  });

  it("calls onOpen when toggling a cell with subItems", () => {
    const onOpen = jest.fn();
    const onClose = jest.fn();
    const row = subRows({ subsubRows: subMiam })[0];
    renderRow({ ...row, index: 0, onOpen, onClose });

    // The 3rd cell (index 2) is the one with subItems in the fixture.
    const togglers = screen.getAllByTestId("table-cell-sub-item-toggle");
    expect(togglers).toHaveLength(1);
    fireEvent.click(togglers[0]);
    expect(onOpen).toHaveBeenCalledWith({ rowIndex: 0, columnIndex: 2 });
  });

  it("calls onClose when toggling the currently opened cell", () => {
    const onOpen = jest.fn();
    const onClose = jest.fn();
    const row = subRows({ subsubRows: subMiam })[0];
    renderRow({ ...row, index: 0, onOpen, onClose, openedTree: { rowIndex: 0, columnIndex: 2 } });

    fireEvent.click(screen.getAllByTestId("table-cell-sub-item-toggle")[0]);
    expect(onClose).toHaveBeenCalledWith({ rowIndex: 0, columnIndex: 2 });
  });

  it("propagates sub-row open events by merging into the parent tree", () => {
    const onOpen = jest.fn();
    const row = subRows({ subsubRows: subMiam })[0];
    // Make the 3rd sub-cell openable so a nested toggle exists.
    (row.cells[2].subItems as unknown as Array<{ cells: Array<{ subItems?: unknown }> }>)[0].cells[2].subItems = subMiam;

    const openedTree: ITree = { rowIndex: 0, columnIndex: 2 };
    renderRow({ ...row, index: 0, onOpen, openedTree });

    // Find the inner toggler inside the rendered sub-row.
    const innerToggler = screen.getAllByTestId("table-cell-sub-item-toggle").pop();
    expect(innerToggler).toBeDefined();
    fireEvent.click(innerToggler!);

    expect(onOpen).toHaveBeenCalledWith({
      rowIndex: 0,
      columnIndex: 2,
      subTrees: { 0: { rowIndex: 0, columnIndex: 2 } },
    });
  });
});
