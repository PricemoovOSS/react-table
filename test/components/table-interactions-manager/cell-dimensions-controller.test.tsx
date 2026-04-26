import * as React from "react";
import { fireEvent } from "@testing-library/react";

import { DumbCellDimensionController } from "../../../src/components/table-interactions-manager/cell-dimensions-controller";
import { CellSize } from "../../../src/components/table-interactions-manager/reducers";
import { customRender, screen } from "../../tests-utils/react-testing-library-utils";

describe("CellDimensionController", () => {
  it("opens the menu when the button activator is clicked", () => {
    const props = {
      cellWidth: { value: 60, size: CellSize.small },
      rowHeight: { value: 60, size: CellSize.small },
      updateRowHeight: jest.fn(),
      updateCellWidth: jest.fn(),
    };
    customRender(
      <DumbCellDimensionController
        {...props}
        buttonRenderer={(toggleMenu) => (
          <button data-testid="open-menu" onClick={toggleMenu}>
            Open
          </button>
        )}
      />,
    );
    fireEvent.click(screen.getByTestId("open-menu"));
    expect(screen.getByTestId("cell-dimensions-menu")).toBeInTheDocument();
    expect(screen.getByTestId("column-width-dimension-checked")).toBeInTheDocument();
  });

  it("invokes updateCellWidth and updateRowHeight when entries are clicked", () => {
    const props = {
      cellWidth: { value: 60, size: CellSize.small },
      rowHeight: { value: 60, size: CellSize.small },
      updateRowHeight: jest.fn(),
      updateCellWidth: jest.fn(),
    };
    customRender(
      <DumbCellDimensionController
        {...props}
        buttonRenderer={(toggleMenu) => (
          <button data-testid="open-menu" onClick={toggleMenu}>
            Open
          </button>
        )}
      />,
    );
    fireEvent.click(screen.getByTestId("open-menu"));

    fireEvent.click(screen.getByTestId(`column-width-dimension-${CellSize.large}`));
    expect(props.updateCellWidth).toHaveBeenCalledWith({ size: CellSize.large, value: expect.any(Number) });

    fireEvent.click(screen.getByTestId(`row-height-dimension-${CellSize.medium}`));
    expect(props.updateRowHeight).toHaveBeenCalledWith({ size: CellSize.medium, value: expect.any(Number) });
  });

  it("uses provided rowHeightOptions / cellWidthOptions when given", () => {
    const props = {
      cellWidth: { value: 100, size: "xs" },
      rowHeight: { value: 100, size: "s" },
      rowHeightOptions: { s: 100, m: 200 },
      cellWidthOptions: { xs: 100, xl: 200 },
      updateRowHeight: jest.fn(),
      updateCellWidth: jest.fn(),
    };
    customRender(
      <DumbCellDimensionController
        {...props}
        buttonRenderer={(toggleMenu) => (
          <button data-testid="open-menu" onClick={toggleMenu}>
            Open
          </button>
        )}
      />,
    );
    fireEvent.click(screen.getByTestId("open-menu"));
    expect(screen.getByTestId("column-width-dimension-xs")).toBeInTheDocument();
    expect(screen.getByTestId("column-width-dimension-xl")).toBeInTheDocument();
    expect(screen.getByTestId("row-height-dimension-s")).toBeInTheDocument();
    expect(screen.getByTestId("row-height-dimension-m")).toBeInTheDocument();
  });
});
