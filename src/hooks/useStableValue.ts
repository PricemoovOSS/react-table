import * as React from "react";
import { cloneDeep, isEqual } from "lodash";

import type { CustomSizesElements } from "../components/utils/table";
import shallowEqual from "../components/utils/shallowEqual";

/**
 * Returns the previous value for as long as the new one is equal to it, so that an inline
 * object or array does not invalidate what is memoized on it.
 */
export function useStableValue<T>(value: T, isEqual: (previous: T, next: T) => boolean): T {
  const ref = React.useRef(value);
  if (ref.current !== value && !isEqual(ref.current, value)) {
    ref.current = value;
  }
  return ref.current;
}

/**
 * The previous options for as long as the new ones have the same content. The comparison is
 * made against a copy: options modified in place and given again in a new object are seen as
 * changed, where a comparison with the previous object would compare them with themselves.
 */
export function useStableOptions<T>(value: T): T {
  const ref = React.useRef<{ value: T; copy: T } | null>(null);
  if (!ref.current || (ref.current.value !== value && !isEqual(ref.current.copy, value))) {
    ref.current = { value, copy: cloneDeep(value) };
  }
  return ref.current.value;
}

export function sameIndexes(a?: number[], b?: number[]): boolean {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

export function sameCustomSizes(a: CustomSizesElements, b: CustomSizesElements): boolean {
  return (
    a.fixed.sum === b.fixed.sum &&
    a.fixed.count === b.fixed.count &&
    a.scrollable.sum === b.scrollable.sum &&
    a.scrollable.count === b.scrollable.count &&
    shallowEqual(a.customSizes, b.customSizes)
  );
}
