import * as React from "react";
import classNames from "classnames";

export interface IElementSize {
  width: number;
  height: number;
}

export interface IResponsiveContainerProps {
  className?: string;
  /**
   * Render-prop receiving the measured size of the container.
   * Children are only rendered once the container has a non-zero width and height.
   */
  children: (size: IElementSize) => React.ReactNode;
}

export type IResponsiveContainerOptionalProps = Pick<IResponsiveContainerProps, "className">;

/**
 * Observes its host `<div>` with `ResizeObserver` and forwards the measured size to its render-prop child.
 * Children render only when the container has a non-zero size — useful as a parent of a virtualized table.
 */
const ResponsiveContainer = React.forwardRef<HTMLDivElement, IResponsiveContainerProps>(function ResponsiveContainer(
  { className, children },
  forwardedRef,
) {
  const [size, setSize] = React.useState<IElementSize>({ width: 0, height: 0 });
  const internalRef = React.useRef<HTMLDivElement | null>(null);

  const setRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      internalRef.current = node;
      if (typeof forwardedRef === "function") {
        forwardedRef(node);
      } else if (forwardedRef) {
        (forwardedRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      }
    },
    [forwardedRef],
  );

  React.useLayoutEffect(() => {
    const node = internalRef.current;
    if (!node || typeof ResizeObserver === "undefined") return undefined;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      // Prefer borderBoxSize when available; fall back to contentRect for older browsers.
      const box = entry.borderBoxSize?.[0];
      const width = box ? box.inlineSize : entry.contentRect.width;
      const height = box ? box.blockSize : entry.contentRect.height;
      setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={setRef} className={classNames("responsive-container", className)} data-testid="responsive-container">
      {size.width && size.height ? children(size) : null}
    </div>
  );
});

export default ResponsiveContainer;
