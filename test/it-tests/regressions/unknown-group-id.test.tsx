import { makeRows, mount } from "./harness";

/**
 * REVIEW FINDING — a column whose `groupId` is not (or no longer) in `groups` gets no group
 * cell at all: every group on its right is displayed one column too far to the left.
 * Present in 4.0.2 too (run during the review).
 *
 * `getColumnBranches` (src/components/utils/group.ts:102-105) skips the column instead of
 * giving it the default (empty) group. It happens when groups are removed at runtime while
 * the options of the columns still refer to them, or when `groupId` names a parent group.
 *
 * 8 columns: G1 on 0-1, an unknown group on 2, G2 on 3-4.
 * Expected: G1 x2, (empty) x1, G2 x2, (empty) x3 — 8 columns covered.
 * Observed: G1 x2, G2 x2, (empty) x3 — 7 columns: G2 is above columns 2-3 instead of 3-4.
 */
describe("review: column with an unknown group", () => {
  it("keeps the groups above their columns", () => {
    const table = mount({
      id: "t",
      rows: makeRows(30, 8),
      groups: [
        { id: "g1", label: "G1" },
        { id: "g2", label: "G2" },
      ],
      columns: {
        0: { groupId: "g1" },
        1: { groupId: "g1" },
        2: { groupId: "unknown" },
        3: { groupId: "g2" },
        4: { groupId: "g2" },
      },
      isVirtualized: true,
      isSelectable: false,
      virtualizerProps: { width: 800, height: 500, minColumnWidth: 100 },
    });
    const groups = Array.from(table.container.querySelectorAll("tr.table-groups-row")[0].children).map(
      (cell) => `${cell.textContent}x${(cell as HTMLTableCellElement).colSpan}`,
    );
    expect(table.columnIndexes()).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    // CORRECT: ["G1x2", "x1", "G2x2", "x3"]. Observed: ["G1x2", "G2x2", "x3"].
    expect(groups).toEqual(["G1x2", "x1", "G2x2", "x3"]);
  });
});
