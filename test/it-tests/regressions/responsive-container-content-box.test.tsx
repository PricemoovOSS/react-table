import { act, render } from "@testing-library/react";

import Table from "../../../src/components/table/table";
import { makeRows } from "./harness";

/**
 * REVIEW FINDING — a responsive table is sized on the border box of its container, 4.0.2 sized
 * it on the content box.
 *
 * src/components/responsive-container.tsx:51 reads `entry.borderBoxSize[0]` first. 4.0.2 used
 * react-resize-detector 7, which reads `entry.contentRect` (the content box).
 * As soon as `.responsive-container` has a border or a padding, the table is larger than the
 * space it is laid out in. With a border of 1 px on the left, right and top, the table gets
 * 2 px too many in width and 1 px in height, the scroller overflows the container and the last
 * pixels of the scrollbar are clipped.
 *
 * jsdom has no layout: the ResizeObserver entry below is what a browser reports for a
 * container of 1000 x 500 (border box) with a border of 1 px on the left, right and top.
 *
 * Expected (4.0.2): the scroller is 998 x 499. Observed: 1000 x 500.
 */
type ResizeCallback = (entries: ResizeObserverEntry[]) => void;

describe("review: size given to a responsive table", () => {
  it("uses the content box of the container, like 4.0.2", () => {
    const callbacks: ResizeCallback[] = [];
    const previous = window.ResizeObserver;
    (window as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
      constructor(callback: ResizeCallback) {
        callbacks.push(callback);
      }

      observe() {}

      unobserve() {}

      disconnect() {}
    };
    try {
      const view = render(<Table id="t" rows={makeRows(100, 30)} isVirtualized isSelectable={false} />);
      act(() => {
        callbacks.forEach((callback) =>
          callback([
            {
              borderBoxSize: [{ inlineSize: 1000, blockSize: 500 }],
              contentBoxSize: [{ inlineSize: 998, blockSize: 499 }],
              contentRect: { width: 998, height: 499, top: 0, left: 0 },
            } as unknown as ResizeObserverEntry,
          ]),
        );
      });
      const scroller = view.container.querySelector<HTMLElement>("[data-testid='scroller-container']");
      // CORRECT: 998px x 499px — the space inside the border. Observed: 1000px x 500px.
      expect({ maxWidth: scroller?.style.maxWidth, maxHeight: scroller?.style.maxHeight }).toEqual({
        maxWidth: "998px",
        maxHeight: "499px",
      });
    } finally {
      (window as unknown as { ResizeObserver: unknown }).ResizeObserver = previous;
    }
  });
});
