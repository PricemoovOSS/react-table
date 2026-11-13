import * as React from "react";
import { act, fireEvent, render } from "@testing-library/react";

import SelectionHandler, { ISelection } from "../../../src/components/table-selection/selection-handler";
import { MouseClickButtons } from "../../../src/components/constants";

interface RenderResult {
  selection: () => ISelection;
}

function setup(extra: Partial<React.ComponentProps<typeof SelectionHandler>> = {}): RenderResult {
  let last: ISelection = { selectedCells: {} };
  render(
    <SelectionHandler {...(extra as object)}>
      {(selection: ISelection) => {
        last = selection;
        return <div data-testid="selection-children" />;
      }}
    </SelectionHandler>,
  );
  return { selection: () => last };
}

describe("SelectionHandler", () => {
  it("renders the children render-prop", () => {
    const { container } = render(<SelectionHandler>{() => <div data-testid="children">Foo</div>}</SelectionHandler>);
    expect(container.querySelector("[data-testid='children']")).not.toBeNull();
  });

  it("selects a single cell on right-click then extends to a rectangle on hover", () => {
    const { selection } = setup();
    act(() => {
      selection().onCellMouseDown!({ rowIndex: 1, cellIndex: 1 }, MouseClickButtons.right);
    });
    expect(selection().selectedCells).toEqual({ 1: [1] });
    act(() => {
      selection().onCellMouseEnter!({ rowIndex: 2, cellIndex: 2 });
    });
    expect(selection().selectedCells).toEqual({ 1: [1, 2], 2: [1, 2] });
  });

  it("locks vertical selection when isDisabledVerticalSelection is set", () => {
    const { selection } = setup({ isDisabledVerticalSelection: true });
    act(() => {
      selection().onCellMouseDown!({ rowIndex: 1, cellIndex: 1 }, MouseClickButtons.right);
      selection().onCellMouseEnter!({ rowIndex: 2, cellIndex: 2 });
    });
    expect(selection().selectedCells).toEqual({ 1: [1, 2] });
  });

  it("locks horizontal selection when isDisabledHorizontalSelection is set", () => {
    const { selection } = setup({ isDisabledHorizontalSelection: true });
    act(() => {
      selection().onCellMouseDown!({ rowIndex: 1, cellIndex: 1 }, MouseClickButtons.right);
      selection().onCellMouseEnter!({ rowIndex: 2, cellIndex: 2 });
    });
    expect(selection().selectedCells).toEqual({ 1: [1], 2: [1] });
  });

  it("stops extending the selection after mouseup", () => {
    const { selection } = setup();
    act(() => {
      selection().onCellMouseDown!({ rowIndex: 1, cellIndex: 1 }, MouseClickButtons.right);
      selection().onCellMouseEnter!({ rowIndex: 2, cellIndex: 2 });
      selection().onCellMouseUp!();
      selection().onCellMouseEnter!({ rowIndex: 3, cellIndex: 3 });
    });
    // Selection didn't grow further because mouseup reset the starting cell.
    expect(selection().selectedCells).toEqual({ 1: [1, 2], 2: [1, 2] });
  });

  it("does not respond to bubbling outside cell handlers", () => {
    const { selection } = setup();
    fireEvent.click(document.body);
    expect(selection().selectedCells).toEqual({});
  });
});
