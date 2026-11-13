import { merge } from "lodash";

import { ITrees } from "../../../src/components/table/elementary-table";
import { IRow } from "../../../src/components/table/row";
import { getAllIndexesMap, getIndexesMap, IIndexesMap, syncOpenedTreesWithRows } from "../../../src/components/utils/table";

/**
 * `getAllIndexesMap` runs each time the rows change: it is written as one pass over the rows.
 * The reference below is the definition it had before: the maps of each row, merged.
 */
const referenceIndexesMap = (trees: ITrees, rows: IRow[]): IIndexesMap =>
  rows.reduce<IIndexesMap>((result, _, rowIndex) => merge(result, getIndexesMap(trees, rowIndex, rows, null)), {
    absolute: {},
    relative: {},
  });

const createRandom = (seed: number) => {
  let state = seed;
  return (max: number) => {
    state = (state * 1664525 + 1013904223) | 0;
    return (state >>> 8) % Math.max(max, 1);
  };
};

/** Rows with sub rows on their first or second cell, down to three levels. */
function buildRows(pick: (max: number) => number, count: number, level = 0, prefix = "r"): IRow[] {
  return Array.from({ length: count }, (_, index) => {
    const id = `${prefix}${index}`;
    const subRowsCell = pick(2);
    const hasSubRows = level < 3 && pick(3) === 0;
    return {
      id,
      cells: [0, 1, 2].map((cell) => ({
        id: `${id}c${cell}`,
        value: `${id}:${cell}`,
        subItems: hasSubRows && cell === subRowsCell ? buildRows(pick, 1 + pick(3), level + 1, `${id}.`) : undefined,
      })),
    };
  });
}

/** Opened trees over the rows: some on rows with sub rows, some not, some out of the rows. */
function buildTrees(pick: (max: number) => number, rows: IRow[]): ITrees {
  const trees: ITrees = {};
  rows.forEach((row, rowIndex) => {
    if (pick(3) !== 0) return;
    const columnIndex = pick(2);
    const subRows = row.cells[columnIndex].subItems;
    trees[rowIndex] = { rowIndex, columnIndex, subTrees: subRows && pick(2) === 0 ? buildTrees(pick, subRows) : undefined };
  });
  if (pick(4) === 0) trees[rows.length + 2] = { rowIndex: rows.length + 2, columnIndex: 0 };
  return trees;
}

describe("getAllIndexesMap", () => {
  it.each([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])(
    "gives the merged maps of every row (random rows and trees, seed %i)",
    (seed) => {
      const pick = createRandom(seed);
      const rows = buildRows(pick, 4 + pick(30));
      const trees = buildTrees(pick, rows);

      expect(getAllIndexesMap(trees, rows)).toEqual(referenceIndexesMap(trees, rows));
    },
  );

  it("maps every row to itself without any opened row", () => {
    const rows = buildRows(createRandom(3), 5);
    expect(getAllIndexesMap({}, rows)).toEqual({
      absolute: Object.fromEntries(rows.map((_, index) => [index, { index, parentIndex: null }])),
      relative: Object.fromEntries(rows.map((_, index) => [index, { index }])),
    });
  });

  it("handles no rows", () => {
    expect(getAllIndexesMap({}, [])).toEqual({ absolute: {}, relative: {} });
    expect(getAllIndexesMap({ 0: { rowIndex: 0, columnIndex: 0 } }, [])).toEqual({ absolute: {}, relative: {} });
  });
});

describe("syncOpenedTreesWithRows", () => {
  const subRows: IRow[] = [
    { id: "a.0", cells: [{ id: "a.0c0", subItems: [{ id: "a.0.0", cells: [{ id: "a.0.0c0" }] }] }] },
    { id: "a.1", cells: [{ id: "a.1c0" }] },
  ];
  const rows: IRow[] = [
    { id: "a", cells: [{ id: "ac0", subItems: subRows }] },
    { id: "b", cells: [{ id: "bc0" }] },
    { id: "c", cells: [{ id: "cc0", subItems: [{ id: "c.0", cells: [{ id: "c.0c0" }] }] }] },
  ];

  it("returns the trees it was given when none has to be dropped", () => {
    const trees: ITrees = {
      0: { rowIndex: 0, columnIndex: 0, subTrees: { 0: { rowIndex: 0, columnIndex: 0 } } },
      2: { rowIndex: 2, columnIndex: 0 },
    };
    expect(syncOpenedTreesWithRows(trees, rows)).toBe(trees);
    expect(syncOpenedTreesWithRows({}, rows)).toEqual({});
  });

  it("drops the tree of a row without sub rows, and leaves the given trees untouched", () => {
    const trees: ITrees = {
      0: { rowIndex: 0, columnIndex: 0 },
      1: { rowIndex: 1, columnIndex: 0 },
      7: { rowIndex: 7, columnIndex: 0 },
    };
    const copy = JSON.parse(JSON.stringify(trees));

    const synced = syncOpenedTreesWithRows(trees, rows);

    expect(synced).toEqual({ 0: { rowIndex: 0, columnIndex: 0 } });
    expect(synced[0]).toBe(trees[0]);
    expect(trees).toEqual(copy);
  });

  it("drops a sub tree whose sub row has no sub rows, in a new tree", () => {
    const tree = {
      rowIndex: 0,
      columnIndex: 0,
      subTrees: { 0: { rowIndex: 0, columnIndex: 0 }, 1: { rowIndex: 1, columnIndex: 0 } },
    };
    const trees: ITrees = { 0: tree };

    const synced = syncOpenedTreesWithRows(trees, rows);

    expect(synced).toEqual({ 0: { rowIndex: 0, columnIndex: 0, subTrees: { 0: { rowIndex: 0, columnIndex: 0 } } } });
    // the given tree is not modified: it may be the state of a component
    expect(Object.keys(tree.subTrees)).toEqual(["0", "1"]);
  });
});
