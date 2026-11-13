import { act, fireEvent, render } from "@testing-library/react";

import {
  ITableInteractionsManagerProps,
  useTableInteractionsManager,
} from "../../src/components/table-interactions-manager/table-interactions-manager";
import Table, { ITableHandle, ITableProps } from "../../src/components/table/table";
import * as tableUtils from "../../src/components/utils/table";
import { generateTable } from "../../stories/utils/tables";
import { renderStats, resetRenderStats } from "../../stories/stories-components/heavy-cells";
import {
  ILiveDataApi,
  ILiveDataProps,
  ILiveRow,
  LiveDataPage,
  LiveOperation,
  NAME_COLUMN,
  TOTAL_COLUMN,
} from "../../stories/stories-components/live-data";

/**
 * Rows and columns inserted, removed and updated while the table is displayed, the way an
 * application does it: new `rows` and `columns`, the unchanged rows and cells being the same
 * objects as before. Each change must leave a table that shows the data, keep the scroll,
 * and render what changed only.
 */
const WIDTH = 1000;
const HEIGHT = 500;
const MIDDLE = { scrollTop: 2000, scrollLeft: 1100 };

const manager: { current: ITableInteractionsManagerProps | null } = { current: null };
function ManagerProbe() {
  manager.current = useTableInteractionsManager();
  return null;
}

const isIncreasing = (values: number[]) => values.every((value, index) => index === 0 || value > values[index - 1]);

function mount(props: ILiveDataProps = {}) {
  const rowRenders = jest.spyOn(tableUtils, "computeRowStyle");
  const cacheBuilds = jest.spyOn(tableUtils, "getVirtualizerCache");
  const indexesMaps = jest.spyOn(tableUtils, "getAllIndexesMap");
  const errors = jest.spyOn(console, "error");

  let api = null as unknown as ILiveDataApi;
  const view = render(
    <LiveDataPage
      rows={200}
      columns={30}
      withGroups={false}
      width={WIDTH}
      height={HEIGHT}
      {...props}
      onReady={(ready) => (api = ready)}
    >
      <ManagerProbe />
    </LiveDataPage>,
  );
  const { container } = view;
  const scroller = container.querySelector("[data-testid='scroller-container']") as HTMLElement;
  const spacer = () => container.querySelector(".scroller-scrollbar") as HTMLElement;

  const headerCells = () => Array.from(container.querySelectorAll<HTMLElement>("tr.head:not(.table-groups-row) th"));
  const columnIndexes = () => headerCells().map((cell) => Number(cell.getAttribute("aria-colindex")) - 1);
  const shownColumns = () => columnIndexes().map((index) => api.getData().columns[index]?.id);
  const bodyRows = () => Array.from(container.querySelectorAll<HTMLElement>("tbody tr"));
  // a sub row carries the id of its parent before its own
  const idOf = (row: Element) => (row.getAttribute("data-testid") || "").replace("table-row-", "").split("-").pop() as string;
  const shownRows = () => bodyRows().map(idOf);
  const rowOf = (id: string) => bodyRows().find((row) => idOf(row) === id);
  const contentOf = (cell: Element) => cell.querySelector("[data-testid='live-cell'], [data-testid='live-name']")?.textContent;

  const scroll = (target: { scrollTop?: number; scrollLeft?: number }) => act(() => void fireEvent.scroll(scroller, { target }));

  /** What an action renders and computes. Without groups, `rows` counts the rows of the table only. */
  const measure = (action: () => void) => {
    resetRenderStats();
    [rowRenders, cacheBuilds, indexesMaps].forEach((spy) => spy.mockClear());
    act(action);
    return {
      cells: renderStats.renders,
      mounted: renderStats.mounts,
      rows: rowRenders.mock.calls.length,
      cacheBuilds: cacheBuilds.mock.calls.length,
      indexesMaps: indexesMaps.mock.calls.length,
    };
  };
  const apply = (...operations: LiveOperation[]) => measure(() => api.apply(...operations));

  const initial = { rows: bodyRows().length, columns: headerCells().length };

  /** The table shows the data: right rows, right columns, right values, a full window, no error. */
  const expectConsistent = () => {
    const data = api.getData();
    const columns = columnIndexes();
    expect(isIncreasing(columns)).toBe(true);
    expect(columns.every((index) => index >= 0 && index < data.columns.length)).toBe(true);
    expect(headerCells().map((cell) => cell.textContent)).toEqual(columns.map((index) => data.columns[index].label));

    const everyRow = new Map<string, ILiveRow>();
    data.rows.forEach((row) => [row, ...(row.children ?? [])].forEach((item) => everyRow.set(item.id, item)));
    const placeOf = new Map(data.rows.map((row, index) => [row.id, index]));

    bodyRows().forEach((row) => {
      const id = idOf(row);
      const model = everyRow.get(id) as ILiveRow;
      expect({ id, known: !!model }).toEqual({ id, known: true });
      const cells = Array.from(row.children);
      expect({ id, columns: cells.map((cell) => Number(cell.getAttribute("aria-colindex")) - 1) }).toEqual({ id, columns });
      const expected = columns.map((index) => {
        const column = data.columns[index];
        return column.id === NAME_COLUMN ? model.label : String(model.values[column.id]);
      });
      expect({ id, values: cells.map(contentOf) }).toEqual({ id, values: expected });
    });

    // the rows of the data come in their order, without a gap
    const places = shownRows().flatMap((id) => (placeOf.has(id) ? [placeOf.get(id) as number] : []));
    expect(places.every((place, index) => index === 0 || place === places[index - 1] + 1)).toBe(true);
    // a row of the body carries its place in the whole table: the header is the first row
    const firstRow = bodyRows()[0];
    if (firstRow && Object.keys(api.getHandle()?.getOpenedTrees() ?? {}).length === 0) {
      expect(Number(firstRow.getAttribute("aria-rowindex")) - 2).toBe(places[0]);
      expect(bodyRows().length).toBe(Math.min(initial.rows, data.rows.length));
    }

    // the column pinned by id is the last one, out of the flow, as long as a column scrolls beside it
    const pinned = headerCells().filter((cell) => cell.classList.contains("elevated-absolute"));
    const shown = columns.map((index) => data.columns[index].id);
    const hasScrollingColumn = shown.some((id) => id !== NAME_COLUMN && id !== TOTAL_COLUMN);
    const isPinned = shown.includes(TOTAL_COLUMN) && hasScrollingColumn;
    expect(pinned.map((cell) => data.columns[Number(cell.getAttribute("aria-colindex")) - 1].id)).toEqual(
      isPinned ? [TOTAL_COLUMN] : [],
    );
    if (data.columns.some((column) => column.id === TOTAL_COLUMN)) expect(shown[shown.length - 1]).toBe(TOTAL_COLUMN);

    expect(errors.mock.calls.map((call) => String(call[0]).slice(0, 200))).toEqual([]);
  };

  return {
    ...view,
    api: () => api,
    scroller,
    spacer,
    scroll,
    measure,
    apply,
    initial,
    headerCells,
    shownColumns,
    shownRows,
    bodyRows,
    rowOf,
    expectConsistent,
  };
}

const NOTHING = { cells: 0, mounted: 0, rows: 0, cacheBuilds: 0, indexesMaps: 0 };
/** One rebuild of the virtualization cache: both axes, the vertical one twice (scroll bars depend on each other). */
const ONE_CACHE = 3;
const pixels = (value: string) => Number(value.replace("px", ""));

afterEach(() => jest.restoreAllMocks());

describe("rows inserted, removed and updated while the table is displayed", () => {
  it("inserts a row above the window: the scroll is kept, the window shows the rows that moved in", () => {
    const view = mount();
    view.scroll(MIDDLE);
    const before = view.shownRows();
    const windowCells = view.initial.rows * view.initial.columns;

    const cost = view.apply({ type: "insertRows", index: 3 });

    // the same indexes are displayed: every row of the window is the one that was above it
    expect(view.shownRows().slice(1)).toEqual(before.slice(0, -1));
    expect(view.scroller.scrollTop).toBe(MIDDLE.scrollTop);
    expect(view.scroller.scrollLeft).toBe(MIDDLE.scrollLeft);
    // every cell renders once (its row index changed), one row is new, the index maps are built once
    expect(cost).toEqual({ ...cost, cells: windowCells, mounted: view.initial.columns, cacheBuilds: ONE_CACHE, indexesMaps: 1 });
    view.expectConsistent();
  });

  it("inserts a row under the window: nothing is rendered, the scroll range grows", () => {
    const view = mount();
    view.scroll(MIDDLE);
    const rowHeight = pixels(view.bodyRows()[0].style.height);
    const range = pixels(view.spacer().style.minHeight);

    const cost = view.apply({ type: "insertRows", index: 150 });

    expect(cost).toEqual({ ...NOTHING, cacheBuilds: ONE_CACHE, indexesMaps: 1 });
    expect(pixels(view.spacer().style.minHeight)).toBe(range + rowHeight);
    view.expectConsistent();
  });

  it("inserts a row in the window: the rows above it are not rendered", () => {
    const view = mount();
    view.scroll(MIDDLE);
    const [, , third] = view.shownRows();
    const place = view
      .api()
      .getData()
      .rows.findIndex((row) => row.id === third);

    const cost = view.apply({ type: "insertRows", index: place });

    const rowsFromThePlace = view.initial.rows - 2;
    expect(cost).toMatchObject({
      cells: rowsFromThePlace * view.initial.columns,
      mounted: view.initial.columns,
      rows: rowsFromThePlace,
    });
    expect(view.shownRows()[2]).toBe(`r${view.api().getData().nextRow - 1}`);
    view.expectConsistent();
  });

  it("inserts a hundred rows at once, above then under the window", () => {
    const view = mount();
    view.scroll(MIDDLE);
    const before = view.shownRows();

    view.apply({ type: "insertRows", index: 0, count: 100 });
    expect(view.api().getData().rows).toHaveLength(300);
    expect(view.shownRows()).not.toEqual(before);
    view.expectConsistent();

    const shown = view.shownRows();
    expect(view.apply({ type: "insertRows", index: 300, count: 100 })).toMatchObject({ cells: 0, rows: 0 });
    expect(view.shownRows()).toEqual(shown);
    view.expectConsistent();
  });

  it("removes rows above, in and under the window", () => {
    const view = mount();
    view.scroll(MIDDLE);
    const before = view.shownRows();

    view.apply({ type: "removeRows", index: 3 });
    expect(view.shownRows().slice(0, -1)).toEqual(before.slice(1));
    view.expectConsistent();

    const [first, second] = view.shownRows();
    const place = view
      .api()
      .getData()
      .rows.findIndex((row) => row.id === second);
    view.apply({ type: "removeRows", index: place });
    expect(view.shownRows().slice(0, 2)).toEqual([first, before[3]]);
    view.expectConsistent();

    const shown = view.shownRows();
    expect(view.apply({ type: "removeRows", index: 150, count: 20 })).toMatchObject({ cells: 0, rows: 0 });
    expect(view.shownRows()).toEqual(shown);
    expect(view.scroller.scrollTop).toBe(MIDDLE.scrollTop);
    view.expectConsistent();
  });

  it("removes the rows the window shows, at the end: the window follows the new end", () => {
    const view = mount();
    view.scroll({ scrollTop: 999999 });
    expect(view.shownRows().slice(-1)).toEqual(["r200"]);

    view.apply({ type: "removeRows", index: 170, count: 30 });

    const rows = view.api().getData().rows;
    expect(view.shownRows()).toEqual(rows.slice(-view.initial.rows).map((row) => row.id));
    view.expectConsistent();
  });

  it("removes every row, then inserts rows again", () => {
    const view = mount();
    view.scroll(MIDDLE);

    view.apply({ type: "removeRows", index: 0, count: 200 });
    expect(view.shownRows()).toEqual([]);
    expect(view.headerCells()).toHaveLength(view.initial.columns);
    view.expectConsistent();

    view.apply({ type: "insertRows", index: 0, count: 3 });
    expect(view.shownRows()).toEqual(["r201", "r202", "r203"]);
    view.expectConsistent();
  });

  it("updates a value: its cell renders, no other, and nothing is computed over the rows", () => {
    const view = mount();
    view.scroll(MIDDLE);
    const [, , third] = view.shownRows();
    const place = view
      .api()
      .getData()
      .rows.findIndex((row) => row.id === third);
    const columnId = view.shownColumns()[2] as string;
    const cell = () => view.rowOf(third)?.querySelector(`[data-column-id='${columnId}']`)?.textContent;
    const value = Number(cell());

    const cost = view.apply({ type: "updateCell", index: place, columnId });

    expect(cell()).toBe(String(value + 1));
    expect(cost).toEqual({ ...NOTHING, cells: 1, rows: 1 });
    view.expectConsistent();
  });

  it("updates a row: its cells render, no other", () => {
    const view = mount();
    view.scroll(MIDDLE);
    const [, , third] = view.shownRows();
    const place = view
      .api()
      .getData()
      .rows.findIndex((row) => row.id === third);

    const cost = view.apply({ type: "updateRow", index: place });

    // every cell of the row but its name
    expect(cost).toEqual({ ...NOTHING, cells: view.initial.columns - 1, rows: 1 });
    view.expectConsistent();
  });

  it("updates a row out of the window: nothing renders", () => {
    const view = mount();
    view.scroll(MIDDLE);

    expect(view.apply({ type: "updateRow", index: 5 })).toEqual(NOTHING);
    expect(view.apply({ type: "updateCell", index: 190, columnId: "c3" })).toEqual(NOTHING);
    view.expectConsistent();
  });

  it("keeps the state of a cell with its row when rows are inserted or removed above it", () => {
    const view = mount();
    view.scroll(MIDDLE);
    const [, , third] = view.shownRows();
    const box = () => view.rowOf(third)?.querySelector<HTMLInputElement>("input[type='checkbox']");
    const checked = () =>
      view
        .bodyRows()
        .filter((row) => row.querySelector<HTMLInputElement>("input[type='checkbox']")?.checked)
        .map((row) => row.getAttribute("data-testid"));

    fireEvent.click(box() as HTMLInputElement);
    expect(checked()).toEqual([`table-row-${third}`]);

    view.apply({ type: "insertRows", index: 3, count: 2 });
    expect(checked()).toEqual([`table-row-${third}`]);
    view.apply({ type: "removeRows", index: 0 });
    expect(checked()).toEqual([`table-row-${third}`]);
    view.apply({
      type: "updateRow",
      index: view
        .api()
        .getData()
        .rows.findIndex((row) => row.id === third),
    });
    expect(checked()).toEqual([`table-row-${third}`]);
    view.expectConsistent();
  });

  it("keeps an opened row opened when the application moves its tree with the rows", () => {
    const view = mount({ subRowsEvery: 5 });
    view.scroll(MIDDLE);
    // "r50" has sub rows and stands in the window; it is the 50th row under the header
    expect(view.shownRows()).toContain("r50");
    act(() =>
      view
        .api()
        .getHandle()
        ?.openTrees({ 50: { rowIndex: 50, columnIndex: 0 } }),
    );
    const underOpenedRow = () => {
      const shown = view.shownRows();
      return shown.slice(shown.indexOf("r50") + 1, shown.indexOf("r50") + 3);
    };
    expect(underOpenedRow()).toEqual(["r50.1", "r50.2"]);

    view.apply({ type: "insertRows", index: 3, count: 2 });
    expect(view.api().getHandle()?.getOpenedTrees()).toEqual({ 52: { rowIndex: 52, columnIndex: 0 } });
    expect(underOpenedRow()).toEqual(["r50.1", "r50.2"]);
    view.expectConsistent();

    view.apply({ type: "removeRows", index: 0, count: 3 });
    expect(view.api().getHandle()?.getOpenedTrees()).toEqual({ 49: { rowIndex: 49, columnIndex: 0 } });
    expect(underOpenedRow()).toEqual(["r50.1", "r50.2"]);
    view.expectConsistent();

    // the opened row itself is removed: its tree goes with it
    view.apply({
      type: "removeRows",
      index: view
        .api()
        .getData()
        .rows.findIndex((row) => row.id === "r50"),
    });
    expect(view.api().getHandle()?.getOpenedTrees()).toEqual({});
    expect(view.shownRows().some((id) => id.startsWith("r50"))).toBe(false);
    view.expectConsistent();
  });

  it("updates the sub rows of an opened row", () => {
    const view = mount({ subRowsEvery: 5 });
    act(() =>
      view
        .api()
        .getHandle()
        ?.openTrees({ 5: { rowIndex: 5, columnIndex: 0 } }),
    );
    expect(view.shownRows().slice(4, 7)).toEqual(["r5", "r5.1", "r5.2"]);

    // a column updated: the sub rows show the new values too
    view.apply({ type: "updateColumn", columnId: "c2" });
    view.expectConsistent();
    expect(view.shownRows().slice(4, 7)).toEqual(["r5", "r5.1", "r5.2"]);
  });
});

describe("columns inserted, removed and updated while the table is displayed", () => {
  it("inserts a column before the window: the scroll is kept, the pinned column stays the same column", () => {
    const view = mount();
    view.scroll(MIDDLE);
    const before = view.shownColumns();
    const range = pixels(view.spacer().style.minWidth);

    const cost = view.apply({ type: "insertColumns", index: 2 });

    const shown = view.shownColumns();
    // the same indexes are displayed: every scrolling column is the one that was before it
    expect(shown.slice(2, -1)).toEqual(before.slice(1, -2));
    expect([shown[0], shown[shown.length - 1]]).toEqual([NAME_COLUMN, TOTAL_COLUMN]);
    expect(view.scroller.scrollLeft).toBe(MIDDLE.scrollLeft);
    expect(pixels(view.spacer().style.minWidth)).toBeGreaterThan(range);
    expect(manager.current?.fixedColumnsIndexes).toEqual([view.api().getData().columns.length - 1]);
    // every cell renders once; the pinned index is resolved again in a second pass that mounts two columns
    const windowCells = view.initial.rows * view.initial.columns;
    expect(cost.cells).toBeLessThanOrEqual(windowCells + 2 * view.initial.rows);
    view.expectConsistent();
  });

  it("inserts a column after the window: the cells of the window are not rendered", () => {
    const view = mount();
    view.scroll(MIDDLE);
    const before = view.shownColumns();

    const cost = view.apply({ type: "insertColumns", index: 25 });

    expect(view.shownColumns()).toEqual(before);
    // only the pinned column moved: its cells, and those of the column wrongly pinned for one pass
    expect(cost.cells).toBeLessThanOrEqual(2 * view.initial.rows);
    view.expectConsistent();
  });

  it("removes a column before the window, in the window and after it", () => {
    const view = mount();
    view.scroll(MIDDLE);
    const before = view.shownColumns();

    view.apply({ type: "removeColumns", index: 2 });
    expect(view.shownColumns().slice(1, -2)).toEqual(before.slice(2, -1));
    view.expectConsistent();

    const third = view.shownColumns()[2] as string;
    view.apply({
      type: "removeColumns",
      index: view
        .api()
        .getData()
        .columns.findIndex((column) => column.id === third),
    });
    expect(view.shownColumns()).not.toContain(third);
    view.expectConsistent();

    const shown = view.shownColumns();
    view.apply({ type: "removeColumns", index: 24, count: 2 });
    expect(view.shownColumns()).toEqual(shown);
    expect(view.scroller.scrollLeft).toBe(MIDDLE.scrollLeft);
    view.expectConsistent();
  });

  it("removes the columns the window shows, at the end: the window follows the new end", () => {
    const view = mount();
    view.scroll({ scrollLeft: 999999 });
    const last = () => view.shownColumns().slice(-2);
    expect(last()).toEqual(["c28", TOTAL_COLUMN]);

    view.apply({ type: "removeColumns", index: 19, count: 10 });

    expect(last()).toEqual(["c18", TOTAL_COLUMN]);
    expect(view.headerCells()).toHaveLength(view.initial.columns);
    view.expectConsistent();
  });

  it("removes the pinned column: no column is pinned any more", () => {
    const view = mount();
    view.scroll(MIDDLE);

    view.apply({ type: "removeColumns", index: 29 });

    expect(
      view
        .api()
        .getData()
        .columns.map((column) => column.id),
    ).not.toContain(TOTAL_COLUMN);
    expect(manager.current?.fixedColumnsIndexes).toEqual([]);
    expect(view.container.querySelector(".elevated-absolute")).toBeNull();
    view.expectConsistent();
  });

  it("removes every column but the name, then inserts columns again", () => {
    const view = mount();
    view.scroll(MIDDLE);

    view.apply({ type: "removeColumns", index: 1, count: 29 });
    expect(view.shownColumns()).toEqual([NAME_COLUMN]);
    view.expectConsistent();

    view.apply({ type: "insertColumns", index: 1, count: 4 });
    expect(view.shownColumns()).toEqual([NAME_COLUMN, "c29", "c30", "c31", "c32"]);
    view.expectConsistent();
  });

  it("updates a column: one cell per row renders", () => {
    const view = mount();
    view.scroll(MIDDLE);
    const columnId = view.shownColumns()[3] as string;

    const cost = view.apply({ type: "updateColumn", columnId });

    expect(cost).toEqual({ ...NOTHING, cells: view.initial.rows, rows: view.initial.rows });
    view.expectConsistent();

    // a column out of the window: the rows get new cells, none of them is displayed
    expect(view.apply({ type: "updateColumn", columnId: "c1" })).toEqual({ ...NOTHING, rows: view.initial.rows });
    view.expectConsistent();
  });

  it("renames a column: its header changes, no cell renders, the virtualization cache is kept", () => {
    const view = mount();
    view.scroll(MIDDLE);
    const columnId = view.shownColumns()[3] as string;
    const header = () => view.headerCells()[3].textContent;
    const label = header();

    const cost = view.apply({ type: "renameColumn", columnId });

    expect(header()).toBe(`${label} *`);
    expect(cost).toMatchObject({ cells: 0, mounted: 0, cacheBuilds: 0, indexesMaps: 0 });
    view.expectConsistent();
  });

  it("keeps a column hidden by id hidden when columns are inserted and removed before it", () => {
    const view = mount();
    view.scroll(MIDDLE);
    const hidden = view.shownColumns()[3] as string;
    const indexOfHidden = () =>
      view
        .api()
        .getData()
        .columns.findIndex((column) => column.id === hidden);

    act(() => manager.current?.updateHiddenIds([hidden]));
    expect(view.shownColumns()).not.toContain(hidden);

    view.apply({ type: "insertColumns", index: 2, count: 3 });
    expect(manager.current?.hiddenColumnsIndexes).toEqual([indexOfHidden()]);
    view.apply({ type: "removeColumns", index: 1 });
    expect(manager.current?.hiddenColumnsIndexes).toEqual([indexOfHidden()]);
    // looked for where it would be displayed
    act(() =>
      view
        .api()
        .getHandle()
        ?.goToColumnIndex(indexOfHidden() - 2),
    );
    view.scroll({ scrollLeft: view.scroller.scrollLeft });
    expect(view.shownColumns()).not.toContain(hidden);
    view.expectConsistent();
  });

  it("keeps the group cells above their columns", () => {
    const view = mount({ withGroups: true });
    const groups = () =>
      Array.from(view.container.querySelectorAll<HTMLTableCellElement>("tr.table-groups-row th")).map((cell) => ({
        label: cell.textContent,
        columns: cell.colSpan,
      }));
    const metricsShown = () => view.shownColumns().filter((id) => id !== NAME_COLUMN && id !== TOTAL_COLUMN).length;
    const expectGroups = () =>
      expect(groups()).toEqual([
        { label: "Identity", columns: 1 },
        { label: "Metrics", columns: metricsShown() },
        { label: "Totals", columns: 1 },
      ]);
    expectGroups();

    view.scroll({ scrollLeft: MIDDLE.scrollLeft });
    view.apply({ type: "insertColumns", index: 2, count: 2 });
    expectGroups();
    view.apply({ type: "removeColumns", index: 5, count: 3 });
    expectGroups();
    view.expectConsistent();

    // down to no metric at all: its group leaves with its last column
    view.apply({ type: "removeColumns", index: 1, count: view.api().getData().columns.length - 2 });
    expect(groups()).toEqual([
      { label: "Identity", columns: 1 },
      { label: "Totals", columns: 1 },
    ]);
    view.expectConsistent();
  });
});

describe("cost of a change on a large table", () => {
  it("does not depend on the number of rows when a value is updated", () => {
    const view = mount({ rows: 20000, columns: 40 });
    view.scroll({ scrollTop: 400000, scrollLeft: 1100 });
    const [, , third] = view.shownRows();
    const place = view
      .api()
      .getData()
      .rows.findIndex((row) => row.id === third);

    expect(view.apply({ type: "updateCell", index: place, columnId: view.shownColumns()[2] as string })).toEqual({
      ...NOTHING,
      cells: 1,
      rows: 1,
    });
    expect(view.apply({ type: "updateCell", index: 3, columnId: "c5" })).toEqual(NOTHING);
    // rows inserted or removed: one pass over the rows, one rebuild of the cache
    expect(view.apply({ type: "insertRows", index: 19000 })).toEqual({ ...NOTHING, cacheBuilds: ONE_CACHE, indexesMaps: 1 });
    expect(view.apply({ type: "removeRows", index: 19000 })).toEqual({ ...NOTHING, cacheBuilds: ONE_CACHE, indexesMaps: 1 });
  });
});

describe("random sequences of changes", () => {
  /** Deterministic: a failure replays the same sequence. */
  const createRandom = (seed: number) => {
    let state = seed;
    return (max: number) => {
      state = (state * 1664525 + 1013904223) | 0;
      return (state >>> 8) % Math.max(max, 1);
    };
  };

  it.each([7, 1234, 99])("leaves a table that shows the data after each of 120 changes (seed %i)", (seed) => {
    const pick = createRandom(seed);
    const view = mount({ rows: 60, columns: 16, withGroups: true });
    const log: string[] = [];

    for (let step = 0; step < 120; step++) {
      const { rows, columns } = view.api().getData();
      const metrics = columns.filter((column) => column.id !== NAME_COLUMN);
      const operations: LiveOperation[] = [
        { type: "insertRows", index: pick(rows.length + 1), count: 1 + pick(3) },
        { type: "removeRows", index: pick(rows.length + 1), count: 1 + pick(4) },
        { type: "insertColumns", index: 1 + pick(columns.length), count: 1 + pick(2) },
        { type: "removeColumns", index: 1 + pick(columns.length), count: 1 + pick(2) },
        { type: "updateRow", index: pick(rows.length + 1) },
        { type: "updateCell", index: pick(rows.length + 1), columnId: metrics[pick(metrics.length)]?.id ?? "none" },
        { type: "updateColumn", columnId: metrics[pick(metrics.length)]?.id ?? "none" },
        { type: "renameColumn", columnId: columns[pick(columns.length)].id },
      ];
      const operation = operations[pick(operations.length)];
      const position = { scrollTop: pick(3000), scrollLeft: pick(2500) };
      if (step % 3 === 0) view.scroll(position);
      const scrollTop = view.scroller.scrollTop;
      log.push(`${step}: ${step % 3 === 0 ? `scroll ${JSON.stringify(position)} ` : ""}${JSON.stringify(operation)}`);

      view.apply(operation);

      try {
        // a change of data never moves the scroll
        expect(view.scroller.scrollTop).toBe(scrollTop);
        view.expectConsistent();
      } catch (error) {
        (error as Error).message = `after\n${log.slice(-6).join("\n")}\n\n${(error as Error).message}`;
        throw error;
      }
    }
  });
});

describe("handle of the table", () => {
  const WINDOW = { width: WIDTH, height: HEIGHT, fixedRows: [0] };
  const withColumn = (rows: ITableProps["rows"], id: string) =>
    rows.map((row, index) => ({ ...row, cells: [...row.cells, { id: index === 0 ? id : `${row.id}-${id}`, value: id }] }));

  it("stays the same object and tells its listeners when the columns change, and only then", () => {
    const handles: ITableHandle[] = [];
    const ref = (handle: ITableHandle | null) => {
      if (handle) handles.push(handle);
    };
    const onColumnsChange = jest.fn();
    const table = generateTable(30, 12);
    const header = table.rows[0];
    const view = render(<Table {...table} ref={ref} isVirtualized virtualizerProps={WINDOW} />);
    expect(handles).toHaveLength(1);
    const stopListening = handles[0].onColumnsChange(onColumnsChange);

    // new rows, new values, fewer rows: the columns are the same
    const updated = table.rows.map((row, index) =>
      index === 3 ? { ...row, cells: row.cells.map((cell) => ({ ...cell })) } : row,
    );
    view.rerender(<Table {...table} rows={updated} ref={ref} isVirtualized virtualizerProps={WINDOW} />);
    view.rerender(<Table {...table} rows={updated.slice(0, 20)} ref={ref} isVirtualized virtualizerProps={WINDOW} />);
    expect(onColumnsChange).not.toHaveBeenCalled();

    // a column more: ids resolved through the handle have to be resolved again
    const wider = withColumn(updated, "added");
    view.rerender(<Table {...table} rows={wider} ref={ref} isVirtualized virtualizerProps={WINDOW} />);
    expect(onColumnsChange).toHaveBeenCalledTimes(1);
    expect(handles).toHaveLength(1);
    expect(handles[0].getColumnIndex("added")).toBe(header.cells.length);

    stopListening();
    view.rerender(<Table {...table} rows={updated} ref={ref} isVirtualized virtualizerProps={WINDOW} />);
    expect(onColumnsChange).toHaveBeenCalledTimes(1);
  });

  it("answers with the rows being rendered when a cell content calls it while rendering", () => {
    const handle: { current: ITableHandle | null } = { current: null };
    const seen: string[] = [];
    function Probe() {
      seen.push(handle.current?.getCell({ rowIndex: 1, cellIndex: 1 })?.value ?? "no handle");
      return null;
    }
    const withProbe = (rows: ITableProps["rows"], value: string) =>
      rows.map((row, rowIndex) =>
        rowIndex === 1
          ? { ...row, cells: row.cells.map((cell, index) => (index === 1 ? { ...cell, value, cellContent: Probe } : cell)) }
          : row,
      );
    const table = generateTable(10, 6);
    const setHandle = (current: ITableHandle | null) => {
      handle.current = current;
    };
    const view = render(<Table {...table} rows={withProbe(table.rows, "before")} ref={setHandle} />);

    view.rerender(<Table {...table} rows={withProbe(table.rows, "after")} ref={setHandle} />);

    expect(seen[seen.length - 1]).toBe("after");
  });
});

describe("options of a column", () => {
  it("keep the meaning of 4.x for a size left undefined: as wide as its content", () => {
    const table = generateTable(10, 8);
    const { container } = render(
      <Table
        {...table}
        isVirtualized
        columns={{ 0: { size: 190 }, 2: { size: undefined, className: "plain" }, 3: { className: "plain" } }}
        virtualizerProps={{ width: WIDTH, height: HEIGHT, fixedRows: [0] }}
      />,
    );
    const widths = Array.from(container.querySelectorAll<HTMLElement>("tr.head th")).map((cell) => cell.style.width);

    expect(widths[0]).toBe("190px");
    // the option overrides the width of the window columns, as an explicit `undefined` did in 4.x
    expect(widths[2]).toBe("auto");
    expect(widths[3]).toMatch(/^\d+(\.\d+)?px$/);
  });
});
