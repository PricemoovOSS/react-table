/**
 * FINDING 2 — the methods of the table handle (`getCell`, and with it `getColumnId`,
 * `getColumnIndex`, `goToRowIndex` bounds) answer with the rows of the PREVIOUS commit when
 * they are called while React renders the new rows.
 *
 * Cause: src/components/table/table.tsx:373 — the handle reads `snapshot.current`, a
 * `useLatest` ref (src/hooks/useLatest.ts:6) that is only written in a layout effect, i.e.
 * after every descendant of the table has rendered. A `menuComponent`, a `cellContent` or any
 * component rendered under the table that reads a cell through the handle (directly, through
 * `useTableInteractionsManager().getCell`, or with the exported `getSelectedCellsProps`)
 * renders the old value, and nothing renders it again afterwards.
 *
 * Correct result: the value of the rows being rendered. 4.0.2 is correct: `getCell` read
 * `this.props.rows`, which React updates before the children render.
 */
import * as React from "react";
import { fireEvent, render } from "@testing-library/react";

import Table, { ITableHandle } from "../../../src/components/table/table";
import TableInteractionsManager, {
  useTableInteractionsManager,
} from "../../../src/components/table-interactions-manager/table-interactions-manager";
import { getSelectedCellsProps } from "../../../src/components/utils/table-selection";
import { IRow } from "../../../src/components/table/row";
import { generateTable } from "../../../stories/utils/tables";

const withValue = (rows: IRow[], rowIndex: number, cellIndex: number, value: string): IRow[] =>
  rows.map((row, index) =>
    index === rowIndex ? { ...row, cells: row.cells.map((cell, i) => (i === cellIndex ? { ...cell, value } : cell)) } : row,
  );

describe("FINDING 2 — handle read while the new rows render", () => {
  it("a selection menu shows the value of the selected cell after it was edited (observed: the old value)", () => {
    const table = generateTable(6, 4, {}, false);
    const tableRef = React.createRef<ITableHandle>();
    const Menu = ({ selectedCells }: { selectedCells: Record<string, number[]> }) => {
      const cells = tableRef.current ? getSelectedCellsProps(selectedCells, tableRef.current.getCell) : [];
      return <div data-testid="menu">{cells.map((cell) => cell.value).join("|")}</div>;
    };
    const selectionProps = { menuComponent: Menu };
    const ui = (rows: IRow[]) => <Table id="t" rows={rows} ref={tableRef} selectionProps={selectionProps} />;

    const view = render(ui(table.rows));
    const cell = view.container.querySelectorAll("tbody tr")[0].querySelectorAll("td")[1];
    fireEvent.mouseDown(cell);
    fireEvent.mouseUp(cell);
    expect(view.getByTestId("menu").textContent).toBe("(1,1)");

    view.rerender(ui(withValue(table.rows, 1, 1, "EDITED")));
    // the cell itself is up to date
    expect(cell.textContent).toBe("EDITED");
    expect(view.getByTestId("menu").textContent).toBe("EDITED");
  });

  it("a cell content reads another cell through the manager (observed: the old value)", () => {
    const table = generateTable(6, 4, {}, false);
    const Mirror = ({ rowIndex }: { rowIndex: number }) => {
      const { getCell } = useTableInteractionsManager();
      return <span data-testid="mirror">{getCell({ rowIndex, cellIndex: 1 })?.value}</span>;
    };
    // the mirror cell changes too (new props): it does render again, with the stale answer
    const build = (rows: IRow[], revision: number): IRow[] =>
      rows.map((row, index) =>
        index === 1
          ? {
              ...row,
              cells: row.cells.map((cell, i) =>
                i === 3 ? { ...cell, cellContent: Mirror, cellContentProps: { revision } } : cell,
              ),
            }
          : row,
      );
    const Inner = ({ rows }: { rows: IRow[] }) => {
      const { tableRef } = useTableInteractionsManager();
      return <Table id="t" rows={rows} ref={tableRef} isSelectable={false} />;
    };
    const ui = (rows: IRow[]) => (
      <TableInteractionsManager>
        <Inner rows={rows} />
      </TableInteractionsManager>
    );

    const view = render(ui(build(table.rows, 0)));
    view.rerender(ui(build(withValue(table.rows, 1, 1, "EDITED"), 1)));
    expect(view.getByTestId("mirror").textContent).toBe("EDITED");
  });
});
