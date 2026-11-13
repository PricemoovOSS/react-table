import * as React from "react";
import { render } from "@testing-library/react";

import Table, { ITableProps } from "../../../src/components/table/table";
import { IRow } from "../../../src/components/table/row";
import { generateTable } from "../../../stories/utils/tables";

/**
 * ATTACKED AND HELD — a prop changed at runtime gives the DOM of a fresh mount with that prop:
 * 57 changes (cell, row, column, global and group options, toggle component, span, id,
 * selection, keyboard navigation, rows and columns added or removed) on a plain table, a
 * virtualized one, one with fixed rows and columns, and one narrower than its window.
 * These tests PASS.
 */
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

/** After a re-render with new props, the DOM must be the one of a fresh mount with these props. */
function domAfterRerender(base: ITableProps, changed: ITableProps, strict = false) {
  const wrap = (props: ITableProps) =>
    strict ? (
      <React.StrictMode>
        <Table {...props} />
      </React.StrictMode>
    ) : (
      <Table {...props} />
    );
  const view = render(wrap(base));
  view.rerender(wrap(changed));
  const html = normalise(view.container.innerHTML);
  view.unmount();
  const fresh = render(wrap(changed));
  const expected = normalise(fresh.container.innerHTML);
  fresh.unmount();
  return { html, expected };
}

const Content = ({ value, label }: { value?: string; label?: string }) => <b>{`${label ?? "content"}:${value}`}</b>;
const OtherContent = ({ value }: { value?: string }) => <i>{`other:${value}`}</i>;
const Toggle = ({ onClick, opened }: { onClick: React.MouseEventHandler<HTMLButtonElement>; opened?: boolean }) => (
  <button onClick={onClick}>{opened ? "close" : "open"}</button>
);
const OtherToggle = ({ onClick, opened }: { onClick: React.MouseEventHandler<HTMLButtonElement>; opened?: boolean }) => (
  <button onClick={onClick}>{opened ? "CLOSE" : "OPEN"}</button>
);
const GroupCell = ({
  group,
  className,
  style,
}: {
  group: { label?: string };
  className?: string;
  style?: React.CSSProperties;
}) => <th className={className} style={style}>{`G:${group.label}`}</th>;

const mapCell = (rows: IRow[], rowIndex: number, cellIndex: number, patch: object): IRow[] =>
  rows.map((row, r) =>
    r === rowIndex ? { ...row, cells: row.cells.map((cell, c) => (c === cellIndex ? { ...cell, ...patch } : cell)) } : row,
  );
const mapRow = (rows: IRow[], rowIndex: number, patch: object): IRow[] =>
  rows.map((row, r) => (r === rowIndex ? { ...row, ...patch } : row));

const table = generateTable(30, 20, {}, true);
const groups = [
  { id: "g1", label: "one" },
  { id: "g2", label: "two" },
];
const groupedColumns = { 1: { groupId: "g1" }, 2: { groupId: "g1" }, 3: { groupId: "g2" } };

type Variation = [string, Partial<ITableProps>, Partial<ITableProps>];

const variations: Variation[] = [
  ["cell value", {}, { rows: mapCell(table.rows, 1, 1, { value: "X" }) }],
  ["cell className", {}, { rows: mapCell(table.rows, 1, 1, { className: "hot" }) }],
  [
    "cell getClassName",
    { rows: mapCell(table.rows, 1, 1, { getClassName: () => "a" }) },
    { rows: mapCell(table.rows, 1, 1, { getClassName: () => "b" }) },
  ],
  [
    "cell style",
    { rows: mapCell(table.rows, 1, 1, { style: { color: "red" } }) },
    { rows: mapCell(table.rows, 1, 1, { style: { color: "blue" } }) },
  ],
  [
    "cell cellContent",
    { rows: mapCell(table.rows, 1, 1, { cellContent: Content }) },
    { rows: mapCell(table.rows, 1, 1, { cellContent: OtherContent }) },
  ],
  ["cell cellContent added", {}, { rows: mapCell(table.rows, 1, 1, { cellContent: Content }) }],
  ["cell cellContent removed", { rows: mapCell(table.rows, 1, 1, { cellContent: Content }) }, {}],
  [
    "cell cellContentProps",
    { rows: mapCell(table.rows, 1, 1, { cellContent: Content, cellContentProps: { label: "a" } }) },
    { rows: mapCell(table.rows, 1, 1, { cellContent: Content, cellContentProps: { label: "b" } }) },
  ],
  ["cell loading", {}, { rows: mapCell(table.rows, 1, 1, { loading: true }) }],
  ["cell loading off", { rows: mapCell(table.rows, 1, 1, { loading: true }) }, {}],
  ["cell colspan", {}, { rows: mapCell(table.rows, 1, 1, { colspan: 3 }) }],
  ["cell colspan removed", { rows: mapCell(table.rows, 1, 1, { colspan: 3 }) }, {}],
  ["cell colspan 2->3", { rows: mapCell(table.rows, 1, 1, { colspan: 2 }) }, { rows: mapCell(table.rows, 1, 1, { colspan: 3 }) }],
  ["cell subItems added", {}, { rows: mapCell(table.rows, 1, 1, { subItems: table.rows[2].cells[0].subItems }) }],
  ["cell subItems removed", {}, { rows: mapCell(table.rows, 2, 0, { subItems: [] }) }],
  ["row loading", {}, { rows: mapRow(table.rows, 1, { loading: true }) }],
  ["row className", {}, { rows: mapRow(table.rows, 1, { className: "hot" }) }],
  ["row size", {}, { rows: mapRow(table.rows, 1, { size: 77 }) }],
  ["row isHeader", {}, { rows: mapRow(table.rows, 1, { isHeader: true }) }],
  ["columns className", { columns: { 1: { className: "a" } } }, { columns: { 1: { className: "b" } } }],
  ["columns style", { columns: { 1: { style: { color: "red" } } } }, { columns: { 1: { style: { color: "blue" } } } }],
  ["columns size", { columns: { 1: { size: 100 } } }, { columns: { 1: { size: 200 } } }],
  ["columns size removed", { columns: { 1: { size: 100 } } }, { columns: { 1: {} } }],
  ["columns loading", { columns: { 1: { loading: false } } }, { columns: { 1: { loading: true } } }],
  ["columns added", {}, { columns: { 1: { className: "a", size: 150 } } }],
  ["columns removed", { columns: { 1: { className: "a", size: 150 } } }, {}],
  ["columns moved", { columns: { 1: { className: "a", size: 150 } } }, { columns: { 2: { className: "a", size: 150 } } }],
  ["globalColumnProps className", { globalColumnProps: { className: "a" } }, { globalColumnProps: { className: "b" } }],
  [
    "globalColumnProps style",
    { globalColumnProps: { style: { color: "red" } } },
    { globalColumnProps: { style: { color: "blue" } } },
  ],
  ["globalColumnProps size", { globalColumnProps: { size: 100 } }, { globalColumnProps: { size: 150 } }],
  ["globalColumnProps added", {}, { globalColumnProps: { className: "b", size: 130 } }],
  ["globalRowProps size", { globalRowProps: { size: 50 } }, { globalRowProps: { size: 70 } }],
  ["globalRowProps added", {}, { globalRowProps: { size: 70 } }],
  ["rowsProps size", { rowsProps: { 2: { size: 50 } } }, { rowsProps: { 2: { size: 90 } } }],
  ["rowsProps moved", { rowsProps: { 2: { size: 50 } } }, { rowsProps: { 3: { size: 50 } } }],
  ["rowsProps removed", { rowsProps: { 2: { size: 50 } } }, {}],
  ["SubRowsToggleButtonComponent", { SubRowsToggleButtonComponent: Toggle }, { SubRowsToggleButtonComponent: OtherToggle }],
  ["SubRowsToggleButtonComponent added", {}, { SubRowsToggleButtonComponent: OtherToggle }],
  ["isSpan", {}, { isSpan: true }],
  ["isSpan off", { isSpan: true }, {}],
  ["id", {}, { id: "other" }],
  ["groups added", { columns: groupedColumns }, { columns: groupedColumns, groups }],
  ["groups removed", { columns: groupedColumns, groups }, { columns: groupedColumns }],
  [
    "groups label",
    { columns: groupedColumns, groups },
    { columns: groupedColumns, groups: [{ id: "g1", label: "ONE" }, groups[1]] },
  ],
  [
    "groupsProps size",
    { columns: groupedColumns, groups, groupsProps: { rowsOptions: { size: 30 } } },
    { columns: groupedColumns, groups, groupsProps: { rowsOptions: { size: 60 } } },
  ],
  [
    "groupsProps cell",
    { columns: groupedColumns, groups },
    { columns: groupedColumns, groups, groupsProps: { CustomGroupCell: GroupCell as never } },
  ],
  ["column groupId", { columns: groupedColumns, groups }, { columns: { ...groupedColumns, 3: { groupId: "g1" } }, groups }],
  ["keyboardNavigation on", {}, { keyboardNavigation: true }],
  ["keyboardNavigation off", { keyboardNavigation: true }, {}],
  ["ariaLabel", { ariaLabel: "a" }, { ariaLabel: "b" }],
  ["isSelectable on", { isSelectable: false }, { isSelectable: true }],
  ["isSelectable off", { isSelectable: true }, { isSelectable: false }],
  ["rows fewer", {}, { rows: table.rows.slice(0, 5) }],
  ["rows more", { rows: table.rows.slice(0, 5) }, {}],
  ["rows fewer columns", {}, { rows: table.rows.map((row) => ({ ...row, cells: row.cells.slice(0, 6) })) }],
  ["rows more columns", { rows: table.rows.map((row) => ({ ...row, cells: row.cells.slice(0, 6) })) }, {}],
  [
    "initial trees opened vs data",
    { initialOpenedTrees: { 2: { rowIndex: 2, columnIndex: 0 } } },
    { initialOpenedTrees: { 2: { rowIndex: 2, columnIndex: 0 } }, rows: mapCell(table.rows, 2, 1, { value: "X" }) },
  ],
];

const modes: [string, Partial<ITableProps>][] = [
  ["plain", { isSelectable: false }],
  ["virtualized", { isSelectable: false, isVirtualized: true, virtualizerProps: { height: 400, width: 900, minRowHeight: 40 } }],
  [
    "virtualized fixed",
    {
      isSelectable: false,
      isVirtualized: true,
      virtualizerProps: { height: 400, width: 900, minRowHeight: 40, fixedColumns: [0, 19], fixedRows: [0, 29] },
    },
  ],
  [
    "virtualized dense",
    { isSelectable: false, isVirtualized: true, virtualizerProps: { height: 400, width: 5000, minRowHeight: 40 } },
  ],
];

describe.each(modes)("held — runtime change equals fresh mount: %s", (_mode, modeProps) => {
  it.each(variations)("%s", (_name, before, after) => {
    const base = { ...table, ...modeProps, ...before } as ITableProps;
    const changed = { ...table, ...modeProps, ...after } as ITableProps;
    const { html, expected } = domAfterRerender(base, changed);
    expect(html).toBe(expected);
  });
});
