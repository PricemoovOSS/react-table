import * as React from "react";
import { render } from "@testing-library/react";

import Bubble, { BubbleType } from "../../../src/components/styled-table/bubble";

describe("Bubble", () => {
  it("renders the badge text when given", () => {
    const { container, getByText } = render(<Bubble badge="30" />);
    expect(getByText("30")).toBeInTheDocument();
    expect(container.querySelector(".bubble-circle")).toHaveClass(BubbleType.info);
  });

  it("does not render badge geometry when no badge", () => {
    const { container } = render(<Bubble />);
    expect(container.querySelector(".bubble-circle-content")).toBeNull();
  });

  it("applies the configured type class", () => {
    const { container } = render(<Bubble type={BubbleType.success} />);
    expect(container.querySelector(".bubble-circle")).toHaveClass(BubbleType.success);
  });

  it("renders children inside the bubble container", () => {
    const { getByText } = render(
      <Bubble>
        <div>Foo</div>
      </Bubble>,
    );
    expect(getByText("Foo")).toBeInTheDocument();
  });
});
