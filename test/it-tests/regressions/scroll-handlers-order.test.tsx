import { makeRows, mount } from "./harness";

/**
 * REVIEW FINDING (minor) — the scroll handlers are not called in the order of 4.0.2.
 *
 * 4.0.2: onScroll, onHorizontallyScroll, onVerticallyScroll (virtualizer.tsx:415-433 of 4.0.2).
 * 5.0: onScroll, onVerticallyScroll, onHorizontallyScroll (src/components/virtualizer.tsx:293-295).
 * Not listed in the changelog. An application whose vertical handler reads what its horizontal
 * handler has just stored (or the reverse) now reads the value of the previous scroll.
 * The values given to the handlers are the same as in 4.0.2 (compared on 13 scroll steps
 * during the review), apart from the documented window of N items instead of N + 1.
 */
describe("review: order of the scroll handlers", () => {
  it("calls them in the order of 4.0.2", () => {
    const calls: string[] = [];
    const table = mount({
      id: "t",
      rows: makeRows(100, 40),
      isVirtualized: true,
      isSelectable: false,
      virtualizerProps: {
        width: 1000,
        height: 500,
        onScroll: () => calls.push("onScroll"),
        onVerticallyScroll: () => calls.push("onVerticallyScroll"),
        onHorizontallyScroll: () => calls.push("onHorizontallyScroll"),
      },
    });
    table.scroll({ scrollTop: 1000, scrollLeft: 1000 });
    // CORRECT (4.0.2): horizontal before vertical. Observed: vertical before horizontal.
    expect(calls).toEqual(["onScroll", "onHorizontallyScroll", "onVerticallyScroll"]);
  });
});
