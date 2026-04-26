import * as React from "react";
import { act, render, screen } from "@testing-library/react";

import ResponsiveContainer from "../../src/components/responsive-container";

type ResizeCallback = (entries: ResizeObserverEntry[]) => void;

interface MockEntry {
  borderBoxSize?: ReadonlyArray<{ inlineSize: number; blockSize: number }>;
  contentRect: { width: number; height: number };
}

function installResizeObserverMock() {
  const callbacks: ResizeCallback[] = [];

  class MockObserver {
    constructor(cb: ResizeCallback) {
      callbacks.push(cb);
    }

    observe(): void {}

    unobserve(): void {}

    disconnect(): void {}
  }

  const previous = window.ResizeObserver;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).ResizeObserver = MockObserver;

  return {
    fire: (entry: MockEntry) => {
      act(() => {
        callbacks.forEach((cb) => cb([entry as unknown as ResizeObserverEntry]));
      });
    },
    restore: () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).ResizeObserver = previous;
    },
  };
}

describe("ResponsiveContainer", () => {
  it("renders the wrapper with the resolved className", () => {
    render(<ResponsiveContainer className="foo-class-name">{() => <div />}</ResponsiveContainer>);
    const container = screen.getByTestId("responsive-container");
    expect(container).toHaveClass("responsive-container", "foo-class-name");
  });

  it("does not render children before a non-zero size has been measured", () => {
    const children = jest.fn(() => <div data-testid="children" />);
    render(<ResponsiveContainer>{children}</ResponsiveContainer>);
    expect(children).not.toHaveBeenCalled();
    expect(screen.queryByTestId("children")).toBeNull();
  });

  it("renders children with the measured size when ResizeObserver fires", () => {
    const observer = installResizeObserverMock();
    try {
      const children = jest.fn(({ width, height }: { width: number; height: number }) => (
        <span data-testid="size">
          {width}x{height}
        </span>
      ));

      render(<ResponsiveContainer>{children}</ResponsiveContainer>);

      observer.fire({
        borderBoxSize: [{ inlineSize: 320, blockSize: 240 }],
        contentRect: { width: 320, height: 240 },
      });

      expect(children).toHaveBeenCalledWith({ width: 320, height: 240 });
      expect(screen.getByTestId("size")).toHaveTextContent("320x240");
    } finally {
      observer.restore();
    }
  });

  it("falls back to contentRect when borderBoxSize is missing", () => {
    const observer = installResizeObserverMock();
    try {
      const children = jest.fn(() => <div data-testid="children" />);
      render(<ResponsiveContainer>{children}</ResponsiveContainer>);

      observer.fire({ contentRect: { width: 800, height: 600 } });

      expect(children).toHaveBeenCalledWith({ width: 800, height: 600 });
    } finally {
      observer.restore();
    }
  });
});
