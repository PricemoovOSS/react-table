import * as React from "react";
import { fireEvent, render } from "@testing-library/react";

import { DumbFixedColumnController } from "../../../src/components/table-interactions-manager/fixed-column-controller";

describe("FixedColumnController", () => {
  it("reports fixed status and toggles ids on click", () => {
    const updateFixedColumnsIds = jest.fn();
    const { getByTestId } = render(
      <DumbFixedColumnController columnId="bar" fixedColumnsIds={["foo"]} updateFixedColumnsIds={updateFixedColumnsIds}>
        {({ toggleFixedColumnId, isFixed }) => (
          <button data-testid="trigger" data-fixed={isFixed} onClick={toggleFixedColumnId}>
            Toggle
          </button>
        )}
      </DumbFixedColumnController>,
    );

    expect(getByTestId("trigger")).toHaveAttribute("data-fixed", "false");
    fireEvent.click(getByTestId("trigger"));
    expect(updateFixedColumnsIds).toHaveBeenCalledWith(["foo", "bar"]);
  });

  it("reports isFixed=true and removes the id when toggled", () => {
    const updateFixedColumnsIds = jest.fn();
    const { getByTestId } = render(
      <DumbFixedColumnController columnId="foo" fixedColumnsIds={["foo", "bar"]} updateFixedColumnsIds={updateFixedColumnsIds}>
        {({ toggleFixedColumnId, isFixed }) => (
          <button data-testid="trigger" data-fixed={isFixed} onClick={toggleFixedColumnId}>
            Toggle
          </button>
        )}
      </DumbFixedColumnController>,
    );
    expect(getByTestId("trigger")).toHaveAttribute("data-fixed", "true");
    fireEvent.click(getByTestId("trigger"));
    expect(updateFixedColumnsIds).toHaveBeenCalledWith(["bar"]);
  });
});
