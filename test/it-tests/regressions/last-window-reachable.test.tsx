import { ITableProps } from "../../../src/components/table/table";
import { IMounted, makeRows, mount } from "./harness";

/**
 * Found with 5.0.0-beta in an application: at the end of the horizontal scroll, the last column was cut
 * by the edge of the window, or left out of it behind a column fixed at the end.
 *
 * The window shows whole items from its first one. The last items are entirely displayed from the
 * position of the first item of the last window only, and the scroll range has to reach it. It stopped
 * at the size of the items minus the window, which is before that position as soon as the last items
 * do not fill the window exactly. (4.x reached it, with a range twice too long.)
 */
const sizesOf = (sizes: (number | undefined)[]) =>
  Object.fromEntries(sizes.flatMap((size, index) => (size ? [[index, { size }]] : [])));

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

type Axis = "columns" | "rows";

interface IItem {
  index: number;
  size: number;
}

/** Last position of the scroll bar, read from the element that gives the scroller its range. */
function scrollEnd(table: IMounted, axis: Axis, windowSize: number): number {
  const style = table.container.querySelector<HTMLElement>(".scroller-scrollbar")?.style;
  const range = parseInt((axis === "columns" ? style?.minWidth : style?.minHeight) || "0", 10);
  return Math.max(axis === "columns" ? range - windowSize : range, 0);
}

/** The items the table displays on an axis, with the size written on them. */
function displayedItems(table: IMounted, axis: Axis): IItem[] {
  const rows = Array.from(table.container.querySelectorAll<HTMLElement>("tr.table-row:not(.table-groups-row)"));
  if (axis === "rows") {
    return rows.map((row) => ({ index: Number(row.getAttribute("aria-rowindex")) - 1, size: parseFloat(row.style.height) }));
  }
  return Array.from(rows[0]?.querySelectorAll<HTMLElement>(":scope > [data-testid='table-column']") ?? []).map((cell) => ({
    index: Number(cell.getAttribute("aria-colindex")) - 1,
    size: parseFloat(cell.style.width),
  }));
}

interface ILayout {
  axis: Axis;
  /** Size of the window on this axis */
  windowSize: number;
  length: number;
  fixed?: number[];
  hidden?: number[];
}

/**
 * Scrolls the whole range, a few pixels at a time, and returns the scrolling items that were never
 * entirely displayed: in the window, and ending before the room left by the fixed items runs out.
 * An item cut by less than the margin of the window (10 px, or the rounding of the sizes) counts in.
 */
function neverEntirelyDisplayed(table: IMounted, { axis, windowSize, length, fixed = [], hidden = [] }: ILayout): number[] {
  const end = scrollEnd(table, axis, windowSize);
  const reached = new Set<number>();
  for (let position = 0; position <= end + 15; position += 15) {
    table.scroll(axis === "columns" ? { scrollLeft: Math.min(position, end) } : { scrollTop: Math.min(position, end) });
    const items = displayedItems(table, axis);
    const available = windowSize - sum(items.filter((item) => fixed.includes(item.index)).map((item) => item.size));
    let used = 0;
    items
      .filter((item) => !fixed.includes(item.index))
      .forEach((item) => {
        used += item.size;
        if (used <= available + 10 + items.length || used === item.size) reached.add(item.index);
      });
  }
  return Array.from(Array(length), (_, index) => index).filter(
    (index) => !fixed.includes(index) && !hidden.includes(index) && !reached.has(index),
  );
}

describe("the end of the scroll range displays the last items entirely", () => {
  it("columns of different sizes between a column fixed on each side", () => {
    // selection, name, two wide formulas, lists, scope, actions
    const sizes = [40, 200, 600, 600, 220, 140, 90];
    const table = mount({
      id: "t",
      rows: makeRows(30, sizes.length),
      columns: sizesOf(sizes),
      isVirtualized: true,
      isSelectable: false,
      virtualizerProps: { width: 1400, height: 500, fixedRows: [0], fixedColumns: [0, 6] },
    });
    const end = scrollEnd(table, "columns", 1400);

    table.scroll({ scrollLeft: end });
    // 1270 px between the fixed columns: the last three scrolling columns (960 px) fit, not the last four
    expect(table.columnIndexes()).toEqual([0, 3, 4, 5, 6]);
    // and the range stops there: one pixel before, the window is the previous one
    expect(end).toBe(800);
    table.scroll({ scrollLeft: end - 1 });
    expect(table.columnIndexes()).toEqual([0, 2, 3, 4, 6]);
  });

  it("columns of different sizes without any fixed column", () => {
    const sizes = [200, 150, 300, 250, 180, 120, 160];
    const table = mount({
      id: "t",
      rows: makeRows(30, sizes.length),
      columns: sizesOf(sizes),
      isVirtualized: true,
      isSelectable: false,
      virtualizerProps: { width: 680, height: 500 },
    });

    table.scroll({ scrollLeft: scrollEnd(table, "columns", 680) });
    // 250 + 180 + 120 + 160 = 710 px do not fit in 680 px, the last three columns do
    expect(table.columnIndexes()).toEqual([4, 5, 6]);
  });

  it("rows of different sizes under a fixed header", () => {
    const sizes = [40, 120, 300, 90, 260, 70, 180, 110];
    const table = mount({
      id: "t",
      rows: makeRows(sizes.length, 4),
      rowsProps: sizesOf(sizes),
      isVirtualized: true,
      isSelectable: false,
      virtualizerProps: { width: 500, height: 440, fixedRows: [0] },
    });

    table.scroll({ scrollTop: scrollEnd(table, "rows", 440) });
    // 400 px under the header: 70 + 180 + 110 fit, not 260 more
    expect(table.rowIndexes()).toEqual([0, 5, 6, 7]);
  });

  it("columns that fill the last window exactly keep the range of their sizes", () => {
    const table = mount({
      id: "t",
      rows: makeRows(30, 30),
      columns: sizesOf(Array.from(Array(30), () => 150)),
      isVirtualized: true,
      isSelectable: false,
      virtualizerProps: { width: 900, height: 500 },
    });
    expect(scrollEnd(table, "columns", 900)).toBe(3600);
  });

  it("rows without a size of their own keep a full window at the end, its last row cut by the rounding", () => {
    // 1000 px for rows of 30 px at least: 33 rows of 31 px (1000 / 33 rounded up), 23 px more than the window
    const table = mount({
      id: "t",
      rows: makeRows(100, 4),
      isVirtualized: true,
      isSelectable: false,
      virtualizerProps: { width: 500, height: 1000, minRowHeight: 30 },
    });
    const end = scrollEnd(table, "rows", 1000);

    table.scroll({ scrollTop: end });
    expect(end).toBe(100 * 31 - 1000);
    expect(table.rowIndexes()).toHaveLength(33);
    expect(table.rowIndexes().slice(-1)).toEqual([99]);
  });
});

describe("every row and column can be scrolled into the window", () => {
  // selection and a small action fixed at the start, wide and narrow columns, a group over the last ones
  const COLUMN_SIZES = [40, 50, 200, 600, 600, 120, 180, 220, 140, 320, 160, 110, 260, 90];
  const LAST_COLUMN = COLUMN_SIZES.length - 1;
  const ROW_SIZES = [36, undefined, undefined, 120, undefined, undefined, undefined, undefined, undefined, undefined, 200, 30];
  const ROWS = 40;
  const LAST_ROW = ROWS - 1;
  const WIDTH = 1100;
  const HEIGHT = 520;
  const groups = [
    { id: "identity", label: "Identity" },
    { id: "formulas", label: "Formulas" },
    { id: "end", label: "Stock and actions" },
  ];
  const groupOf = (column: number) => {
    if (column <= 2) return "identity";
    if (column <= 4) return "formulas";
    return column >= 10 ? "end" : undefined;
  };
  const columnsOf = (sizes: (number | undefined)[], withGroups: boolean) =>
    Object.fromEntries(
      sizes.map((size, column) => [column, { ...(size ? { size } : {}), ...(withGroups ? { groupId: groupOf(column) } : {}) }]),
    );

  interface IMix {
    sizes?: (number | undefined)[];
    rowSizes?: (number | undefined)[];
    withGroups?: boolean;
    fixedColumns?: number[];
    hiddenColumns?: number[];
    fixedRows?: number[];
    hiddenRows?: number[];
  }

  const propsOf = ({
    sizes = COLUMN_SIZES,
    rowSizes = ROW_SIZES,
    withGroups = false,
    fixedColumns = [],
    hiddenColumns = [],
    fixedRows = [0],
    hiddenRows = [],
  }: IMix): ITableProps => ({
    id: "t",
    rows: makeRows(ROWS, COLUMN_SIZES.length),
    columns: columnsOf(sizes, withGroups),
    rowsProps: sizesOf(rowSizes),
    groups: withGroups ? groups : undefined,
    groupsProps: withGroups ? { rowsOptions: { size: 30 } } : undefined,
    isVirtualized: true,
    isSelectable: false,
    virtualizerProps: { width: WIDTH, height: HEIGHT, minRowHeight: 40, fixedColumns, hiddenColumns, fixedRows, hiddenRows },
  });

  /** Both axes scrolled from one end to the other: the items that could not be displayed entirely. */
  const unreachable = (
    table: IMounted,
    { fixedColumns = [], hiddenColumns = [], fixedRows = [0], hiddenRows = [], withGroups }: IMix,
  ) => ({
    columns: neverEntirelyDisplayed(table, {
      axis: "columns",
      windowSize: WIDTH,
      length: COLUMN_SIZES.length,
      fixed: fixedColumns,
      hidden: hiddenColumns,
    }),
    rows: neverEntirelyDisplayed(table, {
      axis: "rows",
      // the rows of the groups stay above the window of the rows
      windowSize: HEIGHT - (withGroups ? 30 : 0),
      length: ROWS,
      fixed: fixedRows,
      hidden: hiddenRows,
    }),
  });

  const MIXES: [string, IMix][] = [
    ["sizes only", {}],
    ["a group over the last columns", { withGroups: true }],
    ["a group over the last columns, the last one fixed", { withGroups: true, fixedColumns: [LAST_COLUMN] }],
    ["small columns fixed at the start, wide ones scrolling", { fixedColumns: [0, 1] }],
    ["small columns fixed at the start and one at the end", { fixedColumns: [0, 1, LAST_COLUMN] }],
    ["fixed, hidden and grouped columns", { withGroups: true, fixedColumns: [0, 1, LAST_COLUMN], hiddenColumns: [6, 9] }],
    ["a wide column hidden, another one fixed", { fixedColumns: [0, 3], hiddenColumns: [4] }],
    ["the last columns hidden", { fixedColumns: [0], hiddenColumns: [11, 12, LAST_COLUMN] }],
    ["columns without a size of their own", { sizes: [], withGroups: true, fixedColumns: [0, LAST_COLUMN], hiddenColumns: [6] }],
    [
      "sized and unsized columns",
      { sizes: COLUMN_SIZES.map((size, column) => (column % 3 ? size : undefined)), fixedColumns: [0, LAST_COLUMN] },
    ],
    ["rows fixed at the top and at the bottom, hidden rows", { fixedRows: [0, LAST_ROW], hiddenRows: [5, 11, LAST_ROW - 1] }],
    ["tall rows at the end", { rowSizes: [...Array(ROWS - 3).fill(undefined), 150, 230, 70], fixedRows: [0] }],
    ["rows without a size of their own", { rowSizes: [], fixedRows: [0, LAST_ROW], hiddenRows: [3] }],
    [
      "everything together",
      {
        withGroups: true,
        fixedColumns: [0, 1, LAST_COLUMN],
        hiddenColumns: [6, 9],
        fixedRows: [0, LAST_ROW],
        hiddenRows: [5, LAST_ROW - 1],
      },
    ],
  ];

  it.each(MIXES)("%s", (_, mix) => {
    const table = mount(propsOf(mix));
    expect(unreachable(table, mix)).toEqual({ columns: [], rows: [] });
  });

  it("after sizes, hidden and fixed items change while the table is scrolled to its end", () => {
    const steps: IMix[] = [
      { withGroups: true, fixedColumns: [0, 1, LAST_COLUMN], fixedRows: [0, LAST_ROW] },
      // two columns get hidden
      { withGroups: true, fixedColumns: [0, 1, LAST_COLUMN], hiddenColumns: [6, 9], fixedRows: [0, LAST_ROW] },
      // the column fixed at the end is released, a wide one gets fixed
      { withGroups: true, fixedColumns: [0, 1, 3], hiddenColumns: [6, 9], fixedRows: [0, LAST_ROW] },
      // columns are resized: the wide ones narrower, the last ones wider
      {
        withGroups: true,
        sizes: COLUMN_SIZES.map((size, column) => (column === 3 || column === 4 ? 180 : column >= 10 ? size * 2 : size)),
        fixedColumns: [0, 1, 3],
        hiddenColumns: [6, 9],
        fixedRows: [0, LAST_ROW],
      },
      // rows are resized and hidden, the bottom row is released
      { rowSizes: [36, 90, undefined, 60, 300], hiddenRows: [2, 20, 21], fixedColumns: [0, LAST_COLUMN] },
      // everything back to the sizes of the table
      { sizes: [], rowSizes: [] },
    ];
    const table = mount(propsOf(steps[0]));

    steps.forEach((step, position) => {
      table.rerender(propsOf(step));
      expect({ step: position, ...unreachable(table, step) }).toEqual({ step: position, columns: [], rows: [] });
      // left at the end of both axes for the next change
      table.scroll({ scrollLeft: scrollEnd(table, "columns", WIDTH), scrollTop: scrollEnd(table, "rows", HEIGHT) });
    });
  });

  const createRandom = (seed: number) => {
    let state = seed;
    return (max: number) => {
      state = (state * 1664525 + 1013904223) | 0;
      return (state >>> 8) % Math.max(max, 1);
    };
  };

  it.each([3, 17, 42, 256, 1999, 2024, 31337, 65521, 90001, 123457])(
    "random sizes, fixed and hidden items on both axes (seed %i)",
    (seed) => {
      const pick = createRandom(seed);
      const some = (length: number, count: number, among: (index: number) => boolean) =>
        Array.from(Array(count), () => pick(length)).filter(
          (index, position, all) => among(index) && all.indexOf(index) === position,
        );
      const columnsLength = 6 + pick(18);
      const rowsLength = 12 + pick(30);
      // one item out of four keeps the size of the table
      const sizes = Array.from(Array(columnsLength), () => (pick(4) ? 40 + 10 * pick(57) : undefined));
      const rowSizes = Array.from(Array(rowsLength), () => (pick(4) ? 30 + 10 * pick(20) : undefined));
      const fixedColumns = [
        ...(pick(2) ? [0] : []),
        ...(pick(2) ? [columnsLength - 1] : []),
        ...some(columnsLength, pick(2), () => true),
      ].filter((index, position, all) => all.indexOf(index) === position);
      const hiddenColumns = some(columnsLength, pick(4), (index) => !fixedColumns.includes(index));
      const fixedRows = [0, ...(pick(2) ? [rowsLength - 1] : [])];
      const hiddenRows = some(rowsLength, pick(4), (index) => !fixedRows.includes(index));
      // room for the scrolling items next to the fixed ones (160 px for a fixed item without a size)
      const width = sum(fixedColumns.map((index) => sizes[index] ?? 160)) + 300 + 10 * pick(60);
      const height = sum(fixedRows.map((index) => rowSizes[index] ?? 60)) + 250 + 10 * pick(40);
      const table = mount({
        id: "t",
        rows: makeRows(rowsLength, columnsLength),
        columns: sizesOf(sizes),
        rowsProps: sizesOf(rowSizes),
        isVirtualized: true,
        isSelectable: false,
        virtualizerProps: {
          width,
          height,
          minRowHeight: 40,
          minColumnWidth: 100,
          fixedColumns,
          hiddenColumns,
          fixedRows,
          hiddenRows,
        },
      });

      expect({
        columns: neverEntirelyDisplayed(table, {
          axis: "columns",
          windowSize: width,
          length: columnsLength,
          fixed: fixedColumns,
          hidden: hiddenColumns,
        }),
        rows: neverEntirelyDisplayed(table, {
          axis: "rows",
          windowSize: height,
          length: rowsLength,
          fixed: fixedRows,
          hidden: hiddenRows,
        }),
      }).toEqual({ columns: [], rows: [] });
      table.unmount();
    },
  );
});
