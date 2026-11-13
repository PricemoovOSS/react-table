import * as React from "react";
import { act, fireEvent, render } from "@testing-library/react";

import Table, { ITableHandle, ITableProps } from "../../../src/components/table/table";
import { IRow } from "../../../src/components/table/row";

/** Review harness (adversarial review of 5.0, virtualization angle). Not a test file. */

export function makeRow(id: string, columns: number, subRows?: IRow[], subCell = 0): IRow {
  return {
    id,
    cells: Array.from(Array(columns), (_, cellIndex) => ({
      id: `c${cellIndex}`,
      value: `${id}:${cellIndex}`,
      ...(subRows && cellIndex === subCell ? { subItems: subRows } : {}),
    })),
  };
}

/** `rows` rows (the first one is the header) of `columns` cells. Ids: "r0" (header), "r1", … */
export function makeRows(rows: number, columns: number, prefix = "r"): IRow[] {
  return Array.from(Array(rows), (_, index) => ({ ...makeRow(`${prefix}${index}`, columns), isHeader: index === 0 }));
}

export interface IMounted {
  container: HTMLElement;
  handle: () => ITableHandle | null;
  rerender: (props: ITableProps) => void;
  unmount: () => void;
  scroller: () => HTMLElement | null;
  /** Sets the scroll position of the scroller and dispatches the scroll event, like a browser. */
  scroll: (target: { scrollTop?: number; scrollLeft?: number }) => void;
  /** Dispatches the scroll event for the current DOM position (what a browser does after a programmatic scroll). */
  flushScroll: () => void;
  rowIds: () => string[];
  /** aria-rowindex - 1 of every rendered row */
  rowIndexes: () => number[];
  /** aria-colindex - 1 of the cells of the first rendered row */
  columnIndexes: (rowPosition?: number) => number[];
  cellTexts: (rowPosition: number) => string[];
  signature: () => string;
  errors: jest.SpyInstance;
}

export function mount(props: ITableProps, wrap?: (node: React.ReactElement) => React.ReactElement): IMounted {
  // recorded, not printed: read them with `loggedErrors`
  const errors = jest.spyOn(console, "error").mockImplementation(() => {});
  const ref = React.createRef<ITableHandle>();
  const tree = (tableProps: ITableProps) => {
    const node = <Table ref={ref} {...tableProps} />;
    return wrap ? wrap(node) : node;
  };
  const view = render(tree(props));
  const { container } = view;
  const scroller = () => container.querySelector<HTMLElement>("[data-testid='scroller-container']");
  const rows = () => Array.from(container.querySelectorAll<HTMLElement>("tr.table-row:not(.table-groups-row)"));
  const cellsOf = (row: Element) => Array.from(row.querySelectorAll<HTMLElement>(":scope > [data-testid='table-column']"));
  return {
    container,
    handle: () => ref.current,
    rerender: (next) => view.rerender(tree(next)),
    unmount: view.unmount,
    scroller,
    scroll: (target) => {
      const node = scroller();
      if (!node) throw new Error("no scroller");
      act(() => void fireEvent.scroll(node, { target }));
    },
    flushScroll: () => {
      const node = scroller();
      if (node) act(() => void fireEvent.scroll(node));
    },
    rowIds: () => rows().map((row) => (row.getAttribute("data-testid") || "").replace(/^table-(row|header)-/, "")),
    rowIndexes: () => rows().map((row) => Number(row.getAttribute("aria-rowindex")) - 1),
    columnIndexes: (rowPosition = 0) => {
      const row = rows()[rowPosition];
      return row ? cellsOf(row).map((cell) => Number(cell.getAttribute("aria-colindex")) - 1) : [];
    },
    cellTexts: (rowPosition) => {
      const row = rows()[rowPosition];
      return row ? cellsOf(row).map((cell) => cell.textContent || "") : [];
    },
    signature: () => serialize(scroller() || container),
    errors,
  };
}

/**
 * The element as text, whatever its history: attributes and style declarations sorted, the
 * `style=""` React leaves behind dropped.
 */
function serialize(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent || "";
  if (node.nodeType !== Node.ELEMENT_NODE) return "";
  const element = node as Element;
  const attributes = Array.from(element.attributes)
    .map(({ name, value }) => {
      if (name !== "style") return `${name}="${value}"`;
      const declarations = value
        .split(";")
        .map((declaration) => declaration.trim())
        .filter(Boolean)
        .sort();
      return declarations.length ? `style="${declarations.join("; ")}"` : "";
    })
    .filter(Boolean)
    .sort();
  const tag = element.tagName.toLowerCase();
  return `<${[tag, ...attributes].join(" ")}>${Array.from(element.childNodes).map(serialize).join("")}</${tag}>`;
}

/** Messages of the errors logged through console.error (React warnings included). */
export const loggedErrors = (errors: jest.SpyInstance): string[] =>
  errors.mock.calls.map((call) =>
    call
      .map((part: unknown) => String(part))
      .join(" ")
      .slice(0, 300),
  );
