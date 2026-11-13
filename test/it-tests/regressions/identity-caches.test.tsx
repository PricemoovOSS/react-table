/**
 * ATTACKED AND HELD — the module-level caches (column layouts, cell styles) do not give a value
 * computed for other inputs: one option object shared by 20 columns fixed at the end (20 end
 * positions, more than the 16 kept) on 40 rows of 40 different heights (more than the 16 kept),
 * and three tables with different options rendered and updated in turn on the same page.
 * These tests PASS.
 */
import { act, fireEvent, render } from "@testing-library/react";

import Table, { ITableProps } from "../../../src/components/table/table";
import { generateTable } from "../../../stories/utils/tables";

const normalise = (html: string) => {
  const host = document.createElement("div");
  host.innerHTML = html;
  host.querySelectorAll("*").forEach((element) => {
    // the order of the attributes and of the style properties depends on when React set them
    const attributes = Array.from(element.attributes)
      .map(
        (a) =>
          [
            a.name,
            a.name === "style"
              ? a.value
                  .split(";")
                  .map((v) => v.trim())
                  .filter(Boolean)
                  .sort()
                  .join("; ")
              : a.value,
          ] as const,
      )
      .sort(([a], [b]) => a.localeCompare(b));
    Array.from(element.attributes).forEach((a) => element.removeAttribute(a.name));
    attributes.forEach(([name, value]) => element.setAttribute(name, value));
  });
  return host.innerHTML;
};

const standalone = (props: ITableProps) => {
  const view = render(<Table {...props} />);
  const html = normalise(view.container.innerHTML);
  view.unmount();
  return html;
};

describe("held — caches keyed by identity, shared by the module", () => {
  it("more than 16 row heights and 16 end positions with shared option objects", () => {
    const table = generateTable(40, 40, {}, false);
    const shared = { className: "shared", size: 110 };
    const columns: ITableProps["columns"] = {};
    const fixedColumns: number[] = [];
    for (let index = 20; index < 40; index++) {
      columns[index] = shared;
      fixedColumns.push(index);
    }
    const rowsProps: ITableProps["rowsProps"] = {};
    for (let index = 0; index < 40; index++) rowsProps[index] = { size: 30 + index };
    const view = render(
      <Table
        {...table}
        isSelectable={false}
        isVirtualized
        columns={columns}
        rowsProps={rowsProps}
        virtualizerProps={{ height: 2000, width: 3000, minRowHeight: 30, fixedColumns, fixedRows: [0] }}
      />,
    );
    const rows = Array.from(view.container.querySelectorAll("tr"));
    const problems: string[] = [];
    rows.forEach((row) => {
      const rowIndex = Number(row.getAttribute("aria-rowindex")) - 1;
      const rights = new Set<string>();
      Array.from(row.querySelectorAll<HTMLElement>("td,th")).forEach((cell) => {
        if (cell.style.height !== `${30 + rowIndex}px`)
          problems.push(`row ${rowIndex} cell ${cell.textContent} height ${cell.style.height}`);
        if (cell.className.includes("elevated-absolute")) {
          if (rights.has(cell.style.right)) problems.push(`row ${rowIndex} duplicate right ${cell.style.right}`);
          rights.add(cell.style.right);
          if (cell.style.width !== "110px") problems.push(`row ${rowIndex} fixed cell width ${cell.style.width}`);
        }
      });
    });
    expect(rows).toHaveLength(40);
    expect(problems).toEqual([]);
  });

  it("two tables with different options rendered together, interleaved updates", () => {
    const tableA = generateTable(30, 12, {}, true);
    const tableB = generateTable(20, 6, {}, false);
    const propsA = (tick: number): ITableProps => ({
      ...tableA,
      id: "a",
      isSelectable: false,
      isVirtualized: true,
      globalColumnProps: tick % 2 ? { className: "a-odd" } : undefined,
      columns: { 2: { size: 150 + tick, className: "wide" } },
      virtualizerProps: { height: 300, width: 5000, minRowHeight: 30 + tick, fixedColumns: [0, 11] },
    });
    const propsB = (tick: number): ITableProps => ({
      ...tableB,
      id: "b",
      isSelectable: false,
      isVirtualized: true,
      rowsProps: { 3: { size: 60 + tick } },
      virtualizerProps: { height: 500, width: 4000, minRowHeight: 50, fixedColumns: [5] },
    });
    const propsC = (tick: number): ITableProps => ({
      ...tableB,
      id: "c",
      isSelectable: false,
      globalRowProps: { size: 44 + tick },
    });
    const ui = (tick: number) => (
      <div>
        <div data-testid="a">
          <Table {...propsA(tick)} />
        </div>
        <div data-testid="b">
          <Table {...propsB(tick)} />
        </div>
        <div data-testid="c">
          <Table {...propsC(tick)} />
        </div>
      </div>
    );
    const view = render(ui(0));
    for (let tick = 1; tick <= 3; tick++) {
      view.rerender(ui(tick));
      act(() => {
        fireEvent.scroll(view.getByTestId("a").querySelector("[data-testid='scroller-container']") as HTMLElement, {
          target: { scrollTop: 60 * tick },
        });
        fireEvent.scroll(view.getByTestId("b").querySelector("[data-testid='scroller-container']") as HTMLElement, {
          target: { scrollTop: 0 },
        });
      });
      act(() => {
        fireEvent.scroll(view.getByTestId("a").querySelector("[data-testid='scroller-container']") as HTMLElement, {
          target: { scrollTop: 0 },
        });
      });
      expect(normalise(view.getByTestId("a").innerHTML)).toBe(standalone(propsA(tick)));
      expect(normalise(view.getByTestId("b").innerHTML)).toBe(standalone(propsB(tick)));
      expect(normalise(view.getByTestId("c").innerHTML)).toBe(standalone(propsC(tick)));
    }
  });
});
