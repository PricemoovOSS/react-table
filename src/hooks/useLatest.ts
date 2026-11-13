import * as React from "react";

/** Ref on the last committed value, for callbacks that must keep the same identity. */
export function useLatest<T>(value: T): React.MutableRefObject<T> {
  const ref = React.useRef(value);
  React.useLayoutEffect(() => {
    ref.current = value;
  });
  return ref;
}
