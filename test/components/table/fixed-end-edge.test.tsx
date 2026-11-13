import { act, fireEvent, render } from "@testing-library/react";

import Table, { ITableProps } from "../../../src/components/table/table";
import { generateTable } from "../../../stories/utils/tables";

/**
 * The relief of the columns fixed at the end is drawn by the first of them: that cell carries
 * `elevated-absolute-edge`, on every row, so that the style needs no sibling selector.
 */
const COLUMNS = 30;
const ROWS = 40;
const LAST = COLUMNS - 1;
const EDGE = "elevated-absolute-edge";

const GROUPS = [
  { id: "start", label: "Start" },
  { id: "middle", label: "Middle" },
  {
    id: "end",
    label: "End",
    subGroups: [
      { id: "end-a", label: "End A" },
      { id: "end-b", label: "End B" },
    ],
  },
];

function groupedColumns() {
  const columns: Record<number, { groupId: string }> = {};
  for (let column = 0; column < COLUMNS; column += 1) columns[column] = { groupId: column < 2 ? "start" : "middle" };
  columns[LAST - 1] = { groupId: "end-a" };
  columns[LAST] = { groupId: "end-b" };
  return columns;
}

function mount(virtualizerProps: ITableProps["virtualizerProps"], props: Partial<ITableProps> = {}) {
  const view = render(
    <Table
      {...generateTable(ROWS, COLUMNS)}
      isVirtualized
      virtualizerProps={{ width: 1000, height: 500, minRowHeight: 40, fixedRows: [0], ...virtualizerProps }}
      {...props}
    />,
  );
  const scroller = view.container.querySelector("[data-testid='scroller-container']") as HTMLElement;
  /** Per row: positions of the cells fixed at the end, and of the ones marked as their edge. */
  const rows = () =>
    Array.from(view.container.querySelectorAll("tr")).map((row) => {
      const cells = Array.from(row.children);
      const positionsOf = (name: string) => cells.flatMap((cell, position) => (cell.classList.contains(name) ? [position] : []));
      return { kind: row.className, fixedEnd: positionsOf("elevated-absolute"), edges: positionsOf(EDGE) };
    });
  const scroll = (scrollLeft: number) => act(() => void fireEvent.scroll(scroller, { target: { scrollLeft } }));
  return { ...view, rows, scroll };
}

function expectOneEdgePerRow(rows: ReturnType<ReturnType<typeof mount>["rows"]>, fixedEndCount: number) {
  expect(rows.length).toBeGreaterThan(3);
  rows.forEach((row) => {
    expect({ kind: row.kind, fixedEnd: row.fixedEnd.length }).toEqual({ kind: row.kind, fixedEnd: fixedEndCount });
    expect({ kind: row.kind, edges: row.edges }).toEqual({ kind: row.kind, edges: [row.fixedEnd[0]] });
  });
}

describe("edge of the columns fixed at the end", () => {
  it("is the first of them on the header, body and bottom rows, at every scroll position", () => {
    const view = mount({ fixedColumns: [0, LAST - 1, LAST], fixedRows: [0, ROWS - 1] });

    expectOneEdgePerRow(view.rows(), 2);
    expect(view.rows().some((row) => row.kind.includes("elevated-absolute"))).toBe(true);

    view.scroll(900);
    expectOneEdgePerRow(view.rows(), 2);
    view.scroll(999999);
    expectOneEdgePerRow(view.rows(), 2);
  });

  it("is the first of their groups on every row of groups", () => {
    const view = mount(
      { fixedColumns: [0, LAST - 1, LAST] },
      { groups: GROUPS, columns: groupedColumns(), groupsProps: { rowsOptions: { size: 30 } } },
    );

    const groupRows = view.rows().filter((row) => row.kind.includes("table-groups-row"));
    // "End" above its two columns, then "End A" and "End B": the edge is "End", then "End A"
    expect(groupRows.map((row) => row.fixedEnd.length)).toEqual([1, 2]);
    groupRows.forEach((row) => expect(row.edges).toEqual([row.fixedEnd[0]]));
    expectOneEdgePerRow(
      view.rows().filter((row) => !row.kind.includes("table-groups-row")),
      2,
    );
  });

  it("moves to the next column when the first one is hidden", () => {
    const view = mount({ fixedColumns: [LAST - 1, LAST], hiddenColumns: [LAST - 1] });

    expectOneEdgePerRow(view.rows(), 1);
    const header = view.container.querySelector("tr.head") as HTMLElement;
    expect(header.querySelector(`.${EDGE}`)?.getAttribute("aria-colindex")).toBe(String(LAST + 1));
  });

  it("is not set without any column fixed at the end", () => {
    const view = mount({ fixedColumns: [0, 1] });

    view.scroll(600);
    expect(view.container.querySelector(`.${EDGE}`)).toBeNull();
    expect(view.container.querySelector("td.elevated-absolute, th.elevated-absolute")).toBeNull();
  });
});
