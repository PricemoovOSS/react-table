/**
 * FINDING 7 — consequence, not written in the changelog nor in the migration guide, of the
 * documented change "the handle is given again to its ref when the columns change": the object
 * `useTableInteractionsManager().table` and every callback built on it (`goToColumnId`,
 * `goToColumnIndex`, `getCell`, `openTrees`, `closeTrees`, `onHorizontallyScroll`) get a new
 * identity each time a column is inserted, removed, moved or renamed. Effects and memos of the
 * application that depend on them run again.
 *
 * Cause: src/components/table/table.tsx:376-381 (new handle when `columnsIndexesIdsMapping`
 * changes) → src/hooks/useComponent.ts:11-13 (`setComponent({ current })`: a new object at
 * every call of the ref) → table-interactions-manager.tsx:135-162 (callbacks depend on `table`).
 *
 * In the consuming application, three panels do
 *   useEffect(() => { table.current.goToColumnId(firstColumnId) }, [selectedColumnsIds, table])
 * with 4.0.2 this ran when the selection changed; with 5.0 it also runs — and scrolls the
 * table back — whenever the columns change while the panel is open.
 *
 * Reference (4.0.2, executed with two columns swapped): no effect runs again.
 */
import * as React from "react";
import { render } from "@testing-library/react";

import Table from "../../../src/components/table/table";
import TableInteractionsManager, {
  useTableInteractionsManager,
} from "../../../src/components/table-interactions-manager/table-interactions-manager";
import { IRow } from "../../../src/components/table/row";
import { generateTable } from "../../../stories/utils/tables";

describe("FINDING 7 — identities given by the manager when the columns change", () => {
  it("effects keyed on `table` and on the manager callbacks do not run again (observed: each runs once more)", () => {
    const table = generateTable(10, 8, {}, false);
    const runs = { table: 0, goToColumnId: 0, getCell: 0, openTrees: 0 };
    const scrolls: string[] = [];
    const Panel = () => {
      const { table: tableObject, goToColumnId, getCell, openTrees } = useTableInteractionsManager();
      React.useEffect(() => {
        runs.table += 1;
        // what the panels of the application do
        if (tableObject?.current) scrolls.push("goToColumnId(first selected column)");
      }, [tableObject]);
      React.useEffect(() => {
        runs.goToColumnId += 1;
      }, [goToColumnId]);
      React.useEffect(() => {
        runs.getCell += 1;
      }, [getCell]);
      React.useEffect(() => {
        runs.openTrees += 1;
      }, [openTrees]);
      return null;
    };
    const Inner = ({ rows }: { rows: IRow[] }) => {
      const { tableRef } = useTableInteractionsManager();
      return <Table id="t" rows={rows} ref={tableRef} isSelectable={false} />;
    };
    const ui = (rows: IRow[]) => (
      <TableInteractionsManager>
        <Inner rows={rows} />
        <Panel />
      </TableInteractionsManager>
    );
    const view = render(ui(table.rows));
    const afterMount = { ...runs };
    const scrollsAfterMount = scrolls.length;

    const swapped = table.rows.map((row) => ({
      ...row,
      cells: [row.cells[0], row.cells[2], row.cells[1], ...row.cells.slice(3)],
    }));
    view.rerender(ui(swapped));

    expect(scrolls).toHaveLength(scrollsAfterMount);
    expect(runs).toEqual(afterMount);
  });
});
