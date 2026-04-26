import * as React from "react";
import { fireEvent } from "@testing-library/react";

import Cell from "../../../src/components/table/cell";
import { subRows } from "../../../stories/utils/tables";
import { customRender, screen } from "../../tests-utils/react-testing-library-utils";
import { MouseClickButtons } from "../../../src/components/constants";

const baseProps = {
  id: "foo",
  index: 0,
  rowIndex: 0,
  relativeRowIndex: 0,
};

describe("Cell", () => {
  it("renders the value as text by default", () => {
    customRender(
      <table>
        <tbody>
          <tr>
            <Cell {...baseProps} value="bar" />
          </tr>
        </tbody>
      </table>,
    );
    const cell = screen.getByTestId("table-column");
    expect(cell.tagName.toLowerCase()).toBe("td");
    expect(cell).toHaveTextContent("bar");
    expect(cell.querySelector(".cell-value")).toHaveAttribute("title", "bar");
  });

  it("renders a Skeleton when loading", () => {
    customRender(
      <table>
        <tbody>
          <tr>
            <Cell {...baseProps} loading />
          </tr>
        </tbody>
      </table>,
    );
    const cell = screen.getByTestId("table-column");
    expect(cell.querySelector(".cell-skeleton-container")).not.toBeNull();
  });

  it("uses getClassName when provided", () => {
    customRender(
      <table>
        <tbody>
          <tr>
            <Cell {...baseProps} value="bar" getClassName={() => "custom-class"} />
          </tr>
        </tbody>
      </table>,
    );
    expect(screen.getByTestId("table-column")).toHaveClass("custom-class");
  });

  it("applies the column style multiplied by colspan", () => {
    customRender(
      <table>
        <tbody>
          <tr>
            <Cell {...baseProps} value="bar" colspan={2} style={{ width: 50, height: 25 }} />
          </tr>
        </tbody>
      </table>,
    );
    const cell = screen.getByTestId("table-column") as HTMLTableCellElement;
    expect(cell.colSpan).toBe(2);
    expect(cell).toHaveStyle({ width: "100px", height: "25px" });
  });

  it("renders as <th> when component=th", () => {
    customRender(
      <table>
        <thead>
          <tr>
            <Cell {...baseProps} value="bar" component="th" />
          </tr>
        </thead>
      </table>,
    );
    expect(screen.getByTestId("table-column").tagName.toLowerCase()).toBe("th");
  });

  it("does not show the toggle when no subItems", () => {
    customRender(
      <table>
        <tbody>
          <tr>
            <Cell {...baseProps} value="bar" />
          </tr>
        </tbody>
      </table>,
    );
    expect(screen.queryByTestId("table-cell-sub-item-toggle")).toBeNull();
  });

  it("shows a closed toggle when there are sub-items", () => {
    customRender(
      <table>
        <tbody>
          <tr>
            <Cell {...baseProps} value="bar" subItems={subRows({})} />
          </tr>
        </tbody>
      </table>,
    );
    const toggle = screen.getByTestId("table-cell-sub-item-toggle");
    expect(toggle).toHaveTextContent("keyboard_arrow_right");
  });

  it("shows an open toggle when opened=true", () => {
    customRender(
      <table>
        <tbody>
          <tr>
            <Cell {...baseProps} value="bar" subItems={subRows({})} opened />
          </tr>
        </tbody>
      </table>,
    );
    expect(screen.getByTestId("table-cell-sub-item-toggle")).toHaveTextContent("keyboard_arrow_down");
  });

  it("hides the toggle when hideSubItemsOpener is true", () => {
    customRender(
      <table>
        <tbody>
          <tr>
            <Cell {...baseProps} value="bar" subItems={subRows({})} hideSubItemsOpener />
          </tr>
        </tbody>
      </table>,
    );
    expect(screen.queryByTestId("table-cell-sub-item-toggle")).toBeNull();
  });

  it("flags itself selected when isSelected and selectable", () => {
    customRender(
      <table>
        <tbody>
          <tr>
            <Cell {...baseProps} value="bar" isSelected />
          </tr>
        </tbody>
      </table>,
    );
    expect(screen.getByTestId("table-column")).toHaveClass("selected");
  });

  it("renders a custom cellContent component with merged props", () => {
    const cellContent: React.FC<{ name: string; value?: string }> = ({ name, value }) => (
      <div data-testid="custom-content">
        {name}-{value}
      </div>
    );
    customRender(
      <table>
        <tbody>
          <tr>
            <Cell {...baseProps} value="bar" cellContent={cellContent} cellContentProps={{ name: "Foo" }} />
          </tr>
        </tbody>
      </table>,
    );
    expect(screen.getByTestId("custom-content")).toHaveTextContent("Foo-bar");
  });

  it("forwards mouse events with cell coordinates", () => {
    const handlers = {
      onMouseEnter: jest.fn(),
      onMouseDown: jest.fn(),
      onMouseUp: jest.fn(),
      onContextMenu: jest.fn(),
    };
    customRender(
      <table>
        <tbody>
          <tr>
            <Cell {...baseProps} index={2} value="bar" subItems={subRows({})} {...handlers} />
          </tr>
        </tbody>
      </table>,
    );

    const cell = screen.getByTestId("table-column");
    fireEvent.mouseEnter(cell);
    expect(handlers.onMouseEnter).toHaveBeenCalledWith({ rowIndex: 0, cellIndex: 2 });

    fireEvent.mouseDown(cell, { button: 0 });
    expect(handlers.onMouseDown).toHaveBeenCalledWith({ rowIndex: 0, cellIndex: 2 }, MouseClickButtons.left);

    fireEvent.mouseUp(cell);
    expect(handlers.onMouseUp).toHaveBeenCalled();

    const wrapper = screen.getByTestId("table-cell-wrapper-foo");
    fireEvent.contextMenu(cell);
    expect(handlers.onContextMenu).toHaveBeenCalledWith({
      anchorEl: wrapper,
      contextCell: { rowIndex: 0, cellIndex: 2 },
    });
  });

  it("invokes onCallOpen with its index when the toggle is clicked", () => {
    const onCallOpen = jest.fn();
    customRender(
      <table>
        <tbody>
          <tr>
            <Cell {...baseProps} index={2} value="bar" subItems={subRows({})} onCallOpen={onCallOpen} />
          </tr>
        </tbody>
      </table>,
    );
    fireEvent.click(screen.getByTestId("table-cell-sub-item-toggle"));
    expect(onCallOpen).toHaveBeenCalledWith(2);
  });
});
