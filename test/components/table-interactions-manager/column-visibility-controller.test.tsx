import * as React from "react";
import { fireEvent } from "@testing-library/react";

import { DumbColumnVisibilityController } from "../../../src/components/table-interactions-manager/column-visibility-controller";
import { customRender, screen } from "../../tests-utils/react-testing-library-utils";

const columns = [
  { id: "foo", index: 1, label: "FOO" },
  { id: "bar", index: 2, label: "BAR" },
];

describe("ColumnVisibilityController", () => {
  it("renders one menu entry per column", () => {
    customRender(
      <DumbColumnVisibilityController
        columns={columns}
        hiddenColumnsIds={["foo"]}
        updateHiddenIds={jest.fn()}
        buttonRenderer={(toggle) => (
          <button data-testid="open" onClick={toggle}>
            Open
          </button>
        )}
      />,
    );
    fireEvent.click(screen.getByTestId("open"));
    expect(screen.getByTestId("column-visibility-foo")).toBeInTheDocument();
    expect(screen.getByTestId("column-visibility-bar")).toBeInTheDocument();
  });

  it("toggles a column's visibility on click", () => {
    const updateHiddenIds = jest.fn();
    const onColumnVisibilityChange = jest.fn();
    customRender(
      <DumbColumnVisibilityController
        columns={columns}
        hiddenColumnsIds={["foo"]}
        updateHiddenIds={updateHiddenIds}
        onColumnVisibilityChange={onColumnVisibilityChange}
        buttonRenderer={(toggle) => (
          <button data-testid="open" onClick={toggle}>
            Open
          </button>
        )}
      />,
    );
    fireEvent.click(screen.getByTestId("open"));
    fireEvent.click(screen.getByTestId("column-visibility-foo"));
    expect(updateHiddenIds).toHaveBeenCalledWith([]);
    expect(onColumnVisibilityChange).toHaveBeenCalledWith(1, true);

    // The component is uncontrolled here — `hiddenColumnsIds` stays ["foo"] across clicks because
    // the test doesn't re-render. Clicking "bar" therefore appends it to the existing ids.
    fireEvent.click(screen.getByTestId("column-visibility-bar"));
    expect(updateHiddenIds).toHaveBeenCalledWith(["foo", "bar"]);
    expect(onColumnVisibilityChange).toHaveBeenCalledWith(2, false);
  });
});
