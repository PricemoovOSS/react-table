import * as React from "react";
import { act, fireEvent, render } from "@testing-library/react";

import Table, { ITableProps } from "../../src/components/table/table";
import * as tableUtils from "../../src/components/utils/table";
import { generateTable } from "../../stories/utils/tables";

/**
 * Rendering budget of a virtualized table: how much work one interaction is allowed to cost.
 * `computeRowStyle` is called once each time a row renders, `getClassName` once per cell
 * render, `computeCellStyle` once per column layout (shared by the cells of the column), and
 * the two cache builders once per virtualization cache rebuild.
 */
const WINDOW_ROWS = 12;
const ROW_CELLS = 10;
const WINDOW_CELLS = WINDOW_ROWS * ROW_CELLS;

let cellRenders = 0;
const countCellRender = () => {
  cellRenders += 1;
  return "";
};

const COLUMNS = 60;

function buildTable() {
  const table = generateTable(200, COLUMNS, {}, false);
  table.rows.forEach((row) =>
    row.cells.forEach((cell) => {
      (cell as { getClassName?: () => string }).getClassName = countCellRender;
    }),
  );
  return table;
}

const NOTHING = { cellRenders: 0, rowRenders: 0, columnLayouts: 0, cacheBuilds: 0 };

let forceParentRender: () => void = () => undefined;

interface IHarnessProps {
  table: ReturnType<typeof buildTable>;
  isSelectable: boolean;
  columns?: ITableProps["columns"];
  fixedColumns?: number[];
}

function Harness({ table, isSelectable, columns, fixedColumns = [0] }: IHarnessProps) {
  const [, setTick] = React.useState(0);
  forceParentRender = () => setTick((tick) => tick + 1);
  return (
    <Table
      {...table}
      isSelectable={isSelectable}
      isVirtualized
      columns={columns}
      // Inline object and arrays on purpose: this is how applications usually pass them.
      virtualizerProps={{ fixedRows: [0], fixedColumns, minRowHeight: 40, height: 500, width: 1000 }}
    />
  );
}

describe("virtualized table rendering budget", () => {
  const rowRenders = jest.spyOn(tableUtils, "computeRowStyle");
  const columnLayouts = jest.spyOn(tableUtils, "computeCellStyle");
  const cacheBuilds = jest.spyOn(tableUtils, "getVirtualizerCache");
  const scrollMappings = jest.spyOn(tableUtils, "getIndexScrollMapping");

  const measure = (action: () => void) => {
    cellRenders = 0;
    [rowRenders, columnLayouts, cacheBuilds, scrollMappings].forEach((spy) => spy.mockClear());
    act(action);
    return {
      cellRenders,
      rowRenders: rowRenders.mock.calls.length,
      columnLayouts: columnLayouts.mock.calls.length,
      cacheBuilds: cacheBuilds.mock.calls.length + scrollMappings.mock.calls.length,
    };
  };

  const mount = (isSelectable = false, props: Partial<IHarnessProps> = {}) => {
    let container: HTMLElement = document.body;
    const mounted = measure(() => {
      container = render(<Harness table={buildTable()} isSelectable={isSelectable} {...props} />).container;
    });
    const scroller = container.querySelector("[data-testid='scroller-container']") as HTMLElement;
    return { container, scroller, mounted };
  };

  it("renders the visible window once on mount", () => {
    const { mounted } = mount();
    expect(mounted.cellRenders).toBe(WINDOW_CELLS);
    expect(mounted.rowRenders).toBe(WINDOW_ROWS);
    // no column has options of its own: one layout serves the whole window
    expect(mounted.columnLayouts).toBe(1);
  });

  it("renders nothing when the parent re-renders with the same data", () => {
    mount();
    expect(measure(() => forceParentRender())).toEqual(NOTHING);
  });

  it("renders only the entering row on a vertical scroll, without rebuilding the cache", () => {
    const { scroller } = mount();
    const first = measure(() => fireEvent.scroll(scroller, { target: { scrollTop: 45 } }));
    expect(first).toEqual({ ...NOTHING, cellRenders: ROW_CELLS, rowRenders: 1 });
    const second = measure(() => fireEvent.scroll(scroller, { target: { scrollTop: 90 } }));
    expect(second).toEqual({ ...NOTHING, cellRenders: ROW_CELLS, rowRenders: 1 });
  });

  it("renders only the entering column cells on a horizontal scroll, without rebuilding the cache", () => {
    const { scroller } = mount();
    const result = measure(() => fireEvent.scroll(scroller, { target: { scrollLeft: 105 } }));
    // every row has to re-render (its columns changed) but only one cell per row is new
    expect(result).toEqual({ ...NOTHING, cellRenders: WINDOW_ROWS, rowRenders: WINDOW_ROWS });
  });

  it("renders nothing while the scroll stays inside the same window", () => {
    const { scroller } = mount();
    act(() => {
      fireEvent.scroll(scroller, { target: { scrollLeft: 210 } });
    });
    expect(measure(() => fireEvent.scroll(scroller, { target: { scrollLeft: 212 } }))).toEqual(NOTHING);
  });

  it("computes the layout of a column once for all its cells, and only for a column that enters", () => {
    // every column has options of its own, and two of them are fixed at the end
    const columns = Object.fromEntries(Array.from({ length: COLUMNS }, (_, index) => [index, { className: `c${index}` }]));
    const { container, scroller, mounted } = mount(false, { columns, fixedColumns: [0, COLUMNS - 2, COLUMNS - 1] });
    const visibleColumns = container.querySelectorAll("tr.head th").length;

    const headerColumns = Array.from(container.querySelectorAll("tr.head th")).map((cell) => cell.getAttribute("aria-colindex"));
    expect(headerColumns.slice(-2)).toEqual([String(COLUMNS - 1), String(COLUMNS)]);
    expect(mounted).toMatchObject({ rowRenders: WINDOW_ROWS, columnLayouts: visibleColumns });

    const vertical = measure(() => fireEvent.scroll(scroller, { target: { scrollTop: 45 } }));
    expect(vertical).toMatchObject({ rowRenders: 1, columnLayouts: 0 });
    const horizontal = measure(() => fireEvent.scroll(scroller, { target: { scrollLeft: 105 } }));
    expect(horizontal).toMatchObject({ rowRenders: WINDOW_ROWS, columnLayouts: 1 });
    expect(measure(() => forceParentRender())).toEqual(NOTHING);
  });

  it("renders one cell and one row when a cell gets selected", () => {
    const { container } = mount(true);
    const cell = container.querySelectorAll("tbody [data-testid='table-column']")[1] as HTMLElement;
    const result = measure(() => fireEvent.mouseDown(cell));
    expect(result).toEqual({ ...NOTHING, cellRenders: 1, rowRenders: 1 });
  });
});
