import { expect, test } from "@playwright/test";

import {
  alignmentIssues,
  bodyRows,
  fixedEndColumnIssues,
  fixedEndRowIssues,
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
