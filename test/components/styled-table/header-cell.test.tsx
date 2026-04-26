import * as React from "react";
import { render } from "@testing-library/react";

import HeaderCell from "../../../src/components/styled-table/header-cell";

describe("HeaderCell", () => {
  it("renders the title and value", () => {
    const { getByText } = render(<HeaderCell title="Foo" value="Bar" />);
    expect(getByText("Foo")).toBeInTheDocument();
    expect(getByText("Bar")).toBeInTheDocument();
  });

  it("applies a custom className", () => {
    const { container } = render(<HeaderCell title="Foo" value="Bar" className="custom" />);
    expect(container.querySelector(".header-cell")).toHaveClass("custom");
  });

  it("wraps the cell in a Bubble when isCurrent", () => {
    const { container, getByText } = render(<HeaderCell title="Foo" value="Bar" badge="30" isCurrent />);
    expect(container.querySelector(".header-cell")).toHaveClass("header-cell-current");
    expect(container.querySelector(".header-cell-bubble")).not.toBeNull();
    expect(getByText("30")).toBeInTheDocument();
  });

  it("renders without bubble when not isCurrent", () => {
    const { container } = render(<HeaderCell title="Foo" value="Bar" />);
    expect(container.querySelector(".header-cell-bubble")).toBeNull();
  });
});
