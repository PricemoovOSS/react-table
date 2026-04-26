import * as React from "react";

import * as Utils from "../../../src/components/utils/table";
import ElementaryTable from "../../../src/components/table/elementary-table";
import { tableWithSubItems, subRows } from "../../../stories/utils/tables";
import { customRender, screen } from "../../tests-utils/react-testing-library-utils";

function makeRows() {
  return tableWithSubItems({
    firstSubRows: subRows({ subsubRows: subRows({}) }),
    secondSubRows: subRows({ subsubRows: subRows({}) }),
  });
}

describe("ElementaryTable", () => {
  it("renders a header and one row per non-header item", () => {
    const rows = makeRows();
    const indexesMapping = Utils.getAllIndexesMap({}, rows);
    customRender(<ElementaryTable id="foo" rows={rows} indexesMapping={indexesMapping} openedTrees={{}} />);

    expect(screen.getByTestId(`table-header-${rows[0].id}`)).toBeInTheDocument();
    expect(screen.getAllByTestId(/^table-row-/)).toHaveLength(rows.length - 1);
  });

  it("applies per-row size", () => {
    const rows = makeRows();
    rows[0].size = 24;
    rows[2].size = 150;
    const indexesMapping = Utils.getAllIndexesMap({}, rows);
    customRender(
      <ElementaryTable id="foo" rows={rows} indexesMapping={indexesMapping} openedTrees={{}} columns={{ 0: { size: 320 } }} />,
    );

    expect(screen.getByTestId(`table-header-${rows[0].id}`)).toHaveStyle({ height: "24px" });
    expect(screen.getByTestId(`table-row-${rows[2].id}`)).toHaveStyle({ height: "150px" });
  });

  it("only renders rows whose absolute index is in visibleRowIndexes", () => {
    const rows = makeRows();
    const openedTrees = { 1: { rowIndex: 1, columnIndex: 0 } };
    const indexesMapping = Utils.getAllIndexesMap(openedTrees, rows);

    customRender(
      <ElementaryTable
        id="foo"
        rows={rows}
        indexesMapping={indexesMapping}
        openedTrees={openedTrees}
        visibleRowIndexes={[0, 1, 2]}
        fixedRowsIndexes={[]}
      />,
    );

    // Last top-level row (absolute index 4) must not be in the DOM.
    expect(screen.queryByTestId(`table-row-${rows[2].id}`)).toBeNull();
    expect(screen.getByTestId(`table-row-${rows[1].id}`)).toBeInTheDocument();
  });
});
