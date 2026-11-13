import { expect, test } from "@playwright/test";

import {
  TOLERANCE,
  alignmentIssues,
  bodyRows,
  fixedEndColumnIssues,
  fixedEndRowIssues,
  headerRow,
  openStory,
  readTable,
  renderedColumns,
  scrollTable,
  windowIssues,
} from "./support/table-page";

const LAST_COLUMN = 39;
type Position = { left?: number | "max"; top?: number | "max" };
const POSITIONS: Position[] = [
  {},
  { left: 130 },
  { left: 777, top: 300 },
  { left: 2000 },
  { left: "max" },
  { top: "max" },
  { left: 0, top: 0 },
];

test.describe("columns fixed on the right", () => {
  test("stay against the right edge, aligned with their header, at every scroll position", async ({ page }) => {
    await openStory(page, "table-combinations--fixed-right-column");
    for (const position of POSITIONS) {
      await scrollTable(page, position);
      const snapshot = await readTable(page);
      const where = JSON.stringify(position);
      expect(fixedEndColumnIssues(snapshot, [LAST_COLUMN]), where).toEqual([]);
      expect(alignmentIssues(snapshot), where).toEqual([]);
      expect(windowIssues(snapshot), where).toEqual([]);
      expect(renderedColumns(snapshot)[0], where).toBe(0);
    }
  });

  test("stack without gap nor overlap when several columns and rows are fixed at the end", async ({ page }) => {
    await openStory(page, "table-combinations--several-fixed-end-items");
    for (const position of POSITIONS) {
      await scrollTable(page, position);
      const snapshot = await readTable(page);
      const where = JSON.stringify(position);
      expect(fixedEndColumnIssues(snapshot, [LAST_COLUMN - 2, LAST_COLUMN - 1, LAST_COLUMN]), where).toEqual([]);
      expect(fixedEndRowIssues(snapshot, 3), where).toEqual([]);
      expect(alignmentIssues(snapshot), where).toEqual([]);
      expect(windowIssues(snapshot), where).toEqual([]);
    }
    const snapshot = await readTable(page);
    const fixedRows = bodyRows(snapshot).filter((row) => row.position === "absolute");
    expect(fixedRows.map((row) => row.testId)).toEqual(["table-row-57", "table-row-58", "table-row-59"]);
    expect(fixedRows.map((row) => row.box.height)).toEqual([40, 60, 40]);
    const fixedColumns = fixedRows[0].cells.filter((cell) => cell.position === "absolute");
    expect(fixedColumns.map((cell) => cell.box.width)).toEqual([108, 140, 108]);
  });

  test("leave the last scrolling columns entirely displayed at the end of the scroll", async ({ page }) => {
    // columns of 40, 200, 600, 600, 220, 140 and 90 px in 1000 px, the first and the last ones fixed
    await openStory(page, "table-combinations--wide-columns-between-fixed-columns");
    await scrollTable(page, { left: "max" });
    const snapshot = await readTable(page);
    const cells = headerRow(snapshot).cells;
    const lastScrolling = cells.find((cell) => cell.column === 5);
    const fixedEnd = cells.find((cell) => cell.column === 6);

    expect(renderedColumns(snapshot)).toEqual([0, 4, 5, 6]);
    expect(lastScrolling?.box.width).toBe(140);
    // not under the fixed column, which stays against the right edge
    expect(lastScrolling?.box.right).toBeLessThanOrEqual((fixedEnd?.box.left ?? 0) + TOLERANCE);
    expect(Math.abs((fixedEnd?.box.right ?? 0) - snapshot.viewport.right)).toBeLessThanOrEqual(TOLERANCE);
    expect(alignmentIssues(snapshot)).toEqual([]);

    // the scroll bar stops at this window, 1400 px after the start (plus the room of the scroll bars):
    // one pixel before it, the window is the previous one
    expect(snapshot.scroll.maxLeft).toBeGreaterThanOrEqual(1400);
    expect(snapshot.scroll.maxLeft).toBeLessThan(1440);
    await scrollTable(page, { left: 1399 });
    expect(renderedColumns(await readTable(page))).toEqual([0, 3, 4, 5, 6]);
  });

  test("keep their place with a bottom fixed row and opened sub rows", async ({ page }) => {
    await openStory(page, "table-combinations--fixed-bottom-row-with-opened-sub-rows");
    for (const position of POSITIONS) {
      await scrollTable(page, position);
      const snapshot = await readTable(page);
      const where = JSON.stringify(position);
      expect(fixedEndColumnIssues(snapshot, [LAST_COLUMN]), where).toEqual([]);
      expect(fixedEndRowIssues(snapshot, 1), where).toEqual([]);
      expect(alignmentIssues(snapshot), where).toEqual([]);
      expect(renderedColumns(snapshot), where).not.toContain(4);
    }
  });
});
