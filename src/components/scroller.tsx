import * as React from "react";

import { getScrollbarSize } from "./utils/table";

export const SCROLLBAR_SIZE = getScrollbarSize();

const SCROLL_END_THRESHOLD = 5;

export enum ScrollDirection {
  up = "up",
  down = "down",
  right = "right",
  left = "left",
}

export const VERTICAL_SCROLL_DIRECTIONS: ReadonlyArray<ScrollDirection> = [ScrollDirection.up, ScrollDirection.down];

export const HORIZONTAL_SCROLL_DIRECTIONS: ReadonlyArray<ScrollDirection> = [ScrollDirection.left, ScrollDirection.right];

export enum ScrollOrigin {
  /** Scroll triggered by the native scrollbar */
  native = "native",
  /** Scroll triggered by an imperative call (scrollToTop / scrollToLeft) */
  external = "external",
}

export interface IOnScroll {
  /** The scroll direction(s) detected since the last event */
  directions: ScrollDirection[];
  /** The origin of the scroll (native scrollbar vs imperative call) */
  scrollOrigin: ScrollOrigin;
  maxTopReached: boolean;
  maxBottomReached: boolean;
  maxLeftReached: boolean;
  maxRightReached: boolean;
  scrollTop: number;
  scrollLeft: number;
}

export interface IScrollerHandle {
  scrollToLeft: (scrollLeft: number) => boolean;
  scrollToTop: (scrollTop: number) => boolean;
  getScrollValues: () => IOnScroll;
}

export interface IScrollerProps {
  /** The total content width */
  virtualWidth: number;
  /** The total content height */
  virtualHeight: number;
  /** Visible viewport width */
  width: number;
  /** Visible viewport height */
  height: number;
  /** Width of one horizontal "page" — used to keep relative position when virtualWidth changes */
  horizontalPartWidth?: number;
  /** Indexes of horizontal parts excluded from layout */
  ignoredHorizontalParts?: number[];
  children?: React.ReactNode;
  /** Called when the user (or scrollTo*) scrolls the container */
  onScroll: (scrollValues: IOnScroll) => void;
}

const Scroller = React.forwardRef<IScrollerHandle, IScrollerProps>(function Scroller(
  { virtualWidth, virtualHeight, width, height, horizontalPartWidth, ignoredHorizontalParts, children, onScroll },
  ref,
) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const scrollOriginRef = React.useRef<ScrollOrigin>(ScrollOrigin.native);
  const previousScrollTopRef = React.useRef<number>(0);
  const previousScrollLeftRef = React.useRef<number>(0);
  const scrollTopMaxRef = React.useRef<number>(0);
  const scrollLeftMaxRef = React.useRef<number>(0);
  const previousIgnoredPartsRef = React.useRef<number[] | undefined>(ignoredHorizontalParts);
  const previousVirtualWidthRef = React.useRef<number>(virtualWidth);

  const hasHorizontalScrollBar = virtualWidth > width;
  const hasVerticalScrollBar = virtualHeight > height;
  const verticalScrollBar = hasVerticalScrollBar ? SCROLLBAR_SIZE : 0;
  const horizontalScrollBar = hasHorizontalScrollBar ? SCROLLBAR_SIZE : 0;
  const minWidth = width || SCROLLBAR_SIZE;
  const minHeight = height || SCROLLBAR_SIZE;

  // Recompute scroll bounds whenever the viewport or content size changes.
  React.useLayoutEffect(() => {
    scrollTopMaxRef.current = virtualHeight - height - SCROLL_END_THRESHOLD + horizontalScrollBar;
    scrollLeftMaxRef.current = virtualWidth - width - SCROLL_END_THRESHOLD + verticalScrollBar;
  }, [virtualHeight, virtualWidth, width, height, verticalScrollBar, horizontalScrollBar]);

  const getScrollDirections = React.useCallback((): ScrollDirection[] => {
    const node = containerRef.current;
    if (!node) return [];
    const directions: ScrollDirection[] = [];
    if (previousScrollTopRef.current > node.scrollTop) directions.push(ScrollDirection.up);
    else if (previousScrollTopRef.current < node.scrollTop) directions.push(ScrollDirection.down);
    if (previousScrollLeftRef.current > node.scrollLeft) directions.push(ScrollDirection.left);
    else if (previousScrollLeftRef.current < node.scrollLeft) directions.push(ScrollDirection.right);
    return directions;
  }, []);

  const getScrollValues = React.useCallback((): IOnScroll => {
    const node = containerRef.current;
    const scrollTop = node?.scrollTop ?? 0;
    const scrollLeft = node?.scrollLeft ?? 0;
    return {
      directions: getScrollDirections(),
      scrollOrigin: scrollOriginRef.current,
      maxTopReached: scrollTop <= 0,
      maxBottomReached: scrollTop >= scrollTopMaxRef.current,
      maxLeftReached: scrollLeft <= 0,
      maxRightReached: scrollLeft >= scrollLeftMaxRef.current,
      scrollTop,
      scrollLeft,
    };
  }, [getScrollDirections]);

  const scrollToLeft = React.useCallback(
    (scrollLeft: number): boolean => {
      const node = containerRef.current;
      if (!node || virtualWidth <= width) return false;
      const clamped = Math.max(0, Math.min(scrollLeft, scrollLeftMaxRef.current));
      if (node.scrollLeft === clamped) return false;
      node.scrollLeft = clamped;
      scrollOriginRef.current = ScrollOrigin.external;
      return true;
    },
    [virtualWidth, width],
  );

  const scrollToTop = React.useCallback(
    (scrollTop: number): boolean => {
      const node = containerRef.current;
      if (!node || virtualHeight <= height) return false;
      const clamped = Math.max(0, Math.min(scrollTop, scrollTopMaxRef.current));
      if (node.scrollTop === clamped) return false;
      node.scrollTop = clamped;
      scrollOriginRef.current = ScrollOrigin.external;
      return true;
    },
    [virtualHeight, height],
  );

  // Preserve relative horizontal position when virtualWidth shrinks/grows because columns were hidden/shown.
  React.useLayoutEffect(() => {
    const node = containerRef.current;
    const prevVirtualWidth = previousVirtualWidthRef.current;
    if (node && horizontalPartWidth && prevVirtualWidth !== virtualWidth && node.scrollLeft) {
      const diff = prevVirtualWidth - virtualWidth;
      const percentageDiff = (100 * diff) / prevVirtualWidth;
      const newRelativeDiff = (virtualWidth * percentageDiff) / 100;
      const nbCurrentParts = ignoredHorizontalParts?.length ?? 0;
      const nbPreviousParts = previousIgnoredPartsRef.current?.length ?? 0;
      const nbRemovedParts = nbPreviousParts - nbCurrentParts;
      const changeDirection = diff >= 0 ? -1 : 1;
      if (nbRemovedParts !== 0) {
        const newLeft = node.scrollLeft - newRelativeDiff + (changeDirection * newRelativeDiff) / nbRemovedParts;
        scrollToLeft(newLeft);
      }
    }
    previousVirtualWidthRef.current = virtualWidth;
    previousIgnoredPartsRef.current = ignoredHorizontalParts;
  }, [virtualWidth, horizontalPartWidth, ignoredHorizontalParts, scrollToLeft]);

  React.useImperativeHandle(ref, () => ({ scrollToLeft, scrollToTop, getScrollValues }), [
    scrollToLeft,
    scrollToTop,
    getScrollValues,
  ]);

  const onContainerScroll = React.useCallback(() => {
    const node = containerRef.current;
    if (!node) return;
    onScroll(getScrollValues());
    previousScrollTopRef.current = node.scrollTop;
    previousScrollLeftRef.current = node.scrollLeft;
    scrollOriginRef.current = ScrollOrigin.native;
  }, [onScroll, getScrollValues]);

  return (
    <div
      data-testid="scroller-container"
      className="scroller-container"
      ref={containerRef}
      onScroll={onContainerScroll}
      style={{
        overflowX: hasHorizontalScrollBar ? "scroll" : "hidden",
        overflowY: hasVerticalScrollBar ? "scroll" : "hidden",
        maxHeight: minHeight,
        maxWidth: minWidth,
      }}
    >
      <div
        className="scroller-content"
        style={{
          minWidth: minWidth - verticalScrollBar,
          minHeight: minHeight - horizontalScrollBar,
        }}
      >
        {children}
      </div>
      <div
        className="scroller-scrollbar"
        style={{
          minWidth: virtualWidth + verticalScrollBar,
          minHeight: virtualHeight + horizontalScrollBar - (hasVerticalScrollBar ? height : 0),
        }}
      />
    </div>
  );
});

export default Scroller;
