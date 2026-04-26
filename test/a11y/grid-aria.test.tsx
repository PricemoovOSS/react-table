import * as React from "react";
import { fireEvent } from "@testing-library/react";

import Table from "../../src/components/table/table";
import { generateTable } from "../../stories/utils/tables";
import { customRender } from "../tests-utils/react-testing-library-utils";

describe("Grid ARIA", () => {
  it("emits role='grid' with aria-rowcount / aria-colcount on the table root", () => {
    const props = generateTable(20, 5);
    customRender(<Table {...props} />);
    const grid = document.querySelector('[role="grid"]') as HTMLElement;
    expect(grid).not.toBeNull();
    expect(grid.tagName.toLowerCase()).toBe("table");
    // 20 rows × 5 cells defined.
    expect(grid.getAttribute("aria-rowcount")).toBe("20");
    expect(grid.getAttribute("aria-colcount")).toBe("5");
  });

  it("renders thead and tbody (implicit rowgroup role)", () => {
    const props = generateTable(5, 3);
    customRender(<Table {...props} />);
    // thead / tbody carry an implicit `rowgroup` role per HTML semantics — emitting it
    // explicitly is flagged by eslint-plugin-jsx-a11y (jsx-a11y/no-redundant-roles).
    expect(document.querySelector("thead")).not.toBeNull();
    expect(document.querySelector("tbody")).not.toBeNull();
  });

  it("emits role='row' + aria-rowindex (1-based) on every row", () => {
    const props = generateTable(5, 3);
    customRender(<Table {...props} />);
    const rows = Array.from(document.querySelectorAll('[role="row"]'));
    // 1 header + 4 body rows expected.
    expect(rows.length).toBe(5);
    expect(rows[0].getAttribute("aria-rowindex")).toBe("1");
    expect(rows[4].getAttribute("aria-rowindex")).toBe("5");
  });

  it("emits role='columnheader' on header cells and role='gridcell' on body cells", () => {
    const props = generateTable(3, 4);
    customRender(<Table {...props} />);
    expect(document.querySelectorAll('[role="columnheader"]').length).toBe(4);
    expect(document.querySelectorAll('[role="gridcell"]').length).toBe(4 * 2); // 2 body rows × 4 cells
  });

  it("emits aria-rowindex and aria-colindex (1-based) on each cell", () => {
    const props = generateTable(3, 4);
    customRender(<Table {...props} />);
    const cell = document.querySelector('[data-cell-row="2"][data-cell-col="3"]');
    expect(cell?.getAttribute("aria-rowindex")).toBe("3");
    expect(cell?.getAttribute("aria-colindex")).toBe("4");
  });

  it("renders cells with tabIndex=-1 (programmatically focusable, never in tab order)", () => {
    const props = generateTable(3, 3);
    customRender(<Table {...props} />);
    document.querySelectorAll('[role="gridcell"], [role="columnheader"]').forEach((el) => {
      expect(el.getAttribute("tabindex")).toBe("-1");
    });
  });

  it("emits aria-selected when a cell is selected", () => {
    const props = generateTable(3, 3);
    customRender(<Table {...props} />);
    const cell = document.querySelector('[data-cell-row="1"][data-cell-col="1"]') as HTMLElement;
    fireEvent.mouseDown(cell);
    expect(cell.getAttribute("aria-selected")).toBe("true");
  });
});
