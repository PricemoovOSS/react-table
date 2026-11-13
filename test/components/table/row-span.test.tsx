import * as React from "react";
import { fireEvent } from "@testing-library/react";

import RowSpan from "../../../src/components/table/row-span";
import { customRender, screen } from "../../tests-utils/react-testing-library-utils";

function renderInTable(ui: React.ReactNode) {
  return customRender(
    <table>
      <tbody>
        <tr>{ui}</tr>
      </tbody>
    </table>,
  );
}

describe("RowSpan", () => {
  it("renders the closed icon when not opened", () => {
    renderInTable(<RowSpan opened={false} length={2} title="Foo" color="red" toggle={() => undefined} />);
    expect(screen.getByTestId("table-toggle-row-btn")).toHaveTextContent("keyboard_arrow_right");
  });

  it("renders the opened icon when opened", () => {
    renderInTable(<RowSpan opened length={2} title="Foo" toggle={() => undefined} />);
    expect(screen.getByTestId("table-toggle-row-btn")).toHaveTextContent("keyboard_arrow_down");
  });

  it("renders the title", () => {
    renderInTable(<RowSpan opened length={3} title="Foo" toggle={() => undefined} />);
    expect(screen.getByText("Foo")).toBeInTheDocument();
  });

  it("invokes toggle when the button is clicked", () => {
    const toggle = jest.fn();
    renderInTable(<RowSpan opened length={2} title="Foo" toggle={toggle} />);
    fireEvent.click(screen.getByTestId("table-toggle-row-btn"));
    expect(toggle).toHaveBeenCalledTimes(1);
  });

  it("applies the configured rowSpan", () => {
    renderInTable(<RowSpan opened length={4} title="Foo" toggle={() => undefined} />);
    const td = screen.getByTestId("table-toggle-row-btn").closest("td");
    expect(td).toHaveAttribute("rowspan", "4");
  });
});
