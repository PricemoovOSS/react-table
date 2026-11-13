import { expect, test } from "@playwright/test";

import { capture, darkestAcross } from "./support/pixels";
import {
  alignmentIssues,
  bodyRows,
  dataRows,
  fixedEndColumnIssues,
  groupRows,
  headerRow,
  openStory,
  readTable,
  renderedColumns,
  scrollTable,
  settle,
  windowIssues,
} from "./support/table-page";

const STORY = "recipes-application-table--default";
const LAST_COLUMN = 29;
const BACKGROUND = 246;

test.describe("table of a data application, sized by its container", () => {
  test("fills its container and keeps its columns aligned", async ({ page }) => {
    await openStory(page, STORY);
    const snapshot = await readTable(page);
    expect(windowIssues(snapshot)).toEqual([]);
    expect(alignmentIssues(snapshot)).toEqual([]);
    expect(groupRows(snapshot)).toHaveLength(2);
    expect(dataRows(snapshot).length).toBeGreaterThan(8);
  });

  test("pins a column on the right from the toolbar: fixed, with its group and its relief", async ({ page }) => {
    await openStory(page, STORY);
    await page.getByTestId("pin-last-column").click();
    await settle(page);

    for (const left of [0, 900, "max"] as const) {
      await scrollTable(page, { left });
      const snapshot = await readTable(page);
      expect(fixedEndColumnIssues(snapshot, [LAST_COLUMN]), `scrollLeft=${left}`).toEqual([]);
      expect(alignmentIssues(snapshot), `scrollLeft=${left}`).toEqual([]);
      expect(windowIssues(snapshot), `scrollLeft=${left}`).toEqual([]);

      const fixedHeader = headerRow(snapshot).cells.find((cell) => cell.column === LAST_COLUMN);
      const group = groupRows(snapshot)[0].cells.find((cell) => cell.text.startsWith("Totals"));
      expect(group?.box.left, `scrollLeft=${left}`).toBeCloseTo(fixedHeader?.box.left ?? -1, 0);
      expect(group?.box.right, `scrollLeft=${left}`).toBeCloseTo(fixedHeader?.box.right ?? -1, 0);

      const image = await capture(page);
      const edge = fixedHeader?.box.left ?? 0;
      [groupRows(snapshot)[0], headerRow(snapshot), bodyRows(snapshot)[2]].forEach((row) => {
        expect(darkestAcross(image, edge, row.box.bottom - 6), `${row.testId || "groups"}, scrollLeft=${left}`).toBeLessThan(
          BACKGROUND,
        );
      });
    }

    await page.getByTestId("pin-last-column").click();
    await settle(page);
    const unpinned = await readTable(page);
    expect(headerRow(unpinned).cells.filter((cell) => cell.position === "absolute")).toHaveLength(0);
  });

  test("hides the columns of a group from its group cell and shows them again", async ({ page }) => {
    await openStory(page, STORY);
    expect(renderedColumns(await readTable(page)).slice(0, 4)).toEqual([0, 1, 2, 3]);

    await page.getByLabel("Hide Identity").click();
    await settle(page);
    const hidden = await readTable(page);
    expect(renderedColumns(hidden).slice(0, 3)).toEqual([0, 3, 4]);
    expect(alignmentIssues(hidden)).toEqual([]);
    expect(windowIssues(hidden)).toEqual([]);

    await page.getByTestId("show-all-columns").click();
    await settle(page);
    expect(renderedColumns(await readTable(page)).slice(0, 4)).toEqual([0, 1, 2, 3]);
  });

  test("loads the next page when the scroll reaches the bottom", async ({ page }) => {
    await openStory(page, STORY);
    await expect(page.getByTestId("status")).toContainText("pages: 1");
    await scrollTable(page, { top: "max" });
    await expect(page.getByTestId("status")).toContainText("pages: 2");
    await scrollTable(page, { top: "max" });
    await expect(page.getByTestId("status")).toContainText("pages: 3");
    const snapshot = await readTable(page);
    expect(alignmentIssues(snapshot)).toEqual([]);
  });

  test("expands and collapses every row from the toolbar, moves to a column and tracks the cursor", async ({ page }) => {
    await openStory(page, STORY);
    const rowsBefore = (await readTable(page)).scroll.maxTop;
    await page.getByTestId("expand-all").click();
    await settle(page);
    const expanded = await readTable(page);
    expect(expanded.scroll.maxTop).toBeGreaterThan(rowsBefore);
    expect(bodyRows(expanded).some((row) => row.classes.includes("sub-row"))).toBe(true);
    expect(alignmentIssues(expanded)).toEqual([]);

    await page.getByTestId("collapse-all").click();
    await settle(page);
    expect((await readTable(page)).scroll.maxTop).toBe(rowsBefore);

    await page.getByTestId("go-to-column").click();
    await settle(page);
    expect(renderedColumns(await readTable(page)).slice(0, 2)).toEqual([0, 15]);
    await expect(page.getByTestId("status")).toContainText("cursor: column-15");
  });
});
