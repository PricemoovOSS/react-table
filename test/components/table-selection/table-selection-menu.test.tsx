import * as React from "react";
import { fireEvent } from "@testing-library/react";

import TableSelectionMenu, { IMenuAction } from "../../../src/components/table-selection/table-selection-menu";
import { customRender, screen } from "../../tests-utils/react-testing-library-utils";

const selectedCells = { 1: [0, 1, 2], 2: [0, 1, 2] };

function renderMenu(opened: boolean, actions: IMenuAction[] = []) {
  const closeMenu = jest.fn();
  customRender(
    <TableSelectionMenu
      closeMenu={closeMenu}
      selectedCells={selectedCells}
      selectionContext={{ anchorEl: document.body, contextCell: { rowIndex: 0, cellIndex: 2 } }}
      isMenuOpened={opened}
      actions={actions}
    />,
  );
  return { closeMenu };
}

describe("TableSelectionMenu", () => {
  it("does not render menu items when not opened", () => {
    renderMenu(false, [
      { id: "foo", title: "Foo item", component: () => null },
      { id: "bar", title: "Bar item", component: () => null },
    ]);
    expect(screen.queryByText("Foo item")).toBeNull();
  });

  it("renders the configured actions when opened", () => {
    renderMenu(true, [
      { id: "foo", title: "Foo item", component: () => null },
      { id: "bar", title: "Bar item", component: () => null },
    ]);
    expect(screen.getByText("Foo item")).toBeInTheDocument();
    expect(screen.getByText("Bar item")).toBeInTheDocument();
  });

  it("calls closeMenu and renders the action component when an action is clicked", () => {
    const ActionComponent = ({ onClose }: { onClose: () => void }) => (
      <button data-testid="active-action" onClick={onClose}>
        Active
      </button>
    );
    const { closeMenu } = renderMenu(true, [{ id: "foo", title: "Foo item", component: ActionComponent }]);

    fireEvent.click(screen.getByText("Foo item"));
    expect(closeMenu).toHaveBeenCalled();
    expect(screen.getByTestId("active-action")).toBeInTheDocument();
  });
});
