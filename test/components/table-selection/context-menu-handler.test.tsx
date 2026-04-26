import * as React from "react";
import { fireEvent, render } from "@testing-library/react";

import ContextMenuHandler from "../../../src/components/table-selection/context-menu-handler";

describe("ContextMenuHandler", () => {
  it("renders the children render-prop", () => {
    const { getByText } = render(<ContextMenuHandler selectedCells={{}}>{() => <div>Foo</div>}</ContextMenuHandler>);
    expect(getByText("Foo")).toBeInTheDocument();
  });

  it("renders the menu component when a context is set", () => {
    const Menu = ({ isMenuOpened }: { isMenuOpened: boolean }) => (isMenuOpened ? <div data-testid="menu">menu</div> : null);
    const { getByTestId, queryByTestId } = render(
      <ContextMenuHandler selectedCells={{}} menuComponent={Menu}>
        {({ onContextMenu }) => (
          <button
            data-testid="trigger"
            onClick={(event) => onContextMenu({ anchorEl: event.currentTarget, contextCell: { rowIndex: 0, cellIndex: 0 } })}
          >
            x
          </button>
        )}
      </ContextMenuHandler>,
    );
    expect(queryByTestId("menu")).toBeNull();
    fireEvent.click(getByTestId("trigger"));
    expect(getByTestId("menu")).toBeInTheDocument();
  });
});
