import { expect, Page, test } from "@playwright/test";

import { alignmentIssues, groupRows, headerRow, ITableSnapshot, openStory, readTable, settle } from "./support/table-page";

const STORY = "table-combinations--sizes-groups-fixed-and-hidden";
const OPTIONS = [
  "columnSizes",
  "groups",
  "fixedStartColumns",
  "fixedEndColumn",
  "hiddenColumns",
  "rowSizes",
  "fixedBottomRow",
  "hiddenRows",
] as const;
type Option = (typeof OPTIONS)[number];
type Axis = "columns" | "rows";

const COLUMNS = 14;
const ROWS = 60;
const HIDDEN = { columns: [6, 9], rows: [5, 12, 58] };

const indexes = (length: number, hidden: number[] = []) =>
  Array.from(Array(length), (_, index) => index).filter((index) => !hidden.includes(index));

async function setOptions(page: Page, enabled: readonly Option[]): Promise<void> {
  for (const option of OPTIONS) await page.getByTestId(`option-${option}`).setChecked(enabled.includes(option));
  await settle(page);
}

interface ISweep {
  /** Rows or columns that were entirely in the window at one position at least */
  entirelyDisplayed: number[];
  everRendered: number[];
  /** How far the last scrolling row or column goes beyond its room, at the end of the scroll bar */
  cutAtTheEnd: number;
  lastAtTheEnd: number;
}

/**
 * Scrolls one axis from one end to the other, a few pixels at a time, and reads the real boxes: a row
 * or a column is entirely displayed when it ends before the items fixed at the end, or the edge of
 * the window. The window itself tolerates a last item cut by 10 px or by the rounding of the sizes.
 */
async function sweep(page: Page, axis: Axis): Promise<ISweep> {
  return page.evaluate(async (axisName) => {
    const horizontal = axisName === "columns";
    const scroller = document.querySelector(".scroller-container") as HTMLElement;
    const content = (scroller.querySelector(".scroller-content") as HTMLElement).getBoundingClientRect();
    const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const read = () => {
      const rows = Array.from(scroller.querySelectorAll<HTMLElement>("tr.table-row:not(.table-groups-row)"));
      const elements = horizontal ? Array.from(rows[0].querySelectorAll<HTMLElement>(":scope > [aria-colindex]")) : rows;
      const items = elements.map((element) => {
        const box = element.getBoundingClientRect();
        return {
          index: Number(element.getAttribute(horizontal ? "aria-colindex" : "aria-rowindex")) - 1,
          start: horizontal ? box.left : box.top,
          end: horizontal ? box.right : box.bottom,
          isFixedAtTheEnd: getComputedStyle(element).position === "absolute",
        };
      });
      const fixed = items.filter((item) => item.isFixedAtTheEnd);
      const limit = fixed.length ? Math.min(...fixed.map((item) => item.start)) : horizontal ? content.right : content.bottom;
      return { items, scrolling: items.filter((item) => !item.isFixedAtTheEnd), limit, tolerance: 10.5 + items.length };
    };
    const max = horizontal ? scroller.scrollWidth - scroller.clientWidth : scroller.scrollHeight - scroller.clientHeight;
    const entirelyDisplayed = new Set<number>();
    const everRendered = new Set<number>();
    const positions = Array.from(Array(Math.ceil(max / 25) + 1), (_, step) => Math.min(step * 25, max));
    const record = (state: ReturnType<typeof read>) => {
      state.items.forEach((item) => everRendered.add(item.index));
      state.items.filter((item) => item.isFixedAtTheEnd).forEach((item) => entirelyDisplayed.add(item.index));
      state.scrolling
        .filter((item) => item.end <= state.limit + state.tolerance)
        .forEach((item) => entirelyDisplayed.add(item.index));
      return state;
    };
    let state = read();
    for (const position of positions) {
      if (horizontal) scroller.scrollLeft = position;
      else scroller.scrollTop = position;
      await frame();
      state = record(read());
    }
    const last = state.scrolling[state.scrolling.length - 1];
    return {
      entirelyDisplayed: Array.from(entirelyDisplayed).sort((a, b) => a - b),
      everRendered: Array.from(everRendered).sort((a, b) => a - b),
      cutAtTheEnd: Math.max(Math.round(last.end - state.limit), 0),
      lastAtTheEnd: last.index,
    };
  }, axis);
}

/** Group cells start and end on the edges of the columns under them. */
function groupEdgeIssues(snapshot: ITableSnapshot): string[] {
  const columns = headerRow(snapshot).cells;
  const isEdge = (edges: number[], value: number) => edges.some((edge) => Math.abs(edge - value) <= 1.01);
  return groupRows(snapshot).flatMap((row) =>
    row.cells
      .filter(
        (cell) =>
          !isEdge(
            columns.map((column) => column.box.left),
            cell.box.left,
          ) ||
          !isEdge(
            columns.map((column) => column.box.right),
            cell.box.right,
          ),
      )
      .map((cell) => `group "${cell.text}" [${cell.box.left}, ${cell.box.right}] is not on the edges of its columns`),
  );
}

async function expectEverythingReachable(page: Page, enabled: readonly Option[], context: string): Promise<void> {
  const hiddenColumns = enabled.includes("hiddenColumns") ? HIDDEN.columns : [];
  const hiddenRows = enabled.includes("hiddenRows") ? HIDDEN.rows : [];

  const columns = await sweep(page, "columns");
  expect(columns.entirelyDisplayed, `${context}: columns entirely displayed`).toEqual(indexes(COLUMNS, hiddenColumns));
  expect(columns.everRendered, `${context}: columns rendered`).toEqual(indexes(COLUMNS, hiddenColumns));
  const snapshot = await readTable(page);
  expect(alignmentIssues(snapshot), `${context}: alignment at the end`).toEqual([]);
  expect(groupEdgeIssues(snapshot), `${context}: groups at the end`).toEqual([]);

  const rows = await sweep(page, "rows");
  expect(rows.entirelyDisplayed, `${context}: rows entirely displayed`).toEqual(indexes(ROWS, hiddenRows));
  expect(rows.everRendered, `${context}: rows rendered`).toEqual(indexes(ROWS, hiddenRows));
}

const MIXES: [string, readonly Option[]][] = [
  ["everything", OPTIONS],
  ["sizes and a group over the last columns, nothing fixed at the end", ["columnSizes", "groups", "rowSizes"]],
  [
    "sizes and a group over the last columns, the last one fixed",
    ["columnSizes", "groups", "fixedEndColumn", "rowSizes", "fixedBottomRow"],
  ],
  [
    "small columns fixed at the start, wide columns, hidden ones",
    ["columnSizes", "fixedStartColumns", "hiddenColumns", "hiddenRows"],
  ],
  [
    "columns and rows without a size of their own, fixed and hidden",
    ["groups", "fixedStartColumns", "fixedEndColumn", "hiddenColumns", "fixedBottomRow", "hiddenRows"],
  ],
  ["nothing", []],
];

test.describe("every row and column can be scrolled into the window", () => {
  for (const [name, enabled] of MIXES) {
    test(name, async ({ page }) => {
      await openStory(page, STORY);
      await setOptions(page, enabled);
      await expectEverythingReachable(page, enabled, name);
    });
  }

  test("after each option is switched while the table is at the end of both scroll bars", async ({ page }) => {
    await openStory(page, STORY);
    let enabled: Option[] = ["columnSizes", "groups", "fixedStartColumns", "fixedEndColumn", "rowSizes"];
    await setOptions(page, enabled);

    for (const option of [
      "hiddenColumns",
      "fixedEndColumn",
      "columnSizes",
      "hiddenRows",
      "rowSizes",
      "columnSizes",
      "fixedEndColumn",
    ] as Option[]) {
      // at the end of both axes when the option changes
      await page.evaluate(() => {
        const scroller = document.querySelector(".scroller-container") as HTMLElement;
        scroller.scrollLeft = scroller.scrollWidth;
        scroller.scrollTop = scroller.scrollHeight;
      });
      await settle(page);
      enabled = enabled.includes(option) ? enabled.filter((other) => other !== option) : [...enabled, option];
      await page.getByTestId(`option-${option}`).setChecked(enabled.includes(option));
      await settle(page);
      await expectEverythingReachable(page, enabled, `after ${option} ${enabled.includes(option) ? "on" : "off"}`);
    }
  });

  // Known defect, as in 4.x: in a last window narrower than the table window, without a column fixed at
  // the end, the rows in the flow are stretched to the window and a row fixed at the bottom is not.
  test.fixme("a row fixed at the bottom stays aligned in a last window narrower than the table window", async ({ page }) => {
    await openStory(page, STORY);
    await setOptions(page, ["columnSizes", "groups", "fixedStartColumns", "hiddenColumns", "fixedBottomRow"]);
    await page.evaluate(() => {
      const scroller = document.querySelector(".scroller-container") as HTMLElement;
      scroller.scrollLeft = scroller.scrollWidth;
    });
    await settle(page);
    expect(alignmentIssues(await readTable(page))).toEqual([]);
  });
});
