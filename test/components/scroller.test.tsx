import * as React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

import Scroller, { IScrollerHandle, SCROLLBAR_SIZE, ScrollDirection, ScrollOrigin } from "../../src/components/scroller";

const baseProps = {
  width: 300,
  height: 300,
  virtualWidth: 4000,
  virtualHeight: 4000,
};

function renderScroller(overrides: Partial<React.ComponentProps<typeof Scroller>> = {}) {
  const onScroll = jest.fn();
  const ref = React.createRef<IScrollerHandle>();
  const utils = render(<Scroller ref={ref} {...baseProps} onScroll={onScroll} {...overrides} />);
  return { ...utils, ref, onScroll };
}

describe("Scroller", () => {
  it("renders both axes when virtual size exceeds the viewport", () => {
    renderScroller();
    const container = screen.getByTestId("scroller-container");
    expect(container).toHaveStyle({ overflowX: "scroll", overflowY: "scroll" });
  });

  it("hides the vertical scrollbar when virtualHeight equals height", () => {
    renderScroller({ virtualHeight: baseProps.height });
    expect(screen.getByTestId("scroller-container")).toHaveStyle({ overflowY: "hidden" });
  });

  it("hides the horizontal scrollbar when virtualWidth equals width", () => {
    renderScroller({ virtualWidth: baseProps.width });
    expect(screen.getByTestId("scroller-container")).toHaveStyle({ overflowX: "hidden" });
  });

  it("emits onScroll with the right values on a native vertical scroll", () => {
    const { onScroll } = renderScroller();
    const container = screen.getByTestId("scroller-container");
    container.scrollTop = 1500;
    fireEvent.scroll(container);

    expect(onScroll).toHaveBeenCalledTimes(1);
    expect(onScroll).toHaveBeenCalledWith({
      directions: [ScrollDirection.down],
      scrollOrigin: ScrollOrigin.native,
      maxTopReached: false,
      maxBottomReached: false,
      maxLeftReached: true,
      maxRightReached: false,
      scrollLeft: 0,
      scrollTop: 1500,
    });
  });

  it("scrolls to the requested top via the imperative API and reports external origin", () => {
    const { ref, onScroll } = renderScroller();
    expect(ref.current?.scrollToTop(1500)).toBe(true);

    const container = screen.getByTestId("scroller-container");
    expect(container.scrollTop).toBe(1500);
    fireEvent.scroll(container);

    expect(onScroll).toHaveBeenCalledWith({
      directions: [ScrollDirection.down],
      scrollOrigin: ScrollOrigin.external,
      maxTopReached: false,
      maxBottomReached: false,
      maxLeftReached: true,
      maxRightReached: false,
      scrollLeft: 0,
      scrollTop: 1500,
    });
  });

  it("reports maxBottomReached when reaching the bottom of the content", () => {
    const { ref, onScroll } = renderScroller();
    const maxScrollTop = baseProps.virtualHeight - baseProps.height - 5 + SCROLLBAR_SIZE;
    ref.current?.scrollToTop(maxScrollTop);
    fireEvent.scroll(screen.getByTestId("scroller-container"));

    expect(onScroll).toHaveBeenCalledWith(
      expect.objectContaining({ maxBottomReached: true, scrollTop: maxScrollTop, scrollOrigin: ScrollOrigin.external }),
    );
  });

  it("scrolls to the requested left via the imperative API", () => {
    const { ref, onScroll } = renderScroller();
    expect(ref.current?.scrollToLeft(1500)).toBe(true);

    const container = screen.getByTestId("scroller-container");
    expect(container.scrollLeft).toBe(1500);
    fireEvent.scroll(container);

    expect(onScroll).toHaveBeenCalledWith(
      expect.objectContaining({
        directions: [ScrollDirection.right],
        scrollOrigin: ScrollOrigin.external,
        scrollLeft: 1500,
      }),
    );
  });

  it("reports maxRightReached at the right edge", () => {
    const { ref, onScroll } = renderScroller();
    const maxScrollLeft = baseProps.virtualWidth - baseProps.width - 5 + SCROLLBAR_SIZE;
    ref.current?.scrollToLeft(maxScrollLeft);
    fireEvent.scroll(screen.getByTestId("scroller-container"));

    expect(onScroll).toHaveBeenCalledWith(expect.objectContaining({ maxRightReached: true, scrollLeft: maxScrollLeft }));
  });

  it("returns false when scrolling is not possible (no overflow on the axis)", () => {
    const { ref } = renderScroller({ virtualHeight: baseProps.height, virtualWidth: baseProps.width });
    expect(ref.current?.scrollToTop(100)).toBe(false);
    expect(ref.current?.scrollToLeft(100)).toBe(false);
  });

  it("clamps imperative scroll values to the available range", () => {
    const { ref } = renderScroller();
    ref.current?.scrollToTop(99999);
    const container = screen.getByTestId("scroller-container");
    expect(container.scrollTop).toBeLessThanOrEqual(baseProps.virtualHeight);

    ref.current?.scrollToLeft(-100);
    expect(container.scrollLeft).toBe(0);
  });
});
