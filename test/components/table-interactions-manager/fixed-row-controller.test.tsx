import * as React from "react";
import { fireEvent, render } from "@testing-library/react";

import { DumbFixedRowController } from "../../../src/components/table-interactions-manager/fixed-row-controller";

describe("FixedRowController", () => {
  it("reports not-fixed and adds the row index on toggle", () => {
    const updateFixedRowsIndexes = jest.fn();
    const { getByTestId } = render(
      <DumbFixedRowController rowIndex={2} fixedRowsIndexes={[1]} updateFixedRowsIndexes={updateFixedRowsIndexes}>
        {({ toggleFixedRowIndex, isFixed }) => (
          <button data-testid="trigger" data-fixed={isFixed} onClick={toggleFixedRowIndex}>
            Toggle
          </button>
        )}
      </DumbFixedRowController>,
    );
    expect(getByTestId("trigger")).toHaveAttribute("data-fixed", "false");
    fireEvent.click(getByTestId("trigger"));
    expect(updateFixedRowsIndexes).toHaveBeenCalledWith([1, 2]);
  });

  it("removes the row index when already fixed", () => {
    const updateFixedRowsIndexes = jest.fn();
    const { getByTestId } = render(
      <DumbFixedRowController rowIndex={1} fixedRowsIndexes={[1]} updateFixedRowsIndexes={updateFixedRowsIndexes}>
        {({ toggleFixedRowIndex, isFixed }) => (
          <button data-testid="trigger" data-fixed={isFixed} onClick={toggleFixedRowIndex}>
            Toggle
          </button>
        )}
      </DumbFixedRowController>,
    );
    expect(getByTestId("trigger")).toHaveAttribute("data-fixed", "true");
    fireEvent.click(getByTestId("trigger"));
    expect(updateFixedRowsIndexes).toHaveBeenCalledWith([]);
  });
});
