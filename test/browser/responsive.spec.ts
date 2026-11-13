import { expect, test, Page } from "@playwright/test";

import {
  alignmentIssues,
  dataRows,
  fixedEndColumnIssues,
  openStory,
  readTable,
  scrollTable,
  windowIssues,
} from "./support/table-page";

const LAST_COLUMN = 39;
const STORY = "table-combinations--groups-fixed-and-hidden-responsive";

async function resize(page: Page, width: number, height: number) {
  await page.evaluate(
    ([w, h]) => {
      const container = document.querySelector("#table-container") as HTMLElement;
      container.style.width = `${w}px`;
      container.style.height = `${h}px`;
    },
    [width, height],
  );
  // the resize observer answers on the next frames
  await page.waitForTimeout(250);
}

async function check(page: Page, where: string) {
  const snapshot = await readTable(page);
  expect(snapshot.scroller.width, where).toBeCloseTo(snapshot.container?.width ?? -1, 0);
  expect(snapshot.scroller.height, where).toBeCloseTo(snapshot.container?.height ?? -1, 0);
  expect(windowIssues(snapshot), where).toEqual([]);
  expect(fixedEndColumnIssues(snapshot, [LAST_COLUMN]), where).toEqual([]);
  expect(alignmentIssues(snapshot), where).toEqual([]);
  return snapshot;
}

test.describe("table sized by its container", () => {
  test("fills the container and keeps its layout at every size", async ({ page }) => {
    await openStory(page, STORY);
    const initial = await check(page, "900x480");
    const sizes: [number, number][] = [
      [700, 400],
      [1200, 650],
      [460, 300],
      [900, 480],
    ];
    const rendered: Record<string, number> = { "900x480": dataRows(initial).length };
    for (const [width, height] of sizes) {
      await resize(page, width, height);
      const snapshot = await check(page, `${width}x${height}`);
      rendered[`${width}x${height}`] = dataRows(snapshot).length;
    }
    // more rows in a taller container, fewer in a smaller one
    expect(rendered["1200x650"]).toBeGreaterThan(rendered["900x480"]);
    expect(rendered["460x300"]).toBeLessThan(rendered["700x400"]);
  });

  test("keeps what the user was looking at when the container is resized after a scroll", async ({ page }) => {
    await openStory(page, STORY);
    await scrollTable(page, { left: 777, top: 300 });
    const before = await readTable(page);
    const firstColumn = (snapshot: typeof before) => dataRows(snapshot)[1].cells[2].text;
    await resize(page, 1100, 600);
    const after = await check(page, "resized after scroll");
    expect(firstColumn(after)).toBe(firstColumn(before));
  });

  test("comes back after the container collapsed to nothing", async ({ page }) => {
    await openStory(page, STORY);
    await resize(page, 0, 0);
    await expect(page.locator(".table-root")).toHaveCount(0);
    await resize(page, 900, 480);
    await check(page, "back to 900x480");
  });
});
