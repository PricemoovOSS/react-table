import * as React from "react";
import { fireEvent } from "@testing-library/react";

import Table, { ITableHandle } from "../../../src/components/table/table";
import { simpleTable, tableWithSubItems, subRows, subMiam, generateTable } from "../../../stories/utils/tables";
import { customRender, screen, within } from "../../tests-utils/react-testing-library-utils";

const defaultProps = {
  id: "table-foo",
  rows: simpleTable({}),
};

describe("Table", () => {
  it("renders a flat table by default", () => {
    customRender(<Table {...defaultProps} isSelectable={false} />);
    expect(screen.getByTestId("table-header-front")).toBeInTheDocument();
    expect(screen.getAllByTestId(/^table-row-/)).toHaveLength(defaultProps.rows.length - 1);
  });

  it("renders sub-rows when a cell is opened", () => {
    const rows = subRows({ subsubRows: subMiam });
    customRender(<Table id="t" rows={rows} isSelectable={false} />);

    // Initially only top-level rows are visible.
    expect(screen.getAllByTestId(/^table-row-/)).toHaveLength(rows.length);

    // Find the first cell with sub-items in the first row and toggle it.
    const firstRow = screen.getByTestId(`table-row-${rows[0].id}`);
    const togglers = within(firstRow).getAllByTestId("table-cell-sub-item-toggle");
    fireEvent.click(togglers[0]);

    // Now sub-rows should be present.
    expect(screen.getAllByTestId(/^table-row-/).length).toBeGreaterThan(rows.length);
  });

  it("collapses sub-rows when re-toggling the open cell", () => {
    const rows = subRows({ subsubRows: subMiam });
    customRender(<Table id="t" rows={rows} isSelectable={false} />);

    const firstRow = () => screen.getByTestId(`table-row-${rows[0].id}`);
    const findToggle = () => within(firstRow()).getAllByTestId("table-cell-sub-item-toggle")[0];

    fireEvent.click(findToggle());
    const expanded = screen.getAllByTestId(/^table-row-/).length;

    fireEvent.click(findToggle());
    expect(screen.getAllByTestId(/^table-row-/).length).toBeLessThan(expanded);
  });

  it("clamps goToColumnIndex to the valid range and forwards to the virtualizer", () => {
    const props = generateTable(50, 50);
    const ref = React.createRef<ITableHandle>();
    customRender(<Table {...props} ref={ref} isVirtualized virtualizerProps={{ height: 300, width: 400 }} />);

    const container = screen.getByTestId("scroller-container");
    ref.current?.goToColumnIndex(25);
    const after25 = container.scrollLeft;
    expect(after25).toBeGreaterThan(0);

    ref.current?.goToColumnIndex(-1);
    expect(container.scrollLeft).toBeLessThan(after25);

    ref.current?.goToColumnIndex(9999);
    expect(container.scrollLeft).toBeGreaterThan(after25);
  });

  it("clamps goToRowIndex to the valid range", () => {
    const props = generateTable(50, 50);
    const ref = React.createRef<ITableHandle>();
    customRender(<Table {...props} ref={ref} isVirtualized virtualizerProps={{ height: 300, width: 400 }} />);

    const container = screen.getByTestId("scroller-container");
    ref.current?.goToRowIndex(25);
    const after25 = container.scrollTop;
    expect(after25).toBeGreaterThan(0);

    ref.current?.goToRowIndex(-1);
    expect(container.scrollTop).toBeLessThan(after25);

    ref.current?.goToRowIndex(9999);
    expect(container.scrollTop).toBeGreaterThan(after25);
  });

  it("resolves column ids via getColumnIndex / getColumnId", () => {
    const props = generateTable(50, 50);
    const ref = React.createRef<ITableHandle>();
    customRender(<Table {...props} ref={ref} isVirtualized virtualizerProps={{ height: 300, width: 400 }} />);

    expect(ref.current?.getColumnIndex("(0,25)-0")).toBe(25);
    expect(ref.current?.getColumnIndex("does-not-exist")).toBeUndefined();
    expect(ref.current?.getColumnId(0)).toBe("(0,0)-0");
  });

  it("notifies onOpenedTreesUpdate when the user toggles", () => {
    const onOpenedTreesUpdate = jest.fn();
    const rows = subRows({ subsubRows: subMiam });
    customRender(<Table id="t" rows={rows} isSelectable={false} onOpenedTreesUpdate={onOpenedTreesUpdate} />);

    const firstRow = screen.getByTestId(`table-row-${rows[0].id}`);
    fireEvent.click(within(firstRow).getAllByTestId("table-cell-sub-item-toggle")[0]);
    expect(onOpenedTreesUpdate).toHaveBeenCalledWith(expect.objectContaining({ 0: { rowIndex: 0, columnIndex: 2 } }));
  });

  it("renders inside a SelectionHandler when selectable (default)", () => {
    customRender(<Table id="t" rows={tableWithSubItems({ firstSubRows: subRows({}), secondSubRows: subRows({}) })} />);
    expect(document.querySelector(".selection-handler-container")).not.toBeNull();
  });
});
