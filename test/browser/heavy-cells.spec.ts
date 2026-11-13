import { expect, test, Page } from "@playwright/test";

import { openStory, scrollTable, settle } from "./support/table-page";

/**
 * Heavy interactive cells: an interaction renders the cells that enter the window, and no
 * other. The cells count their own renders and mounts in `window.renderStats`.
 */
const STORY = "recipes-heavy-interactive-cells--default";

interface IStats {
  renders: number;
  mounts: number;
}

const reset = (page: Page) =>
  page.evaluate(() => {
    const stats = (window as unknown as { renderStats: IStats }).renderStats;
    stats.renders = 0;
    stats.mounts = 0;
  });
const read = (page: Page): Promise<IStats> =>
  page.evaluate(() => ({ ...(window as unknown as { renderStats: IStats }).renderStats }));

/** Heavy cells of the window, and the size of one step in each direction. */
const readWindow = (page: Page) =>
  page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll(".table-root tbody tr"));
    const cells = rows[1].querySelectorAll("[data-testid='heavy-cell']");
    return {
      rows: rows.length,
      columns: cells.length,
      cells: document.querySelectorAll("[data-testid='heavy-cell']").length,
      rowHeight: Math.round(rows[1].getBoundingClientRect().height),
      columnWidth: Math.round((rows[1].children[1] as HTMLElement).getBoundingClientRect().width),
    };
  });

async function scrollBy(page: Page, left: number, top: number) {
  await page.evaluate(
    ([dx, dy]) => {
      const scroller = document.querySelector(".scroller-container") as HTMLElement;
      scroller.scrollLeft += dx;
      scroller.scrollTop += dy;
    },
    [left, top],
  );
  await settle(page);
}

/**
 * Number of vertical steps whose new window is in the DOM before the paint of the frame that
 * dispatched the scroll event. The probe listens on the scroller itself: its animation callback
 * is registered after the one of the table and runs after it, in the same frame.
 */
const countStepsShownInTheirFrame = (page: Page, steps: number, rowHeight: number) =>
  page.evaluate(
    async ([count, delta]) => {
      const scroller = document.querySelector(".scroller-container") as HTMLElement;
      const firstRow = () => document.querySelector(".table-root tbody tr")?.getAttribute("data-testid");
      const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      let shown = 0;
      for (let step = 0; step < count; step++) {
        const before = firstRow();
        const isUpToDate = new Promise<boolean>((resolve) => {
          const probe = () => requestAnimationFrame(() => resolve(firstRow() !== before));
          scroller.addEventListener("scroll", probe, { once: true });
        });
        scroller.scrollTop += delta;
        if (await isUpToDate) shown += 1;
        await frame();
        await frame();
      }
      return shown;
    },
    [steps, rowHeight],
  );

test.describe("frame that shows a scroll step", () => {
  const STEPS = 20;

  test("is the frame of the scroll event: the window is painted with its scroll position", async ({ page }) => {
    await openStory(page, STORY);
    const { rowHeight } = await readWindow(page);
    expect(await countStepsShownInTheirFrame(page, STEPS, rowHeight)).toBe(STEPS);
  });

  test("is a later frame when synchronousScrollRendering is off", async ({ page }) => {
    await openStory(page, STORY, "synchronousScrollRendering:!false");
    const { rowHeight } = await readWindow(page);
    expect(await countStepsShownInTheirFrame(page, STEPS, rowHeight)).toBe(0);
    // the steps are rendered all the same: the first row of the body was "row-1"
    const firstRow = await page.locator(".table-root tbody tr").first().getAttribute("data-testid");
    expect(firstRow).toBe(`table-row-row-${STEPS + 1}`);
  });
});

test.describe("table of heavy interactive cells", () => {
  test.beforeEach(async ({ page }) => {
    await openStory(page, STORY);
    await reset(page);
  });

  test("a vertical step renders one row of cells, each one once", async ({ page }) => {
    const window = await readWindow(page);
    for (let step = 1; step <= 5; step++) {
      await scrollBy(page, 0, window.rowHeight);
      expect(await read(page), `step ${step}`).toEqual({ renders: step * window.columns, mounts: step * window.columns });
    }
  });

  test("a horizontal step renders one column of cells, each one once", async ({ page }) => {
    const window = await readWindow(page);
    for (let step = 1; step <= 5; step++) {
      await scrollBy(page, window.columnWidth, 0);
      expect(await read(page), `step ${step}`).toEqual({ renders: step * window.rows, mounts: step * window.rows });
    }
  });

  test("a jump to another part of the table renders the window once", async ({ page }) => {
    await scrollTable(page, { left: 20000, top: 9000 });
    const window = await readWindow(page);
    expect(await read(page)).toEqual({ renders: window.cells, mounts: window.cells });
  });

  test("a scroll that stays in the same window renders nothing", async ({ page }) => {
    await scrollBy(page, 3, 3);
    await scrollBy(page, 2, 2);
    expect(await read(page)).toEqual({ renders: 0, mounts: 0 });
  });

  test("a render of the application around the table renders no cell", async ({ page }) => {
    for (let click = 0; click < 3; click++) await page.getByTestId("render-application").click();
    await settle(page);
    // the meter refreshes itself several times a second: it must not reach the cells either
    await page.waitForTimeout(600);
    expect(await read(page)).toEqual({ renders: 0, mounts: 0 });
  });

  test("typing, pinning and opening the menu of a cell render that cell only", async ({ page }) => {
    const input = page.getByLabel("Price 3:2", { exact: true });
    await input.click();
    await page.keyboard.type("789");
    await expect(input).toHaveValue(/789/);
    expect(await read(page), "three characters typed").toEqual({ renders: 3, mounts: 0 });

    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowRight");
    expect(await read(page), "moving the caret").toEqual({ renders: 3, mounts: 0 });

    await page.getByLabel("Pin 3:2", { exact: true }).click();
    expect(await read(page), "pinned").toEqual({ renders: 4, mounts: 0 });

    await page.getByLabel("Actions 3:2", { exact: true }).click();
    await page.getByRole("menuitem", { name: "Copy" }).click();
    expect(await read(page), "menu opened then closed").toEqual({ renders: 6, mounts: 0 });
  });

  test("the cells keep what the user typed while they stay in the window", async ({ page }) => {
    const window = await readWindow(page);
    const input = page.getByLabel("Price 4:2", { exact: true });
    await input.fill("42");
    await scrollBy(page, 0, window.rowHeight);
    await scrollBy(page, 0, -window.rowHeight);
    await expect(page.getByLabel("Price 4:2", { exact: true })).toHaveValue("42");
  });
});
