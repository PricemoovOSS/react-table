import * as React from "react";
import * as fs from "fs";
import * as path from "path";
import { createHash } from "crypto";
import { act, fireEvent, render } from "@testing-library/react";

import Table, { ITableHandle, ITableProps } from "../../src/components/table/table";
import { ITrees } from "../../src/components/table/elementary-table";
import { generateTable, generateTableWithCustomColspan } from "../../stories/utils/tables";

/**
 * Structure of the rendered table (rows, cells, classes, inline sizes and positions) for
 * combinations of fixed, hidden, grouped, opened and resized items, at several scroll
 * positions. The reference was recorded on the 4.0.2 release and is identical to it, except:
 * - "remove groups": 4.0.2 applied the new row height one render late;
 * - the classes listed in ADDED_CLASSES, which 4.0.2 did not have and are ignored here;
 * - scenario C, every state: the scroll range. 4.0.2 counted twice the sizes given to the
 *   scrolling rows and columns, which left a part of the scroll bar without effect.
 *
 * An intended change of structure: run with UPDATE_DOM_STRUCTURE=1 and review the diff.
 */
const REFERENCE = path.join(__dirname, "__fixtures__", "dom-structure.json");
const COLUMNS = 40;
const ROWS = 60;
const LAST = COLUMNS - 1;

type TableProps = ITableProps;
type Step = { label: string; run: (context: IContext) => void };
interface IContext {
  scroller: HTMLElement;
  handle: React.RefObject<ITableHandle>;
  props: TableProps;
  rerender: (props: TableProps) => void;
}

const GROUPS = [
  { id: "g1", label: "G1" },
  {
    id: "g2",
    label: "G2",
    subGroups: [
      { id: "g2a", label: "G2a" },
      { id: "g2b", label: "G2b" },
    ],
  },
  { id: "g3", label: "G3" },
  { id: "g4", label: "G4" },
];

function groupedColumns(sizes: Record<number, number> = {}) {
  const columns: Record<number, { groupId?: string; size?: number }> = { [LAST]: { groupId: "g4" } };
  [0, 1].forEach((column) => (columns[column] = { groupId: "g1" }));
  [2, 3, 4].forEach((column) => (columns[column] = { groupId: "g2a" }));
  [5, 6, 7].forEach((column) => (columns[column] = { groupId: "g2b" }));
  [8, 9, 10, 11, 12].forEach((column) => (columns[column] = { groupId: "g3" }));
  Object.keys(sizes).forEach((column) => {
    columns[Number(column)] = { ...columns[Number(column)], size: sizes[Number(column)] };
  });
  return columns;
}

const styleOf = (element: Element | null | undefined) =>
  (element?.getAttribute("style") || "")
    .split(";")
    .map((declaration) => declaration.trim())
    .filter(Boolean)
    .sort()
    .join("; ");

/** Classes added since the reference was recorded: checked by their own tests, ignored here. */
const ADDED_CLASSES = ["elevated-absolute-edge", "elevated-start-edge"];

const classesOf = (element: Element) =>
  (element.getAttribute("class") || "")
    .split(/\s+/)
    .filter((name) => name && !ADDED_CLASSES.includes(name))
    .sort()
    .join(" ");

function serialise(container: HTMLElement) {
  const scroller = container.querySelector(".scroller-container");
  const table = container.querySelector(".table-root") as HTMLElement;
  return {
    scroller: styleOf(scroller),
    content: styleOf(scroller?.querySelector(".scroller-content")),
    spacer: styleOf(scroller?.querySelector(".scroller-scrollbar")),
    rows: Array.from(table.querySelectorAll("tr")).map((row) => ({
      cls: classesOf(row),
      style: styleOf(row),
      section: row.parentElement?.tagName ?? "",
      cells: Array.from(row.children).map((cell) => ({
        tag: cell.tagName,
        cls: classesOf(cell),
        colSpan: (cell as HTMLTableCellElement).colSpan,
        rowSpan: (cell as HTMLTableCellElement).rowSpan,
        style: styleOf(cell),
        wrapper: styleOf(cell.querySelector(".table-overflow-wrapper")),
        container: classesOf(cell.querySelector(".table-cell-container") || cell),
        toggle: !!cell.querySelector(".table-cell-sub-item-toggle"),
        text: (cell.textContent || "").trim(),
      })),
    })),
  };
}

const scrollTo = (left: number | null, top: number | null): Step => ({
  label: `scroll(${left},${top})`,
  run: ({ scroller }) => {
    const target: { scrollLeft?: number; scrollTop?: number } = {};
    if (left !== null) target.scrollLeft = left;
    if (top !== null) target.scrollTop = top;
    fireEvent.scroll(scroller, { target });
  },
});
const openTrees = (label: string, trees: ITrees): Step => ({ label, run: ({ handle }) => handle.current?.openTrees(trees) });
const closeTrees = (label: string, trees: ITrees): Step => ({ label, run: ({ handle }) => handle.current?.closeTrees(trees) });
const setProps = (label: string, update: (props: TableProps) => TableProps): Step => ({
  label,
  run: (context) => context.rerender(update(context.props)),
});
const setVirtualizerProps = (label: string, virtualizerProps: TableProps["virtualizerProps"]): Step =>
  setProps(label, (props) => ({ ...props, virtualizerProps: { ...props.virtualizerProps, ...virtualizerProps } }));

const SCROLLS: Step[] = [
  scrollTo(130, null),
  scrollTo(777, null),
  scrollTo(2000, null),
  scrollTo(99999, null),
  scrollTo(null, 300),
  scrollTo(null, 999999),
  scrollTo(777, 900),
  scrollTo(0, 0),
];
const ROW_2 = { 2: { rowIndex: 2, columnIndex: 0 } };
const TREES: Step[] = [
  openTrees("open row 2", ROW_2),
  scrollTo(null, 200),
  openTrees("open nested", { 2: { rowIndex: 2, columnIndex: 0, subTrees: ROW_2 } }),
  scrollTo(null, 1500),
  scrollTo(777, 2500),
  scrollTo(null, 999999),
  scrollTo(0, 0),
  closeTrees("close row 2", ROW_2),
];

const tableWithSubRows = () => generateTable(ROWS, COLUMNS, {}, true);
const window1000x500 = (virtualizerProps: TableProps["virtualizerProps"]) => ({
  height: 500,
  width: 1000,
  minRowHeight: 40,
  ...virtualizerProps,
});

const SCENARIOS: Record<string, { props: Partial<TableProps> & Pick<TableProps, "id" | "rows">; steps: Step[] }> = {
  "A groups+fixedLeftRight+hiddenCols+hiddenRows+subRows": {
    props: {
      ...tableWithSubRows(),
      groups: GROUPS,
      groupsProps: { rowsOptions: { size: 30 } },
      columns: groupedColumns(),
      virtualizerProps: window1000x500({ fixedRows: [0], fixedColumns: [0, 1, LAST], hiddenColumns: [4, 9], hiddenRows: [5] }),
    },
    steps: [
      ...SCROLLS,
      ...TREES,
      setVirtualizerProps("hide more columns", { hiddenColumns: [2, 3, 4, 9, 20] }),
      scrollTo(400, null),
      setVirtualizerProps("unfix right column", { fixedColumns: [0, 1] }),
      setVirtualizerProps("fix 3 right columns", { fixedColumns: [0, LAST - 2, LAST - 1, LAST] }),
      scrollTo(99999, null),
      setProps("remove groups", (props) => ({ ...props, groups: undefined })),
      setProps("new rows without sub rows", (props) => ({ ...props, rows: generateTable(ROWS, COLUMNS, {}, false).rows })),
    ],
  },
  "B fixedTopBottomRows+fixedRight+openedTree": {
    props: {
      ...tableWithSubRows(),
      initialOpenedTrees: ROW_2,
      virtualizerProps: window1000x500({ fixedRows: [0, ROWS - 1], fixedColumns: [0, LAST], hiddenColumns: [4] }),
    },
    steps: [
      ...SCROLLS,
      ...TREES,
      setVirtualizerProps("3 bottom fixed rows", { fixedRows: [0, ROWS - 3, ROWS - 2, ROWS - 1] }),
      scrollTo(null, 600),
    ],
  },
  "C customSizes+isSpan+groups+fixed": {
    props: {
      ...tableWithSubRows(),
      isSpan: true,
      groups: GROUPS,
      columns: groupedColumns({ 0: 180, 3: 60, [LAST]: 140 }),
      rowsProps: { 0: { size: 60 }, 7: { size: 90 } },
      virtualizerProps: window1000x500({ fixedRows: [0], fixedColumns: [0, LAST], hiddenColumns: [6] }),
    },
    steps: [...SCROLLS, ...TREES],
  },
  "D colspan+fixed+hidden": {
    props: {
      ...generateTableWithCustomColspan(ROWS, COLUMNS, true),
      virtualizerProps: window1000x500({ fixedRows: [0], fixedColumns: [0, LAST], hiddenColumns: [3] }),
    },
    steps: [...SCROLLS],
  },
  "E fixSubRows+scrollbarSize+rowsCount/columnsCount": {
    props: (() => {
      const table = tableWithSubRows();
      table.rows[2].fixSubRows = true;
      const virtualizerProps = { height: 600, width: 1200, rowsCount: 14, columnsCount: 9, scrollbarSize: 6 };
      return { ...table, virtualizerProps: { ...virtualizerProps, fixedRows: [0], fixedColumns: [1] } };
    })(),
    steps: [...SCROLLS, ...TREES],
  },
  "F selectable+initialScroll": {
    props: {
      ...tableWithSubRows(),
      isSelectable: true,
      virtualizerProps: window1000x500({ fixedRows: [0], fixedColumns: [0], initialScroll: { columnIndex: 12, rowIndex: 20 } }),
    },
    steps: [scrollTo(130, null), scrollTo(null, 300)],
  },
  "G not virtualized + groups + sub rows": {
    props: {
      ...generateTable(8, 6, {}, true),
      isVirtualized: false,
      groups: [{ id: "g1", label: "G1" }],
      columns: { 0: { groupId: "g1" }, 1: { groupId: "g1" } },
    },
    steps: [openTrees("open row 2", ROW_2), closeTrees("close row 2", ROW_2)],
  },
};

const hash = (value: unknown) => createHash("sha1").update(JSON.stringify(value)).digest("hex").slice(0, 16);

function play(name: string): Record<string, string> {
  const scenario = SCENARIOS[name];
  const handle = React.createRef<ITableHandle>();
  const initialProps: TableProps = { isSelectable: false, isVirtualized: true, ...scenario.props };
  const view = render(<Table {...initialProps} ref={handle} />);
  const getScroller = () => view.container.querySelector(".scroller-container") as HTMLElement;
  const context: IContext = {
    handle,
    props: initialProps,
    scroller: getScroller(),
    rerender: (props) => {
      context.props = props;
      view.rerender(<Table {...props} ref={handle} />);
    },
  };
  const states: Record<string, string> = { "0 initial": hash(serialise(view.container)) };
  scenario.steps.forEach((step, index) => {
    act(() => step.run(context));
    context.scroller = getScroller();
    states[`${index + 1} ${step.label}`] = hash(serialise(view.container));
  });
  view.unmount();
  return states;
}

describe("structure of the rendered table", () => {
  const update = process.env.UPDATE_DOM_STRUCTURE === "1";
  const reference: Record<string, Record<string, string>> = fs.existsSync(REFERENCE)
    ? JSON.parse(fs.readFileSync(REFERENCE, "utf8"))
    : {};
  const recorded: Record<string, Record<string, string>> = {};

  Object.keys(SCENARIOS).forEach((name) => {
    it(name, () => {
      recorded[name] = play(name);
      if (update) return;
      const changed = Object.keys(recorded[name]).filter((state) => recorded[name][state] !== reference[name]?.[state]);
      expect(changed).toEqual([]);
    });
  });

  afterAll(() => {
    if (update) fs.writeFileSync(REFERENCE, `${JSON.stringify(recorded, null, 2)}\n`);
  });
});
