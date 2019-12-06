/// <reference path="../../typings/tests-entry.d.ts" />

import * as React from "react";
import { createRenderer } from "react-test-renderer/shallow";

import { DumbCellDimensionController } from "../../../src/components/table-interactions-manager/cell-dimensions-controller";
import { CellSize } from "../../../src/components/table-interactions-manager/reducers";

describe("CellDimensionController component", () => {
  test("should render the default CellDimensionController", () => {
    const props = {
      cellWidth: { value: 60, size: CellSize.small },
      rowHeight: { value: 60, size: CellSize.small },
      updateRowHeight: jest.fn(),
      updateCellWidth: jest.fn()
    };
    const shallowRenderer = createRenderer();
    shallowRenderer.render(
      <DumbCellDimensionController {...props} buttonRenderer={toggleMenu => <span onClick={toggleMenu}>Foo</span>} />
    );
    const rendered = shallowRenderer.getRenderOutput();
    expect(rendered).toMatchSnapshot();
  });
});
