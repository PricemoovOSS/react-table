import { expect, test, Page } from "@playwright/test";

import {
  alignmentIssues,
  fixedEndColumnIssues,
  groupIssues,
  openStory,
  readTable,
  scrollTable,
  settle,
  windowFillIssues,
} from "./support/table-page";

/**
 * Rows and columns inserted, removed and updated while the table is displayed, in a real
 * browser: after each change the table shows the data, stays aligned, keeps its scroll
 * (or the nearest position when the content got shorter) and logs no error.
 */
const STORY = "recipes-live-data--default";
const GROUP_LABELS: Record<string, string> = { identity: "Identity", metrics: "Metrics", totals: "Totals" };

type Operation = Record<string, unknown> & { type: string };

interface ILiveRowData {
  id: string;
  label: string;
  values: Record<string, number>;
  children?: ILiveRowData[];
}

/** What the story puts on its window for the tests. */
interface ILivePage {
  liveData: {
    apply: (...operations: Operation[]) => void;
    getData: () => { rows: ILiveRowData[]; columns: { id: string; label: string; group: string }[] };
    getWindow: () => { row: number; column: number };
    getHandle: () => { getOpenedTrees: () => Record<number, unknown> } | null;
  };
  renderStats: { renders: number; mounts: number };
}

interface IPageState {
  issues: string[];
  rows: string[];
  columns: string[];
  dataRows: number;
  dataColumns: { id: string; group: string }[];
  window: { row: number; column: number };
  openedRows: number;
}

/** Errors and warnings of the page: React reports its warnings as console errors. */
function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    // a missing favicon or font of the Storybook page is not an error of the table
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource")) {
      errors.push(message.text().slice(0, 300));
    }
  });
  return errors;
}

const apply = async (page: Page, ...operations: Operation[]) => {
  await page.evaluate((list) => (window as unknown as ILivePage).liveData.apply(...list), operations);
  await settle(page);
};

/** What the table displays, compared in the page with the data of the story. */
const readState = (page: Page): Promise<IPageState> =>
  page.evaluate(() => {
    const api = (window as unknown as ILivePage).liveData;
    const data = api.getData();
    const issues: string[] = [];
    const everyRow = new Map<string, ILiveRowData>();
    data.rows.forEach((row) => [row, ...(row.children || [])].forEach((item) => everyRow.set(item.id, item)));
    const placeOf = new Map<string, number>(data.rows.map((row, index) => [row.id, index]));

    const header = Array.from(document.querySelectorAll(".table-root tr.head:not(.table-groups-row) th"));
    const columns = header.map((cell) => Number(cell.getAttribute("aria-colindex")) - 1);
    header.forEach((cell, index) => {
      const column = data.columns[columns[index]];
      if (!column || (cell.textContent || "").trim() !== column.label) issues.push(`header ${index}: "${cell.textContent}"`);
    });

    const rows = Array.from(document.querySelectorAll(".table-root tbody tr"));
    const ids = rows.map((row) => (row.getAttribute("data-testid") || "").replace("table-row-", "").split("-").pop() as string);
    rows.forEach((row, rowIndex) => {
      const model = everyRow.get(ids[rowIndex]);
      if (!model) {
        issues.push(`row ${ids[rowIndex]} is not in the data`);
        return;
      }
      Array.from(row.children).forEach((cell) => {
        const column = data.columns[Number(cell.getAttribute("aria-colindex")) - 1];
        const content = cell.querySelector("[data-testid='live-cell'], [data-testid='live-name']");
        const expected = column && (column.id === "name" ? model.label : String(model.values[column.id]));
        if (!column || !content || content.textContent !== expected) {
          issues.push(`${ids[rowIndex]} / ${column?.id}: "${content?.textContent}" instead of "${expected}"`);
        }
      });
    });
    const places = ids.flatMap((id) => (placeOf.has(id) ? [placeOf.get(id) as number] : []));
    places.forEach((place, index) => {
      if (index > 0 && place !== places[index - 1] + 1) issues.push(`rows out of order around place ${place}`);
    });

    return {
      issues,
      rows: ids,
      columns: columns.map((index) => data.columns[index]?.id),
      dataRows: data.rows.length,
      dataColumns: data.columns.map((column) => ({ id: column.id, group: column.group })),
      window: api.getWindow(),
      openedRows: Object.keys(api.getHandle()?.getOpenedTrees() ?? {}).length,
    };
  });

/**
 * The table shows the data, aligned under its headers and groups, the pinned column against
 * the right edge, the window full. Returns the state and the scroll for further checks.
 */
async function expectHealthy(page: Page, capacity: number, context: string) {
  const state = await readState(page);
  const snapshot = await readTable(page);
  expect(state.issues, context).toEqual([]);
  expect(windowFillIssues(snapshot), context).toEqual([]);
  expect(alignmentIssues(snapshot), context).toEqual([]);

  const totalIndex = state.dataColumns.findIndex((column) => column.id === "total");
  const hasScrollingColumn = state.columns.some((id) => id !== "name" && id !== "total");
  const pinned = totalIndex >= 0 && hasScrollingColumn ? [totalIndex] : [];
  expect(fixedEndColumnIssues(snapshot, pinned), context).toEqual([]);
  if (totalIndex >= 0) expect(state.columns[state.columns.length - 1], context).toBe("total");
  expect(
    groupIssues(snapshot, (column) => {
      const group = state.dataColumns[column].group;
      return { key: group, label: GROUP_LABELS[group] };
    }),
    context,
  ).toEqual([]);

  // the window is full: as many rows as it can hold, or every row
  if (state.openedRows === 0) expect(state.rows.length, context).toBe(Math.min(capacity, state.dataRows));
  return { state, scroll: snapshot.scroll };
}

const capacityOf = async (page: Page) => (await readState(page)).rows.length;

test.describe("rows inserted and removed while the table is displayed", () => {
  for (const top of [0, 3000, "max"] as const) {
    test(`at the start, in the window and at the end, scrolled to ${top}`, async ({ page }) => {
      const errors = watchErrors(page);
      await openStory(page, STORY);
      const capacity = await capacityOf(page);
      await scrollTable(page, { top, left: 600 });

      const steps: [string, (state: IPageState) => Operation][] = [
        ["insert at the start", () => ({ type: "insertRows", index: 0 })],
        ["insert in the window", (state) => ({ type: "insertRows", index: state.window.row + 1 })],
        ["insert at the end", (state) => ({ type: "insertRows", index: state.dataRows })],
        ["remove at the start", () => ({ type: "removeRows", index: 0 })],
        ["remove in the window", (state) => ({ type: "removeRows", index: state.window.row + 1 })],
        ["remove at the end", (state) => ({ type: "removeRows", index: state.dataRows - 1 })],
        ["insert 100 at the start", () => ({ type: "insertRows", index: 0, count: 100 })],
        ["remove 100 at the start", () => ({ type: "removeRows", index: 0, count: 100 })],
      ];
      for (const [label, operation] of steps) {
        const before = await readTable(page);
        await apply(page, operation(await readState(page)));
        const { scroll } = await expectHealthy(page, capacity, label);
        // the scroll is kept, or brought back to the end when the content got shorter
        expect(scroll.top, label).toBe(Math.min(before.scroll.top, scroll.maxTop));
        expect(scroll.left, label).toBe(before.scroll.left);
      }
      expect(errors).toEqual([]);
    });
  }

  test("removed under the window down to a few rows: the window follows the end and is never empty", async ({ page }) => {
    const errors = watchErrors(page);
    await openStory(page, STORY);
    const capacity = await capacityOf(page);
    await scrollTable(page, { top: "max" });

    await apply(page, { type: "removeRows", index: 60, count: 500 });
    let health = await expectHealthy(page, capacity, "60 rows left");
    expect(health.scroll.top).toBe(health.scroll.maxTop);
    expect(health.state.rows[health.state.rows.length - 1]).toBe("r60");

    await apply(page, { type: "removeRows", index: 4, count: 500 });
    health = await expectHealthy(page, capacity, "4 rows left");
    expect(health.state.rows).toEqual(["r1", "r2", "r3", "r4"]);
    // every row fits: no vertical scroll is offered any more
    expect(await page.locator(".scroller-container").evaluate((scroller) => getComputedStyle(scroller).overflowY)).toBe("hidden");

    await apply(page, { type: "removeRows", index: 0, count: 10 });
    health = await expectHealthy(page, capacity, "no row left");
    expect(health.state.rows).toEqual([]);

    await apply(page, { type: "insertRows", index: 0, count: 300 });
    health = await expectHealthy(page, capacity, "300 rows inserted");
    expect(health.scroll.maxTop).toBeGreaterThan(1000);
    expect(errors).toEqual([]);
  });
});

test.describe("columns inserted and removed while the table is displayed", () => {
  for (const left of [0, 1500, "max"] as const) {
    test(`at the start, in the window and at the end, scrolled to ${left}`, async ({ page }) => {
      const errors = watchErrors(page);
      await openStory(page, STORY);
      const capacity = await capacityOf(page);
      await scrollTable(page, { left, top: 1200 });

      const steps: [string, (state: IPageState) => Operation][] = [
        ["insert at the start", () => ({ type: "insertColumns", index: 1 })],
        ["insert in the window", (state) => ({ type: "insertColumns", index: state.window.column + 1 })],
        ["insert before the pinned column", (state) => ({ type: "insertColumns", index: state.dataColumns.length - 1 })],
        ["remove at the start", () => ({ type: "removeColumns", index: 1 })],
        ["remove in the window", (state) => ({ type: "removeColumns", index: state.window.column + 1 })],
        ["remove before the pinned column", (state) => ({ type: "removeColumns", index: state.dataColumns.length - 2 })],
        ["insert 20 at the start", () => ({ type: "insertColumns", index: 1, count: 20 })],
        ["remove 20 at the start", () => ({ type: "removeColumns", index: 1, count: 20 })],
      ];
      for (const [label, operation] of steps) {
        const before = await readTable(page);
        await apply(page, operation(await readState(page)));
        const { scroll } = await expectHealthy(page, capacity, label);
        expect(scroll.left, label).toBe(Math.min(before.scroll.left, scroll.maxLeft));
        expect(scroll.top, label).toBe(before.scroll.top);
      }
      expect(errors).toEqual([]);
    });
  }

  test("removed down to a table narrower than its window, then inserted again: no padding is left behind", async ({ page }) => {
    const errors = watchErrors(page);
    await openStory(page, STORY);
    const capacity = await capacityOf(page);
    await scrollTable(page, { left: "max" });
    const endPaddings = () =>
      page.evaluate(() =>
        Array.from(document.querySelectorAll(".table-root .table-column:not(.table-group)")).map(
          (cell) => getComputedStyle(cell).paddingRight,
        ),
      );

    // without a pinned column, the last column takes the width the table lacks to fill its window
    await apply(page, { type: "removeColumns", index: 29 }, { type: "removeColumns", index: 3, count: 26 });
    let health = await expectHealthy(page, capacity, "three columns");
    expect(health.state.columns).toEqual(["name", "c1", "c2"]);
    expect(await page.locator(".scroller-container").evaluate((scroller) => getComputedStyle(scroller).overflowX)).toBe("hidden");
    expect((await endPaddings()).some((padding) => padding !== "0px")).toBe(true);

    // inserted after it: the column that was the last one stays displayed, and stops filling the window
    await apply(page, { type: "insertColumns", index: 3, count: 25 });
    health = await expectHealthy(page, capacity, "columns inserted again");
    expect(health.state.columns.slice(0, 3)).toEqual(["name", "c1", "c2"]);
    expect(new Set(await endPaddings())).toEqual(new Set(["0px"]));
    expect(errors).toEqual([]);
  });

  test("the pinned column removed, then every column but the name", async ({ page }) => {
    const errors = watchErrors(page);
    await openStory(page, STORY);
    const capacity = await capacityOf(page);
    await scrollTable(page, { left: 900 });

    await apply(page, { type: "removeColumns", index: 29 });
    let health = await expectHealthy(page, capacity, "without the pinned column");
    expect(health.state.dataColumns.map((column) => column.id)).not.toContain("total");
    expect(await page.locator(".table-root .elevated-absolute").count()).toBe(0);

    await apply(page, { type: "removeColumns", index: 1, count: 100 });
    health = await expectHealthy(page, capacity, "name only");
    expect(health.state.columns).toEqual(["name"]);
    expect(errors).toEqual([]);
  });
});

test.describe("data updated while the table is displayed", () => {
  const readRenders = (page: Page) => page.evaluate(() => ({ ...(window as unknown as ILivePage).renderStats }));
  const resetRenders = (page: Page) =>
    page.evaluate(() => {
      (window as unknown as ILivePage).renderStats.renders = 0;
      (window as unknown as ILivePage).renderStats.mounts = 0;
    });

  test("renders the cells whose value changed, no other", async ({ page }) => {
    const errors = watchErrors(page);
    // without sub rows: a row that has some renders its name cell when its sub rows change
    await openStory(page, STORY, "subRowsEvery:0");
    const capacity = await capacityOf(page);
    await scrollTable(page, { top: 1500, left: 800 });
    const state = await readState(page);
    const place = state.window.row + 1;
    const valueColumns = state.columns.filter((id) => id !== "name");

    await resetRenders(page);
    await apply(page, { type: "updateCell", index: place, columnId: valueColumns[1] });
    expect(await readRenders(page), "one value").toEqual({ renders: 1, mounts: 0 });

    await resetRenders(page);
    await apply(page, { type: "updateRow", index: place });
    expect(await readRenders(page), "one row").toEqual({ renders: valueColumns.length, mounts: 0 });

    await resetRenders(page);
    await apply(page, { type: "updateColumn", columnId: valueColumns[1] });
    expect(await readRenders(page), "one column").toEqual({ renders: state.rows.length, mounts: 0 });

    await resetRenders(page);
    await apply(page, { type: "updateRow", index: 1 }, { type: "updateCell", index: 190, columnId: "c2" });
    expect(await readRenders(page), "rows out of the window").toEqual({ renders: 0, mounts: 0 });

    await resetRenders(page);
    await apply(page, { type: "renameColumn", columnId: valueColumns[1] });
    expect(await readRenders(page), "a column renamed").toEqual({ renders: 0, mounts: 0 });

    await expectHealthy(page, capacity, "after the updates");
    expect(errors).toEqual([]);
  });

  test("keeps the state of a cell and an opened row with their rows when rows are inserted above", async ({ page }) => {
    const errors = watchErrors(page);
    await openStory(page, STORY);
    const capacity = await capacityOf(page);
    const watched = () =>
      page
        .locator(".table-root tbody tr:has(input:checked)")
        .evaluateAll((rows) => rows.map((row) => row.getAttribute("data-testid")));
    const rowsUnder = async (id: string) => {
      const { rows } = await readState(page);
      return rows.slice(rows.indexOf(id) + 1, rows.indexOf(id) + 3);
    };

    await page.getByLabel("Watch Row 3", { exact: true }).check();
    // "r5" has sub rows
    await page.locator("[data-testid='table-row-r5'] [data-testid='table-cell-sub-item-toggle']").click();
    await settle(page);
    expect(await rowsUnder("r5")).toEqual(["r5.1", "r5.2"]);

    await apply(page, { type: "insertRows", index: 0, count: 2 });
    expect(await watched()).toEqual(["table-row-r3"]);
    expect(await rowsUnder("r5")).toEqual(["r5.1", "r5.2"]);
    await expectHealthy(page, capacity, "two rows inserted above");

    await apply(page, { type: "removeRows", index: 0, count: 3 });
    expect(await watched()).toEqual(["table-row-r3"]);
    expect(await rowsUnder("r5")).toEqual(["r5.1", "r5.2"]);
    await expectHealthy(page, capacity, "three rows removed above");
    expect(errors).toEqual([]);
  });

  test("a feed of updates renders the updated cells only, also while scrolling", async ({ page }) => {
    const errors = watchErrors(page);
    await openStory(page, "recipes-live-data--stream");
    const capacity = await capacityOf(page);

    await resetRenders(page);
    await page.waitForTimeout(1300);
    const idle = await readRenders(page);
    // 12 values every 250 ms, some of them out of the window: never more than the feed sends
    expect(idle.renders).toBeGreaterThan(0);
    expect(idle.renders).toBeLessThanOrEqual(6 * 12);
    expect(idle.mounts).toBe(0);

    for (let step = 0; step < 12; step++) {
      await page.evaluate(() => {
        const scroller = document.querySelector(".scroller-container") as HTMLElement;
        scroller.scrollTop += 173;
        scroller.scrollLeft += 97;
      });
      await page.waitForTimeout(110);
    }
    await expectHealthy(page, capacity, "after scrolling through the feed");
    expect(errors).toEqual([]);
  });
});

test.describe("changes on 5 000 rows and 200 columns", () => {
  test("are displayed within a few frames", async ({ page }) => {
    const errors = watchErrors(page);
    await openStory(page, "recipes-live-data--large");
    await scrollTable(page, { top: 90000, left: 9000 });

    /** Frames and milliseconds until the page shows what the operation is expected to show. */
    const timeUntil = (operation: Operation, selector: string, text?: string) =>
      page.evaluate(
        async ([change, target, expected]) => {
          const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
          const isShown = () => {
            const element = document.querySelector(target as string);
            return !!element && (expected === undefined || element.textContent === expected);
          };
          const start = performance.now();
          (window as unknown as ILivePage).liveData.apply(change);
          let frames = 0;
          while (!isShown() && frames < 60) {
            await frame();
            frames += 1;
          }
          return { frames, milliseconds: performance.now() - start, shown: isShown() };
        },
        [operation, selector, text] as const,
      );

    const state = await readState(page);
    const place = state.window.row + 1;
    const rowId = state.rows[2];
    const columnId = state.columns[2];
    const cell = `[data-testid='table-row-${rowId}'] [data-column-id='${columnId}']`;
    const value = Number(await page.locator(cell).textContent());

    const update = await timeUntil({ type: "updateCell", index: place, columnId }, cell, String(value + 1));
    const insertion = await timeUntil({ type: "insertRows", index: place }, "[data-testid='table-row-r5001']");
    const column = await timeUntil({ type: "insertColumns", index: state.window.column + 1 }, "[data-column-id='c199']");

    // loose bounds: they catch a cost that grows with the size of the data, not a slow machine
    for (const [label, result] of Object.entries({ update, insertion, column })) {
      expect(result.shown, label).toBe(true);
      expect(result.frames, label).toBeLessThanOrEqual(4);
      expect(result.milliseconds, label).toBeLessThan(400);
    }
    await settle(page);
    expect((await readState(page)).issues).toEqual([]);
    expect(errors).toEqual([]);
  });
});
