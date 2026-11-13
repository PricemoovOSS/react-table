import { expect, test } from "@playwright/test";

import {
  alignmentIssues,
  fixedEndColumnIssues,
  groupIssues,
  groupRows,
  IExpectedGroup,
  openStory,
  readTable,
  renderedColumns,
  scrollTable,
  settle,
  windowIssues,
} from "./support/table-page";

const LAST_COLUMN = 39;
const STORY = "table-combinations--groups-fixed-and-hidden";

/** Groups of the story, per column and per depth (see combinations.stories.tsx). */
function expectedGroup(column: number, depth: number): IExpectedGroup {
  let leaf = "none";
  if (column <= 1) leaf = "g1";
  else if (column <= 4) leaf = "g2a";
  else if (column <= 7) leaf = "g2b";
  else if (column <= 12) leaf = "g3";
  else if (column === LAST_COLUMN) leaf = "g4";
  if (depth === 0) {
    const top = leaf.startsWith("g2") ? "g2" : leaf;
    const labels: Record<string, string> = { g1: "G1 (0-1)", g2: "G2 (2-7)", g3: "G3 (8-12)", g4: "G4 (last)", none: "" };
    return { key: top, label: labels[top] };
  }
  const labels: Record<string, string> = { g2a: "G2a (2-4)", g2b: "G2b (5-7)" };
  return { key: leaf, label: labels[leaf] || "" };
}

const check = async (page: import("@playwright/test").Page, where: string) => {
  const snapshot = await readTable(page);
  expect(groupIssues(snapshot, expectedGroup), where).toEqual([]);
  expect(fixedEndColumnIssues(snapshot, [LAST_COLUMN]), where).toEqual([]);
  expect(alignmentIssues(snapshot), where).toEqual([]);
  expect(windowIssues(snapshot), where).toEqual([]);
  expect(
    groupRows(snapshot).map((row) => row.box.height),
    where,
  ).toEqual([30, 30]);
  expect(renderedColumns(snapshot), where).not.toContain(4);
  expect(renderedColumns(snapshot), where).not.toContain(9);
  return snapshot;
};

test.describe("column groups with fixed and hidden columns", () => {
  test("group headers follow their columns while scrolling horizontally", async ({ page }) => {
    await openStory(page, STORY);
    for (const left of [0, 50, 130, 400, 777, 2000, "max", 0] as const) {
      await scrollTable(page, { left });
      await check(page, `scrollLeft=${left}`);
    }
  });

  test("the group of a right fixed column stays above it", async ({ page }) => {
    await openStory(page, STORY);
    const snapshot = await check(page, "initial");
    const group = groupRows(snapshot)[0].cells.find((cell) => cell.text === "G4 (last)");
    expect(group?.position).toBe("absolute");
    expect(group?.box.right).toBeCloseTo(snapshot.viewport.right, 0);
  });

  test("stay correct with sub rows opened, nested, scrolled and closed", async ({ page }) => {
    await openStory(page, STORY);
    const act = async (script: string, where: string) => {
      await page.evaluate(script);
      await settle(page);
      await check(page, where);
    };
    await act(`window.tableHandle.openTrees({ 2: { rowIndex: 2, columnIndex: 0 } })`, "row 2 opened");
    await act(
      `window.tableHandle.openTrees({ 2: { rowIndex: 2, columnIndex: 0, subTrees: { 2: { rowIndex: 2, columnIndex: 0 } } } })`,
      "nested rows opened",
    );
    for (const position of [{ top: 200 }, { top: 1500 }, { left: 777, top: 900 }, { top: "max" as const }]) {
      await scrollTable(page, position);
      await check(page, `opened, ${JSON.stringify(position)}`);
    }
    await act(`window.tableHandle.closeTrees({ 2: { rowIndex: 2, columnIndex: 0 } })`, "closed");
  });
});
