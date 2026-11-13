import "@testing-library/jest-dom";

// jsdom does not lay out scrollbars; force a deterministic value so virtualizer math is stable.
jest.mock("../src/components/utils/table", () => {
  const actual = jest.requireActual("../src/components/utils/table");
  return {
    __esModule: true,
    ...actual,
    getScrollbarSize: () => 0,
  };
});

// jsdom doesn't ship ResizeObserver; provide a no-op implementation for components that depend on it.
if (typeof window.ResizeObserver === "undefined") {
  class MockResizeObserver {
    observe(): void {}

    unobserve(): void {}

    disconnect(): void {}
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).ResizeObserver = MockResizeObserver;
}

// Make requestAnimationFrame synchronous in tests so scroll-driven assertions stay flush-and-check.
// Production code uses rAF to coalesce trackpad events; tests don't need to wait a frame.
const syncRaf = (cb: FrameRequestCallback): number => {
  cb(performance.now());
  return 0;
};
const noopCaf = () => {};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).requestAnimationFrame = syncRaf;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).cancelAnimationFrame = noopCaf;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).requestAnimationFrame = syncRaf;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).cancelAnimationFrame = noopCaf;
