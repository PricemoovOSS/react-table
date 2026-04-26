import * as React from "react";
import { fireEvent } from "@testing-library/react";

import CellWithIcon from "../../../src/components/styled-table/cell-with-icon";
import { customRender, screen } from "../../tests-utils/react-testing-library-utils";

describe("CellWithIcon", () => {
  it("renders an icon and the value", () => {
    customRender(<CellWithIcon value="TUNING" iconName="edit" />);
    expect(screen.getByText("TUNING")).toBeInTheDocument();
    expect(screen.getByText("edit")).toBeInTheDocument();
  });

  it("renders a button when onClick is provided", () => {
    customRender(<CellWithIcon value="TUNING" iconName="edit" onClick={() => undefined} />);
    expect(screen.getByTestId("toolbar-action-btn")).toBeInTheDocument();
  });

  it("renders a tooltip wrapper when tooltipTitle is provided", () => {
    customRender(<CellWithIcon value="TUNING" iconName="edit" tooltipTitle="Hello Foo" />);
    // MUI Tooltip lazy-renders the popper but adds aria-label on the trigger.
    expect(screen.getByLabelText("Hello Foo")).toBeInTheDocument();
  });

  it("invokes onClick when the action button is clicked", () => {
    const onClick = jest.fn();
    customRender(<CellWithIcon value="Foo" iconName="edit" onClick={onClick} />);
    fireEvent.click(screen.getByTestId("toolbar-action-btn"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
