import * as React from "react";
import { IRow } from "../../src";
import Table from "../../src/components/table/table";
import { boolean } from "@storybook/addon-knobs";
import { generateRow, generateTable } from "../utils/tables";
import { Button } from "@mui/material";

function generateTableWithSubRowSize(size: number) {
  const table = generateTable(size, 100, {}, true);
  const lastRow: IRow = table.rows[size - 1];
  lastRow.cells[0].subItems = [generateRow(1, 100, false, 2, undefined, size), generateRow(2, 100, false, 2, undefined, size)];
  return table;
}

export const TableWithDynamicSubColumns = () => {
  const [table, setTable] = React.useState(() => generateTableWithSubRowSize(200));

  const to100RowsSize = () => {
    setTable(generateTableWithSubRowSize(100));
  };

  const to200Rows = () => {
    setTable(generateTableWithSubRowSize(200));
  };

  return (
    <React.Fragment>
      <Button color="primary" disabled={table.rows.length === 100} onClick={to100RowsSize}>
        Switch to 100 subrows
      </Button>
      <Button color="primary" disabled={table.rows.length === 200} onClick={to200Rows}>
        Switch to 200 subrows
      </Button>
      <div style={{ height: "90vh", width: "100%" }}>
        <Table
          id="table-foo"
          rows={table.rows}
          globalColumnProps={{ style: { justifyContent: "left" } }}
          columns={{ 0: { size: 180 } }}
          isVirtualized
          isSpan={boolean("isSpan", false)}
          virtualizerProps={{
            rowsCount: 10,
            columnsCount: 10,
          }}
        />
      </div>
    </React.Fragment>
  );
};
