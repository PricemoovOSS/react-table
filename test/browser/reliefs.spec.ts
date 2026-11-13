import { expect, test, Page } from "@playwright/test";

import { capture, darkestAcross, darkestAlong } from "./support/pixels";
import { bodyRows, groupRows, headerRow, IRowSnapshot, openStory, readTable, scrollTable } from "./support/table-page";

/**
 * Reliefs that tell which items are fixed. They are read on a screenshot: a white background
 * is 255, anything under BACKGROUND is a relief. Probes avoid the texts (centred in the cells).
 */
const BACKGROUND = 246;
const STORY = "table-combinations--groups-fixed-and-hidden";
const LAST_COLUMN = 39;

interface IReliefs {
  /** Per row kind: darkest pixel at the edge of the columns fixed on the left, on the right, and between two scrolling columns */
  rows: Record<string, { left: number; right: number; control: number }>;
  underHeader: number;
  betweenRows: number;
}

async function readReliefs(page: Page): Promise<IReliefs> {
  const snapshot = await readTable(page);
  const image = await capture(page);
  const header = headerRow(snapshot);
  const fixedLeft = header.cells.filter((cell) => cell.column !== null && cell.column <= 1).slice(-1)[0];
  const fixedRight = header.cells.find((cell) => cell.column === LAST_COLUMN);
  const scrolling = header.cells.filter((cell) => cell.position !== "absolute")[4];
  if (!fixedRight) throw new Error("no right fixed column");
  const probe = (row: IRowSnapshot) => {
    const y = row.box.bottom - 6;
    return {
      left: darkestAcross(image, fixedLeft.box.right, y),
      right: darkestAcross(image, fixedRight.box.left, y),
      control: darkestAcross(image, scrolling.box.right, y),
    };
  };
  const body = bodyRows(snapshot);
  const rows: IReliefs["rows"] = { header: probe(header), body: probe(body[1]) };
  groupRows(snapshot).forEach((row, depth) => (rows[`groups ${depth}`] = probe(row)));
  const subRow = body.find((row) => row.classes.includes("sub-row"));
  if (subRow) rows["sub row"] = probe(subRow);
  const fixedBottom = body.find((row) => row.position === "absolute");
  if (fixedBottom) rows["bottom fixed row"] = probe(fixedBottom);
  const x = scrolling.box.right - 5;
  return {
    rows,
    underHeader: darkestAlong(image, x, header.box.bottom),
    betweenRows: darkestAlong(image, x, body[2].box.bottom),
  };
}

test.describe("reliefs of the fixed columns and rows", () => {
  test("mark both sides on every kind of row, the same way at every scroll position", async ({ page }) => {
    await openStory(page, STORY);
    await page.evaluate(`window.tableHandle.openTrees({ 2: { rowIndex: 2, columnIndex: 0 } })`);
    const reference = await readReliefs(page);

    expect(Object.keys(reference.rows)).toEqual(["header", "body", "groups 0", "groups 1", "sub row"]);
    Object.entries(reference.rows).forEach(([kind, relief]) => {
      expect(relief.left, `${kind}: columns fixed on the left`).toBeLessThan(BACKGROUND);
      expect(relief.right, `${kind}: columns fixed on the right`).toBeLessThan(BACKGROUND);
      expect(relief.control, `${kind}: between two scrolling columns`).toBeGreaterThanOrEqual(BACKGROUND);
    });
    expect(reference.underHeader).toBeLessThan(BACKGROUND);

    for (const position of [{ left: 777 }, { left: 2000, top: 300 }, { left: "max" as const }, { left: 0, top: 0 }]) {
      await scrollTable(page, position);
      const reliefs = await readReliefs(page);
      // the group rows only carry the left relief while a group ends with the fixed columns
      Object.keys(reliefs.rows).forEach((kind) => {
        expect(reliefs.rows[kind].left, `${kind} left, ${JSON.stringify(position)}`).toBe(reference.rows[kind].left);
        expect(reliefs.rows[kind].right, `${kind} right, ${JSON.stringify(position)}`).toBe(reference.rows[kind].right);
      });
    }
  });

  test("mark the rows fixed at the bottom and their columns fixed on the right", async ({ page }) => {
    await openStory(page, "table-combinations--several-fixed-end-items");
    const snapshot = await readTable(page);
    const image = await capture(page);
    const fixedRows = bodyRows(snapshot).filter((row) => row.position === "absolute");
    const firstFixedColumn = fixedRows[0].cells.find((cell) => cell.position === "absolute");
    const scrolling = headerRow(snapshot).cells[2];
    if (!firstFixedColumn) throw new Error("no right fixed column");

    fixedRows.forEach((row) => {
      expect(darkestAcross(image, firstFixedColumn.box.left, row.box.bottom - 6), row.testId).toBeLessThan(BACKGROUND);
    });
    expect(darkestAlong(image, scrolling.box.right - 5, fixedRows[0].box.top)).toBeLessThan(BACKGROUND);
  });

  test("follow the theme variables", async ({ page }) => {
    await openStory(page, STORY);
    const setTheme = (declarations: string) =>
      page.evaluate((css) => {
        const style = document.getElementById("theme") || document.head.appendChild(document.createElement("style"));
        style.id = "theme";
        style.textContent = `.table-root { ${css} }`;
      }, declarations);

    await setTheme(
      "--rt-elevation-color: transparent; --rt-elevation-start-column-shadow: none; --rt-elevation-start-row-shadow: none;",
    );
    const flat = await readReliefs(page);
    Object.entries(flat.rows).forEach(([kind, relief]) => {
      expect(relief.left, `${kind} left`).toBeGreaterThanOrEqual(BACKGROUND);
      expect(relief.right, `${kind} right`).toBeGreaterThanOrEqual(BACKGROUND);
    });

    await setTheme("--rt-elevation-color: rgba(0, 0, 0, 0.6); --rt-elevation-size: 12px;");
    const strong = await readReliefs(page);
    expect(strong.rows.body.right).toBeLessThan(140);

    await setTheme("--rt-column-separator-color: rgb(120, 120, 120);");
    const separated = await readReliefs(page);
    expect(separated.rows.body.control).toBeLessThan(140);
    expect(separated.rows.header.control).toBeLessThan(140);
  });
});
