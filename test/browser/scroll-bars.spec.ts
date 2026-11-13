import { expect, test } from "@playwright/test";

import { openStory } from "./support/table-page";

// Scroll bars that take room in the page, as on most desktops: the other tests run with hidden ones.
test.use({ launchOptions: { ignoreDefaultArgs: ["--hide-scrollbars"] } });

const STORIES = [
  "table-combinations--fixed-right-column",
  "table-combinations--fixed-bottom-row-with-opened-sub-rows",
  "table-combinations--groups-fixed-and-hidden",
  "table-combinations--sizes-groups-fixed-and-hidden",
];

interface IPlace {
  position: string;
  top: number;
  left: number;
  beyondBottom: number;
  beyondRight: number;
}

test.describe("with scroll bars that take room", () => {
  for (const story of STORIES) {
    test(`the table stays inside what the bars leave visible, at every end of the scroll (${story})`, async ({ page }) => {
      await openStory(page, story);
      const state = await page.evaluate(async () => {
        const scroller = document.querySelector(".scroller-container") as HTMLElement;
        const content = scroller.querySelector(".scroller-content") as HTMLElement;
        const table = scroller.querySelector(".table-root") as HTMLElement;
        const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        const round = (value: number) => Math.round(value * 10) / 10;
        const places: { position: string; top: number; left: number; beyondBottom: number; beyondRight: number }[] = [];
        const ends: [string, number, number][] = [
          ["start", 0, 0],
          ["middle", scroller.scrollWidth / 3, scroller.scrollHeight / 3],
          ["end", scroller.scrollWidth, scroller.scrollHeight],
          ["end of the rows only", 0, scroller.scrollHeight],
          ["end of the columns only", scroller.scrollWidth, 0],
        ];
        for (const [position, left, top] of ends) {
          scroller.scrollLeft = left;
          scroller.scrollTop = top;
          await frame();
          const box = scroller.getBoundingClientRect();
          const tableBox = table.getBoundingClientRect();
          places.push({
            position,
            top: round(tableBox.top - box.top),
            left: round(tableBox.left - box.left),
            beyondBottom: round(tableBox.bottom - (box.top + scroller.clientHeight)),
            beyondRight: round(tableBox.right - (box.left + scroller.clientWidth)),
          });
        }
        return {
          bars: {
            horizontal: scroller.offsetHeight - scroller.clientHeight,
            vertical: scroller.offsetWidth - scroller.clientWidth,
          },
          visible: { width: scroller.clientWidth, height: scroller.clientHeight },
          content: { width: parseFloat(content.style.minWidth), height: parseFloat(content.style.minHeight) },
          rows: table.querySelectorAll("tr").length,
          columns: table.querySelector("tr.table-row:not(.table-groups-row)")?.children.length ?? 0,
          places,
        };
      });
      test.skip(state.bars.horizontal === 0 && state.bars.vertical === 0, "this browser draws its scroll bars over the content");

      // the block the table sticks to is exactly what the bars leave visible
      expect(state.content).toEqual(state.visible);
      state.places.forEach((place: IPlace) => {
        // the header and the first column never leave the window
        expect({ position: place.position, top: place.top, left: place.left }).toEqual({
          position: place.position,
          top: 0,
          left: 0,
        });
        // at the end of an axis the last items are displayed: sizes are rounded up to whole pixels, one pixel
        // per row or column at most goes under the bars (elsewhere the window ends on a cut row or column)
        if (place.position.includes("end") && !place.position.includes("columns only")) {
          expect(place.beyondBottom, `${place.position}: rows under the horizontal bar`).toBeLessThanOrEqual(state.rows);
        }
        if (place.position.includes("end") && !place.position.includes("rows only")) {
          expect(place.beyondRight, `${place.position}: columns under the vertical bar`).toBeLessThanOrEqual(state.columns);
        }
      });
    });
  }
});
