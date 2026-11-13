import { act, fireEvent, render, within } from "@testing-library/react";

import {
  ITableInteractionsManagerProps,
  useTableInteractionsManager,
} from "../../src/components/table-interactions-manager/table-interactions-manager";
import { ITrees } from "../../src/components/table/elementary-table";
import {
  Application,
  columnId,
  COLUMNS_COUNT,
  IApplicationProps,
  PAGE_SIZE,
} from "../../stories/stories-components/application-table";

/**
 * The way a data application uses the table: an interactions manager around it, custom group
 * cells and sub-rows toggle, a page loaded when the scroll reaches the bottom, a columns cursor,
 * columns pinned and hidden from outside. Sizes are the ones such an application gives in its tests.
 */
const WIDTH = 1654;
const HEIGHT = 771;
const LAST_COLUMN = COLUMNS_COUNT - 1;

const manager: { current: ITableInteractionsManagerProps | null } = { current: null };
function ManagerProbe() {
  manager.current = useTableInteractionsManager();
  return null;
}

function mount(props: IApplicationProps = {}) {
  const view = render(
    <Application width={WIDTH} height={HEIGHT} {...props}>
      <ManagerProbe />
    </Application>,
  );
  const scroller = () => view.container.querySelector("[data-testid='scroller-container']") as HTMLElement;
  const headerCells = () => Array.from(view.container.querySelectorAll<HTMLElement>("tr[data-testid='table-header-header'] th"));
  const columns = () => headerCells().map((cell) => Number(cell.getAttribute("aria-colindex")) - 1);
  const bodyRows = () => Array.from(view.container.querySelectorAll<HTMLElement>("tbody tr"));
  const rowIds = () => bodyRows().map((row) => (row.getAttribute("data-testid") || "").replace("table-row-", ""));
  const scroll = (target: { scrollTop?: number; scrollLeft?: number }) =>
    act(() => void fireEvent.scroll(scroller(), { target }));
  return { ...view, scroller, headerCells, columns, bodyRows, rowIds, scroll };
}

const withManager = (action: (current: ITableInteractionsManagerProps) => void) =>
  act(() => action(manager.current as ITableInteractionsManagerProps));

describe("table used by a data application", () => {
  it("renders the window with the application cells, group cells and toggles", () => {
    const { container, columns, rowIds, getAllByTestId } = mount();

    expect(columns().slice(0, 4)).toEqual([0, 1, 2, 3]);
    expect(rowIds().slice(0, 3)).toEqual(["row-0", "row-1", "row-2"]);
    // the content cells get the coordinates of the application, not the indexes of the table
    const firstValue = getAllByTestId("value-cell")[0];
    expect(firstValue.dataset).toMatchObject({ rowId: "row-0", columnId: "column-1" });
    expect(getAllByTestId("value-cell")[2].textContent).toBe("row-0:3 €");
    expect(getAllByTestId("row-selector").length).toBe(rowIds().length);

    // custom group cells, fed by the virtualizer: one row per level of groups
    expect(container.querySelectorAll("tr.table-groups-row")).toHaveLength(2);
    const identity = getAllByTestId("group-Identity")[0];
    expect(identity.getAttribute("colspan")).toBe("2");
    expect(Number(identity.dataset.cellWidth)).toBeGreaterThanOrEqual(120);
    expect(Number(identity.dataset.visibleColumns)).toBe(columns().length);

    // one row out of five can be opened, with the toggle of the application
    const toggles = getAllByTestId("table-cell-sub-item-toggle");
    expect(toggles[0].textContent).toBe("▸");
    expect(toggles[0].tagName).toBe("BUTTON");
  });

  it("keeps the window when the application re-renders with new inline properties", () => {
    const view = mount();
    view.scroll({ scrollTop: 400, scrollLeft: 600 });
    const before = { rows: view.rowIds(), columns: view.columns() };
    expect(before.rows[0]).not.toBe("row-0");

    view.rerender(
      <Application width={WIDTH} height={HEIGHT}>
        <ManagerProbe />
      </Application>,
    );
    expect({ rows: view.rowIds(), columns: view.columns() }).toEqual(before);
  });

  it("asks for the next page once the bottom is reached going down, and shows it", () => {
    const onLoadMore = jest.fn();
    const view = mount({ onLoadMore });

    view.scroll({ scrollTop: 300 });
    expect(onLoadMore).not.toHaveBeenCalled();

    view.scroll({ scrollTop: 100000 });
    expect(onLoadMore).toHaveBeenCalledTimes(1);

    // going back up from the bottom does not ask again
    view.scroll({ scrollTop: 99000 });
    expect(onLoadMore).toHaveBeenCalledTimes(1);

    // placeholders while the page loads, then the rows of the new page
    view.rerender(
      <Application width={WIDTH} height={HEIGHT} onLoadMore={onLoadMore} isLoadingMore>
        <ManagerProbe />
      </Application>,
    );
    view.scroll({ scrollTop: 200000 });
    expect(view.getAllByTestId("value-loading").length).toBeGreaterThan(0);
    expect(onLoadMore).toHaveBeenCalledTimes(1);

    view.rerender(
      <Application width={WIDTH} height={HEIGHT} onLoadMore={onLoadMore} pages={2}>
        <ManagerProbe />
      </Application>,
    );
    view.scroll({ scrollTop: 300000 });
    expect(view.rowIds().slice(-1)[0]).toBe(`row-${2 * PAGE_SIZE - 1}`);
    expect(view.queryAllByTestId("value-loading")).toHaveLength(0);
  });

  it("asks for the next page earlier with a larger end threshold", () => {
    // height of everything that scrolls: the bottom is reached when scrollTop gets there
    const scrollRange = (container: HTMLElement) =>
      parseInt((container.querySelector(".scroller-scrollbar") as HTMLElement).style.minHeight, 10);

    const byDefault = jest.fn();
    const first = mount({ onLoadMore: byDefault });
    first.scroll({ scrollTop: scrollRange(first.container) - 100 });
    expect(byDefault).not.toHaveBeenCalled();
    first.unmount();

    const earlier = jest.fn();
    const second = mount({ onLoadMore: earlier, scrollEndThreshold: 150 });
    second.scroll({ scrollTop: scrollRange(second.container) - 100 });
    expect(earlier).toHaveBeenCalledTimes(1);
  });

  it("follows the horizontal scroll with the columns cursor of the manager", () => {
    const view = mount();
    expect(manager.current?.columnsCursor).toBeNull();

    view.scroll({ scrollLeft: 1300 });
    const cursor = manager.current?.columnsCursor;
    const firstScrollingColumn = view.columns()[1];
    expect(cursor).toEqual({ index: firstScrollingColumn, id: columnId(firstScrollingColumn) });
    expect(manager.current?.table?.current?.getColumnId(firstScrollingColumn)).toBe(columnId(firstScrollingColumn));
  });

  it("opens on the column of the initial cursor", () => {
    const view = mount({ initialColumnsCursorIndex: 12 });
    expect(view.scroller().scrollLeft).toBeGreaterThan(0);
    act(() => void fireEvent.scroll(view.scroller()));
    expect(view.columns().slice(0, 2)).toEqual([0, 12]);
  });

  it("scrolls to a column asked by its id", () => {
    const view = mount();
    withManager((current) => current.goToColumnId(columnId(10)));
    act(() => void fireEvent.scroll(view.scroller()));
    expect(view.columns().slice(0, 2)).toEqual([0, 10]);
    expect(manager.current?.columnsCursor).toEqual({ index: 10, id: columnId(10) });
  });

  it("pins columns from the manager, on the left and on the right, with their group above", () => {
    const view = mount();
    withManager((current) => current.updateFixedColumnsIds([columnId(2), columnId(LAST_COLUMN)]));

    expect(manager.current?.fixedColumnsIndexes).toEqual([2, LAST_COLUMN]);
    view.scroll({ scrollLeft: 1300 });
    const columns = view.columns();
    expect(columns.slice(0, 2)).toEqual([0, 2]);
    expect(columns[columns.length - 1]).toBe(LAST_COLUMN);

    const lastHeaderCell = view.headerCells()[columns.length - 1];
    expect(lastHeaderCell.className).toContain("elevated-absolute");
    const totals = view.getAllByTestId("group-Totals")[0];
    expect(totals.className).toContain("elevated-absolute");
    expect(totals.style.right).toBe("0px");
    expect(totals.style.width).toBe(lastHeaderCell.style.width);
  });

  it("hides the columns of a group from its group cell, and shows them again", () => {
    const view = mount();
    expect(view.columns().slice(0, 4)).toEqual([0, 1, 2, 3]);

    act(() => void fireEvent.click(view.getByLabelText("Hide Identity")));
    expect(manager.current?.hiddenColumnsIds).toEqual([columnId(1), columnId(2)]);
    expect(view.columns().slice(0, 3)).toEqual([0, 3, 4]);
    expect(view.queryAllByTestId("group-Identity")).toHaveLength(0);

    withManager((current) => current.updateHiddenIds([]));
    expect(view.columns().slice(0, 4)).toEqual([0, 1, 2, 3]);
  });

  it("hides rows from the manager", () => {
    const view = mount();
    withManager((current) => current.updateHiddenRowIndexes([1, 3]));
    expect(view.rowIds().slice(0, 3)).toEqual(["row-1", "row-3", "row-4"]);
  });

  it("opens sub rows from a toggle and from the manager, and reports what the user did", () => {
    const opened: string[] = [];
    const onOpenedTreesUpdate = (trees: ITrees) => opened.push(Object.keys(trees).join("+"));
    const view = mount({ onOpenedTreesUpdate });

    act(() => void fireEvent.click(view.getAllByTestId("table-cell-sub-item-toggle")[0]));
    expect(view.rowIds().slice(0, 4)).toEqual(["row-0", "row-0-row-0.1", "row-0-row-0.2", "row-1"]);
    expect(view.getAllByTestId("table-cell-sub-item-toggle")[0].textContent).toBe("▾");
    // the sub rows keep the tree mark in the cell that opens them
    const subRow = view.bodyRows()[1];
    expect(subRow.className).toContain("sub-row");
    expect(within(subRow).getAllByTestId("table-column")[1].className).toContain("table-sub-cell");

    // expand all / collapse all, as a toolbar does it: trees keyed by the index of the row in the table
    withManager((current) => current.openTrees({ 6: { rowIndex: 6, columnIndex: 1 } }));
    expect(view.rowIds()).toEqual(expect.arrayContaining(["row-5-row-5.1", "row-5-row-5.2"]));
    withManager((current) => current.closeTrees({ 1: { rowIndex: 1, columnIndex: 1 }, 6: { rowIndex: 6, columnIndex: 1 } }));
    expect(view.rowIds().slice(0, 3)).toEqual(["row-0", "row-1", "row-2"]);

    expect(opened).toEqual(["1", "1+6", ""]);
  });

  it("drops the opened rows when the data is replaced by rows without sub rows", () => {
    const onOpenedTreesUpdate = jest.fn();
    const view = mount({ onOpenedTreesUpdate, pageSize: 4 });
    act(() => void fireEvent.click(view.getAllByTestId("table-cell-sub-item-toggle")[0]));
    expect(view.rowIds()).toContain("row-0-row-0.1");
    onOpenedTreesUpdate.mockClear();

    // same table, another page size: the row at this index has no sub rows any more
    view.rerender(
      <Application width={WIDTH} height={HEIGHT} onOpenedTreesUpdate={onOpenedTreesUpdate} pageSize={4} pages={0} isLoadingMore>
        <ManagerProbe />
      </Application>,
    );
    expect(manager.current?.table?.current?.getOpenedTrees()).toEqual({});
    expect(onOpenedTreesUpdate).not.toHaveBeenCalled();
  });

  it("accepts the size of a custom scrollbar", () => {
    const withNativeScrollbar = mount();
    const nativeColumns = withNativeScrollbar.columns().length;
    const spacer = (container: HTMLElement) => (container.querySelector(".scroller-scrollbar") as HTMLElement).style.minWidth;
    const nativeWidth = spacer(withNativeScrollbar.container);
    withNativeScrollbar.unmount();

    // room is kept for the scrollbar: the scroll range grows, the window does not gain a column
    const withCustomScrollbar = mount({ scrollbarSize: 6 });
    expect(withCustomScrollbar.columns().length).toBeLessThanOrEqual(nativeColumns);
    expect(parseInt(spacer(withCustomScrollbar.container), 10)).toBeGreaterThan(parseInt(nativeWidth, 10));
  });

  it("works without groups", () => {
    const view = mount({ withGroups: false });
    expect(view.container.querySelectorAll("tr.table-groups-row")).toHaveLength(0);
    expect(view.rowIds().length).toBeGreaterThan(10);
  });
});
