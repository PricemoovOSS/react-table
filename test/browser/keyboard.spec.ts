import { expect, test, Page } from "@playwright/test";

import { openStory } from "./support/table-page";

const STORY = "table-keyboard-navigation--default";

const focused = (page: Page) =>
  page.evaluate(() => {
    const element = document.activeElement as HTMLElement | null;
    if (!element || element === document.body) return "nothing";
    return element.dataset.cellRow === undefined ? element.className : `${element.dataset.cellRow},${element.dataset.cellCol}`;
  });

const focusCell = (page: Page, row: number, column: number) =>
  page.evaluate(
    ([r, c]) => (document.querySelector(`[data-cell-row="${r}"][data-cell-col="${c}"]`) as HTMLElement).focus(),
    [row, column],
  );

/** The focused cell is on screen: inside the window of the table. */
const focusedCellIsVisible = (page: Page) =>
  page.evaluate(() => {
    const cell = document.activeElement as HTMLElement;
    const window = (document.querySelector(".scroller-content") as HTMLElement).getBoundingClientRect();
    const box = cell.getBoundingClientRect();
    return box.top >= window.top - 1 && box.left >= window.left - 1 && box.top < window.bottom && box.left < window.right;
  });

test.describe("keyboard navigation in a virtualized table", () => {
  test("goes through rows that are not rendered yet without losing the focus", async ({ page }) => {
    await openStory(page, STORY);
    await focusCell(page, 1, 0);

    for (let row = 2; row <= 40; row++) {
      await page.keyboard.press("ArrowDown");
      await expect.poll(() => focused(page), { message: `after ArrowDown to row ${row}` }).toBe(`${row},0`);
    }
    expect(await focusedCellIsVisible(page)).toBe(true);

    for (let row = 39; row >= 30; row--) {
      await page.keyboard.press("ArrowUp");
      await expect.poll(() => focused(page)).toBe(`${row},0`);
    }
  });

  test("keeps up with keys pressed faster than the table renders", async ({ page }) => {
    await openStory(page, STORY);
    await focusCell(page, 1, 0);
    for (let press = 0; press < 30; press++) await page.keyboard.press("ArrowDown", { delay: 0 });
    await expect.poll(() => focused(page)).toBe("31,0");
    expect(await focusedCellIsVisible(page)).toBe(true);
  });

  test("jumps by page, to the end and back to the start", async ({ page }) => {
    await openStory(page, STORY);
    await focusCell(page, 1, 0);

    await page.keyboard.press("PageDown");
    await expect.poll(() => focused(page)).toBe("11,0");
    await page.keyboard.press("PageDown");
    await expect.poll(() => focused(page)).toBe("21,0");

    await page.keyboard.press("Control+End");
    await expect.poll(() => focused(page)).toBe("49,9");
    expect(await focusedCellIsVisible(page)).toBe(true);

    await page.keyboard.press("Control+Home");
    await expect.poll(() => focused(page)).toBe("0,0");

    for (let column = 1; column <= 9; column++) {
      await page.keyboard.press("ArrowRight");
      await expect.poll(() => focused(page)).toBe(`0,${column}`);
    }
  });

  test("returns to the active cell when the focus comes back to the table", async ({ page }) => {
    await openStory(page, STORY);
    await focusCell(page, 3, 2);
    await page.evaluate(() => (document.activeElement as HTMLElement).blur());
    await page.locator("[data-grid-navigation]").focus();
    await expect.poll(() => focused(page)).toBe("3,2");
  });
});
