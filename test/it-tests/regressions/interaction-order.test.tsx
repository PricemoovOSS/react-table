/**
 * ATTACKED AND HELD — an interaction (scroll on both axes, row opened through the handle,
 * selection by drag) followed by a change of props gives the same DOM as the change of props
 * followed by the interaction: nothing memoized keeps a value of the other order. These tests PASS.
 */
import * as React from "react";
import { act, fireEvent, render, RenderResult } from "@testing-library/react";

import Table, { ITableHandle, ITableProps } from "../../../src/components/table/table";
import { IRow } from "../../../src/components/table/row";
import { generateTable } from "../../../stories/utils/tables";

const normalise = (html: string) => {
  const host = document.createElement("div");
  host.innerHTML = html;
  host.querySelectorAll("*").forEach((element) => {
    // the order of the attributes and of the style properties depends on when React set them
    const attributes = Array.from(element.attributes)
      .map(
        (a) =>
          [
            a.name,
            a.name === "style"
              ? a.value
                  .split(";")
                  .map((v) => v.trim())
                  .filter(Boolean)
                  .sort()
                  .join("; ")
              : a.value,
          ] as const,
      )
      .sort(([a], [b]) => a.localeCompare(b));
    Array.from(element.attributes).forEach((a) => element.removeAttribute(a.name));
    attributes.forEach(([name, value]) => element.setAttribute(name, value));
  });
  return host.innerHTML;
};

const mapCell = (rows: IRow[], rowIndex: number, cellIndex: number, patch: object): IRow[] =>
  rows.map((row, r) =>
    r === rowIndex ? { ...row, cells: row.cells.map((cell, c) => (c === cellIndex ? { ...cell, ...patch } : cell)) } : row,
  );
const mapRow = (rows: IRow[], rowIndex: number, patch: object): IRow[] =>
  rows.map((row, r) => (r === rowIndex ? { ...row, ...patch } : row));

const table = generateTable(60, 30, {}, true);
const Content = ({ value, label }: { value?: string; label?: string }) => <b>{`${label ?? "content"}:${value}`}</b>;
const OtherToggle = ({ onClick, opened }: { onClick: React.MouseEventHandler<HTMLButtonElement>; opened?: boolean }) => (
  <button data-testid="table-cell-sub-item-toggle" onClick={onClick}>
    {opened ? "CLOSE" : "OPEN"}
  </button>
);

type Variation = [string, Partial<ITableProps>];
// rows 21.. and columns 10.. are in the window after the scroll below
const variations: Variation[] = [
  ["cell value in window", { rows: mapCell(table.rows, 23, 12, { value: "X" }) }],
  ["cell value at origin", { rows: mapCell(table.rows, 1, 1, { value: "X" }) }],
  ["cell className", { rows: mapCell(table.rows, 23, 12, { className: "hot" }) }],
  ["cell content", { rows: mapCell(table.rows, 23, 12, { cellContent: Content, cellContentProps: { label: "z" } }) }],
  ["cell loading", { rows: mapCell(table.rows, 23, 12, { loading: true }) }],
  ["cell colspan", { rows: mapCell(table.rows, 23, 12, { colspan: 3 }) }],
  ["row loading", { rows: mapRow(table.rows, 23, { loading: true }) }],
  ["row size", { rows: mapRow(table.rows, 23, { size: 77 }) }],
  ["sub rows of the opened row", { rows: mapCell(table.rows, 2, 0, { subItems: table.rows[2].cells[0].subItems?.slice(0, 5) }) }],
  [
    "sub row value",
    { rows: mapCell(table.rows, 2, 0, { subItems: mapCell(table.rows[2].cells[0].subItems as IRow[], 1, 1, { value: "SUB" }) }) },
  ],
  ["sub rows removed", { rows: mapCell(table.rows, 2, 0, { subItems: [] }) }],
  ["columns className", { columns: { 12: { className: "b" } } }],
  ["columns size", { columns: { 12: { size: 200 } } }],
  ["columns loading", { columns: { 12: { loading: true } } }],
  ["columns not selectable", { columns: { 12: { isSelectable: false } } }],
  ["globalColumnProps", { globalColumnProps: { className: "g", style: { color: "red" } } }],
  ["globalRowProps", { globalRowProps: { size: 70 } }],
  ["rowsProps", { rowsProps: { 23: { size: 90 } } }],
  ["toggle component", { SubRowsToggleButtonComponent: OtherToggle }],
  ["isSpan", { isSpan: true }],
  ["rows removed above", { rows: [...table.rows.slice(0, 5), ...table.rows.slice(8)] }],
  ["rows fewer", { rows: table.rows.slice(0, 30) }],
  ["columns fewer", { rows: table.rows.map((row) => ({ ...row, cells: row.cells.slice(0, 20) })) }],
  [
    "column removed before",
    { rows: table.rows.map((row) => ({ ...row, cells: [...row.cells.slice(0, 3), ...row.cells.slice(4)] })) },
  ],
  ["fixed columns", { virtualizerProps: { height: 400, width: 900, minRowHeight: 40, fixedColumns: [0, 29], fixedRows: [0] } }],
  [
    "hidden columns",
    { virtualizerProps: { height: 400, width: 900, minRowHeight: 40, hiddenColumns: [11, 12], fixedRows: [0] } },
  ],
  ["hidden rows", { virtualizerProps: { height: 400, width: 900, minRowHeight: 40, hiddenRows: [22, 23], fixedRows: [0] } }],
  ["window size", { virtualizerProps: { height: 600, width: 1200, minRowHeight: 40, fixedRows: [0] } }],
  ["keyboard navigation props", { keyboardPageSize: 3, ariaLabel: "x" }],
];

const base: ITableProps = {
  ...table,
  isVirtualized: true,
  virtualizerProps: { height: 400, width: 900, minRowHeight: 40, fixedRows: [0] },
};

type Step = (view: RenderResult, handle: React.RefObject<ITableHandle>) => void;

const scroller = (view: RenderResult) => view.container.querySelector("[data-testid='scroller-container']") as HTMLElement;
const scroll: Step = (view) => {
  act(() => {
    fireEvent.scroll(scroller(view), { target: { scrollTop: 800 } });
    fireEvent.scroll(scroller(view), { target: { scrollLeft: 1000 } });
  });
};
const openRow: Step = (_view, handle) => act(() => handle.current?.openTrees({ 2: { rowIndex: 2, columnIndex: 0 } }));
const select: Step = (view) => {
  const rows = view.container.querySelectorAll("tbody tr");
  const from = rows[2].querySelectorAll("td")[2];
  const to = rows[4].querySelectorAll("td")[4];
  fireEvent.mouseDown(from);
  fireEvent.mouseEnter(to);
  fireEvent.mouseUp(to);
};

/** Interaction then change of props, against change of props then interaction: the same table. */
function bothOrders(steps: Step[], changed: Partial<ITableProps>, strictProps: Partial<ITableProps> = {}) {
  const run = (order: "interaction-first" | "change-first") => {
    const handle = React.createRef<ITableHandle>();
    const view = render(<Table {...base} {...strictProps} ref={handle} />);
    const change = () => view.rerender(<Table {...base} {...strictProps} {...changed} ref={handle} />);
    if (order === "interaction-first") {
      steps.forEach((step) => step(view, handle));
      change();
    } else {
      change();
      steps.forEach((step) => step(view, handle));
    }
    const html = normalise(view.container.innerHTML);
    view.unmount();
    return html;
  };
  return { interactionFirst: run("interaction-first"), changeFirst: run("change-first") };
}

// the selection is made by position in the DOM: these changes move other cells under the pointer
const MOVES_CELLS = ["isSpan", "hidden columns", "hidden rows"];

describe.each([
  ["scroll", [scroll], {}],
  ["open a row", [openRow], { isSelectable: false }],
  ["open a row then scroll", [openRow, scroll], { isSelectable: false }],
  ["scroll then select", [scroll, select], {}],
  ["keyboard grid, open then scroll", [openRow, scroll], { keyboardNavigation: true }],
] as [string, Step[], Partial<ITableProps>][])("held — interaction and change of props commute: %s", (name, steps, modeProps) => {
  const cases = name === "scroll then select" ? variations.filter(([variation]) => !MOVES_CELLS.includes(variation)) : variations;
  it.each(cases)("%s", (_variation, changed) => {
    const { interactionFirst, changeFirst } = bothOrders(steps, changed, modeProps);
    expect(interactionFirst).toBe(changeFirst);
  });
});
