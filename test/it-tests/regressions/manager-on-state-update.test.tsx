/**
 * FINDING 3 — `TableInteractionsManager` calls `onStateUpdate` after EVERY render when the
 * callback is written inline, and loops when the callback stores what it receives.
 *
 * Cause: src/components/table-interactions-manager/table-interactions-manager.tsx:131-133 —
 * the effect depends on `[state, onStateUpdate]`. 4.0.2 depended on `[state]` only: an inline
 * callback was called once per change of state.
 *
 * Correct result (4.0.2, executed): 1 call after the mount and 3 renders of the parent;
 * 2 renders for a callback that stores a copy of the state.
 */
import * as React from "react";
import { render } from "@testing-library/react";

import TableInteractionsManager from "../../../src/components/table-interactions-manager/table-interactions-manager";

describe("FINDING 3 — onStateUpdate of the interactions manager", () => {
  it("is called once per change of state, not once per render (observed: 4 calls instead of 1)", () => {
    const calls: unknown[] = [];
    const ui = (tick: number) => (
      <TableInteractionsManager onStateUpdate={(state) => calls.push(state)}>
        <span>{tick}</span>
      </TableInteractionsManager>
    );
    const view = render(ui(0));
    view.rerender(ui(1));
    view.rerender(ui(2));
    view.rerender(ui(3));
    expect(calls).toHaveLength(1);
  });

  it("does not loop when the callback saves a copy of the state (observed: endless renders)", () => {
    let renders = 0;
    const App = () => {
      const [saved, setSaved] = React.useState<object | null>(null);
      renders += 1;
      return (
        <TableInteractionsManager
          onStateUpdate={(state) => {
            // Bounded on purpose: without this guard the loop never ends and jest hangs.
            if (renders < 40) setSaved({ ...state });
          }}
        >
          <span>{saved ? "saved" : "none"}</span>
        </TableInteractionsManager>
      );
    };
    render(<App />);
    expect(renders).toBe(2);
  });
});
