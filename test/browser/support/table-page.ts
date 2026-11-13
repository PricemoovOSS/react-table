import { Page } from "@playwright/test";

export interface IBox {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
}

export interface ICellSnapshot {
  /** Column index in the whole table, `null` for a group cell */
  column: number | null;
  colSpan: number;
  classes: string[];
  text: string;
  position: string;
  box: IBox;
}

export interface IRowSnapshot {
  testId: string;
  classes: string[];
  position: string;
  box: IBox;
  cells: ICellSnapshot[];
}

export interface ITableSnapshot {
  scroll: { left: number; top: number; maxLeft: number; maxTop: number };
  /** The visible window: what stays on screen while the content scrolls */
  viewport: IBox;
  scroller: IBox;
  table: IBox;
  container: IBox | null;
  rows: IRowSnapshot[];
}

/** Sizes are whole pixels except when the browser rounds a fraction: one pixel of tolerance. */
export const TOLERANCE = 1.01;

/** `args` in the Storybook syntax: `name:value;other:!false` */
export const storyUrl = (id: string, args?: string) => `/iframe.html?id=${id}&viewMode=story${args ? `&args=${args}` : ""}`;

export async function openStory(page: Page, id: string, args?: string): Promise<void> {
  try {
    await loadStory(page, id, args);
  } catch (error) {
    // a Storybook started cold reloads the page once its dependencies are optimized
    if (!String(error).includes("Execution context was destroyed")) throw error;
    await loadStory(page, id, args);
  }
}

async function loadStory(page: Page, id: string, args?: string): Promise<void> {
  await page.goto(storyUrl(id, args));
  await page.waitForSelector(".table-root tbody tr");
  await settle(page);
}

/** Waits for the frame that processes the scroll and for the render that follows. */
export async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 50)))),
  );
}

export async function scrollTable(page: Page, position: { left?: number | "max"; top?: number | "max" }): Promise<void> {
  await page.evaluate(({ left, top }) => {
    const scroller = document.querySelector(".scroller-container") as HTMLElement;
    if (left !== undefined) scroller.scrollLeft = left === "max" ? scroller.scrollWidth : left;
    if (top !== undefined) scroller.scrollTop = top === "max" ? scroller.scrollHeight : top;
  }, position);
  await settle(page);
}

export async function readTable(page: Page): Promise<ITableSnapshot> {
  return page.evaluate(() => {
    const round = (value: number) => Math.round(value * 10) / 10;
    const boxOf = (element: Element) => {
      const rect = element.getBoundingClientRect();
      return {
        left: round(rect.left),
        right: round(rect.right),
        top: round(rect.top),
        bottom: round(rect.bottom),
        width: round(rect.width),
        height: round(rect.height),
      };
    };
    const scroller = document.querySelector(".scroller-container") as HTMLElement;
    const table = scroller.querySelector(".table-root") as HTMLElement;
    const container = document.querySelector("#table-container");
    return {
      scroll: {
        left: scroller.scrollLeft,
        top: scroller.scrollTop,
        maxLeft: scroller.scrollWidth - scroller.clientWidth,
        maxTop: scroller.scrollHeight - scroller.clientHeight,
      },
      viewport: boxOf(scroller.querySelector(".scroller-content") as HTMLElement),
      scroller: boxOf(scroller),
      table: boxOf(table),
      container: container ? boxOf(container) : null,
      rows: Array.from(table.querySelectorAll("tr")).map((row) => ({
        testId: row.getAttribute("data-testid") || "",
        classes: Array.from(row.classList),
        position: getComputedStyle(row).position,
        box: boxOf(row),
        cells: Array.from(row.children).map((cell) => {
          const columnIndex = cell.getAttribute("aria-colindex");
          return {
            column: columnIndex === null ? null : Number(columnIndex) - 1,
            colSpan: (cell as HTMLTableCellElement).colSpan,
            classes: Array.from(cell.classList),
            text: (cell.textContent || "").trim(),
            position: getComputedStyle(cell).position,
            box: boxOf(cell),
          };
        }),
      })),
    };
  });
}

const isGroupRow = (row: IRowSnapshot) => row.classes.includes("table-groups-row");
export const groupRows = (snapshot: ITableSnapshot) => snapshot.rows.filter(isGroupRow);
export const headerRow = (snapshot: ITableSnapshot) =>
  snapshot.rows.find((row) => row.classes.includes("head") && !isGroupRow(row)) as IRowSnapshot;
export const bodyRows = (snapshot: ITableSnapshot) => snapshot.rows.filter((row) => !row.classes.includes("head"));
export const dataRows = (snapshot: ITableSnapshot) => snapshot.rows.filter((row) => !isGroupRow(row));

const differs = (a: number, b: number) => Math.abs(a - b) > TOLERANCE;

/** Every cell of the body sits exactly under the header cell of its column. */
export function alignmentIssues(snapshot: ITableSnapshot): string[] {
  const header = new Map(headerRow(snapshot).cells.map((cell) => [cell.column, cell]));
  const issues: string[] = [];
  bodyRows(snapshot).forEach((row) =>
    row.cells.forEach((cell) => {
      if (cell.column === null) return;
      const headerCell = header.get(cell.column);
      if (!headerCell) issues.push(`${row.testId}: column ${cell.column} has no header cell`);
      else if (differs(headerCell.box.left, cell.box.left) || differs(headerCell.box.right, cell.box.right)) {
        issues.push(
          `${row.testId} column ${cell.column}: header [${headerCell.box.left}, ${headerCell.box.right}], cell [${cell.box.left}, ${cell.box.right}]`,
        );
      }
    }),
  );
  return issues;
}

/**
 * Columns fixed at the end: out of the flow, stacked against the right edge of the window
 * without gap nor overlap, and no column of the flow reaches under them.
 */
export function fixedEndColumnIssues(snapshot: ITableSnapshot, fixedEndColumns: number[]): string[] {
  const issues: string[] = [];
  dataRows(snapshot).forEach((row) => {
    const fixed = row.cells.filter((cell) => cell.column !== null && fixedEndColumns.includes(cell.column));
    const flow = row.cells.filter((cell) => cell.position !== "absolute");
    if (fixed.length !== fixedEndColumns.length) {
      issues.push(`${row.testId}: ${fixed.length} fixed end cells, expected ${fixedEndColumns.length}`);
      return;
    }
    fixed.forEach((cell, index) => {
      if (cell.position !== "absolute") issues.push(`${row.testId} column ${cell.column}: position ${cell.position}`);
      const expectedRight = index === fixed.length - 1 ? snapshot.viewport.right : fixed[index + 1].box.left;
      if (differs(cell.box.right, expectedRight)) {
        issues.push(`${row.testId} column ${cell.column}: right ${cell.box.right}, expected ${expectedRight}`);
      }
    });
    if (flow.length && fixed.length) {
      // Widths are rounded up to whole pixels: the flow may end up to one pixel per column
      // under the fixed columns, never more (that would be a column nobody can see).
      const overlap = Math.max(...flow.map((cell) => cell.box.right)) - fixed[0].box.left;
      if (overlap > flow.length + TOLERANCE || overlap < -TOLERANCE) {
        issues.push(`${row.testId}: flow columns end ${overlap}px after the start of the fixed columns`);
      }
    }
  });
  return issues;
}

/** Rows fixed at the end: stacked against the bottom edge of the window, as wide as it. */
export function fixedEndRowIssues(snapshot: ITableSnapshot, expectedCount: number): string[] {
  const issues: string[] = [];
  const fixed = bodyRows(snapshot).filter((row) => row.position === "absolute");
  if (fixed.length !== expectedCount) return [`${fixed.length} fixed end rows, expected ${expectedCount}`];
  fixed.forEach((row, index) => {
    const expectedBottom = index === fixed.length - 1 ? snapshot.viewport.bottom : fixed[index + 1].box.top;
    if (differs(row.box.bottom, expectedBottom))
      issues.push(`${row.testId}: bottom ${row.box.bottom}, expected ${expectedBottom}`);
    if (differs(row.box.left, snapshot.viewport.left) || differs(row.box.right, snapshot.viewport.right)) {
      issues.push(
        `${row.testId}: [${row.box.left}, ${row.box.right}], window [${snapshot.viewport.left}, ${snapshot.viewport.right}]`,
      );
    }
  });
  const flow = bodyRows(snapshot).filter((row) => row.position !== "absolute");
  if (flow.length && fixed.length) {
    const flowBottom = Math.max(...flow.map((row) => row.box.bottom));
    if (flowBottom > fixed[0].box.top + TOLERANCE) {
      issues.push(`flow rows end at ${flowBottom}, fixed rows start at ${fixed[0].box.top}`);
    }
  }
  return issues;
}

/** The table fills its window and never goes beyond its right edge. */
export function windowIssues(snapshot: ITableSnapshot): string[] {
  const issues: string[] = [];
  if (differs(snapshot.table.left, snapshot.viewport.left) || differs(snapshot.table.right, snapshot.viewport.right)) {
    issues.push(
      `table [${snapshot.table.left}, ${snapshot.table.right}], window [${snapshot.viewport.left}, ${snapshot.viewport.right}]`,
    );
  }
  return issues;
}

/**
 * The table starts at the left edge of its window and reaches its right edge. Column widths are
 * rounded up to whole pixels: without a column fixed at the end to cover it, the table may go
 * up to one pixel per column beyond the edge, where it is cut like any last column.
 */
export function windowFillIssues(snapshot: ITableSnapshot): string[] {
  const columns = headerRow(snapshot).cells.length;
  const beyond = snapshot.table.right - snapshot.viewport.right;
  if (differs(snapshot.table.left, snapshot.viewport.left) || beyond < -TOLERANCE || beyond > columns + TOLERANCE) {
    return [
      `table [${snapshot.table.left}, ${snapshot.table.right}], window [${snapshot.viewport.left}, ${snapshot.viewport.right}], ${columns} columns`,
    ];
  }
  return [];
}

export interface IExpectedGroup {
  /** Identity of the group at this depth: neighbouring columns with the same key share a cell */
  key: string;
  label: string;
}

/**
 * Group cells: one per run of neighbouring columns of the same group, with its label, and
 * exactly as wide as its columns — a group never spans both the flow and the fixed end columns.
 */
export function groupIssues(snapshot: ITableSnapshot, getGroup: (column: number, depth: number) => IExpectedGroup): string[] {
  const issues: string[] = [];
  const columns = headerRow(snapshot).cells.filter((cell) => cell.column !== null);
  groupRows(snapshot).forEach((row, depth) => {
    const runs: { key: string; label: string; cells: ICellSnapshot[] }[] = [];
    columns.forEach((cell) => {
      const group = getGroup(cell.column as number, depth);
      const key = `${group.key}|${cell.position === "absolute" ? "fixed" : "flow"}`;
      const last = runs[runs.length - 1];
      if (last && last.key === key) last.cells.push(cell);
      else runs.push({ key, label: group.label, cells: [cell] });
    });
    const describe = (list: { label: string; size: number }[]) => list.map((item) => `"${item.label}"x${item.size}`).join(" ");
    const expected = describe(runs.map((run) => ({ label: run.label, size: run.cells.length })));
    const actual = describe(row.cells.map((cell) => ({ label: cell.text, size: cell.colSpan })));
    if (expected !== actual) {
      issues.push(`group row ${depth}: expected ${expected}, got ${actual}`);
      return;
    }
    runs.forEach((run, index) => {
      const cell = row.cells[index];
      const left = Math.min(...run.cells.map((column) => column.box.left));
      const right = Math.max(...run.cells.map((column) => column.box.right));
      if (differs(cell.box.left, left) || differs(cell.box.right, right)) {
        issues.push(
          `group row ${depth} "${run.label}" (columns ${run.cells.map((column) => column.column).join(",")}): cell [${cell.box.left}, ${cell.box.right}], columns [${left}, ${right}]`,
        );
      }
    });
  });
  return issues;
}

export const renderedColumns = (snapshot: ITableSnapshot) => headerRow(snapshot).cells.map((cell) => cell.column);
