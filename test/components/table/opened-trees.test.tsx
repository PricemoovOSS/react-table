import * as React from "react";
import { act, fireEvent, render } from "@testing-library/react";

import Table, { ITableHandle } from "../../../src/components/table/table";
import TableInteractionsManager, {
  useTableInteractionsManager,
} from "../../../src/components/table-interactions-manager/table-interactions-manager";
import { ITrees } from "../../../src/components/table/elementary-table";
import { generateTable } from "../../../stories/utils/tables";

const tableWithTwoOpenableRows = () => {
  const table = generateTable(10, 5, {}, true);
  table.rows[3].cells[0].subItems = table.rows[2].cells[0].subItems;
  return table;
};

describe("opened trees", () => {
  it("notifies after the render is committed, once per change, without React warning", () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const calls: string[] = [];
    let renderingParent = false;
    const table = tableWithTwoOpenableRows();
    const tableRef = React.createRef<ITableHandle>();

    const Parent = () => {
      const [count, setCount] = React.useState(0);
      renderingParent = true;
      React.useLayoutEffect(() => {
        renderingParent = false;
      });
      return (
        <div data-count={count}>
          <Table
            {...table}
            ref={tableRef}
            isSelectable={false}
            onOpenedTreesUpdate={(trees: ITrees) => {
              calls.push(`${Object.keys(trees).join("+")}${renderingParent ? " (during render)" : ""}`);
              setCount((value) => value + 1);
            }}
          />
        </div>
      );
    };

    render(
      <React.StrictMode>
        <Parent />
      </React.StrictMode>,
    );
    act(() => {
      tableRef.current?.openTrees({ 2: { rowIndex: 2, columnIndex: 0 } });
      tableRef.current?.openTrees({ 3: { rowIndex: 3, columnIndex: 0 } });
    });

    expect(calls).toEqual(["2", "2+3"]);
    expect(consoleError).not.toHaveBeenCalled();
    expect(Object.keys(tableRef.current?.getOpenedTrees() ?? {})).toEqual(["2", "3"]);
    consoleError.mockRestore();
  });

  it("does not notify when a tree is dropped because its row lost its sub rows", () => {
    const onOpenedTreesUpdate = jest.fn();
    const table = tableWithTwoOpenableRows();
    const tableRef = React.createRef<ITableHandle>();
    const { rerender } = render(
      <Table
        {...table}
        ref={tableRef}
        isSelectable={false}
        initialOpenedTrees={{ 2: { rowIndex: 2, columnIndex: 0 } }}
        onOpenedTreesUpdate={onOpenedTreesUpdate}
      />,
    );
    expect(Object.keys(tableRef.current?.getOpenedTrees() ?? {})).toEqual(["2"]);

    rerender(
      <Table
        {...generateTable(10, 5, {}, false)}
        ref={tableRef}
        isSelectable={false}
        onOpenedTreesUpdate={onOpenedTreesUpdate}
      />,
    );
    expect(tableRef.current?.getOpenedTrees()).toEqual({});
    expect(onOpenedTreesUpdate).not.toHaveBeenCalled();
  });

  it("ignores a tree opened on a row without sub rows", () => {
    const tableRef = React.createRef<ITableHandle>();
    render(<Table {...generateTable(10, 5, {}, true)} ref={tableRef} isSelectable={false} />);
    act(() => {
      tableRef.current?.openTrees({ 4: { rowIndex: 4, columnIndex: 0 } });
    });
    expect(tableRef.current?.getOpenedTrees()).toEqual({});
  });
});

describe("table handle", () => {
  it("keeps the same handle and does not re-render the interactions consumers when the table changes", () => {
    let consumerRenders = 0;
    let refCalls = 0;
    const handles = new Set<unknown>();
    let setRows: (rows: ReturnType<typeof generateTable>["rows"]) => void = () => undefined;
    const initial = generateTable(20, 5, {}, true);

    const Consumer = () => {
      const { tableRef, table } = useTableInteractionsManager();
      consumerRenders += 1;
      if (table?.current) handles.add(table.current);
      const [rows, updateRows] = React.useState(initial.rows);
      setRows = updateRows;
      const ref = React.useCallback(
        (instance: ITableHandle | null) => {
          refCalls += 1;
          if (instance) tableRef?.(instance);
        },
        [tableRef],
      );
      return <Table id="table" rows={rows} ref={ref} isSelectable={false} />;
    };

    const { getAllByTestId } = render(
      <TableInteractionsManager>
        <Consumer />
      </TableInteractionsManager>,
    );
    expect(refCalls).toBe(1);

    consumerRenders = 0;
    act(() => {
      fireEvent.click(getAllByTestId("table-cell-sub-item-toggle")[0]);
    });
    expect({ refCalls, consumerRenders }).toEqual({ refCalls: 1, consumerRenders: 0 });

    act(() => {
      setRows(generateTable(20, 5, {}, true).rows);
    });
    // one render: the consumer owns the rows state
    expect({ refCalls, consumerRenders }).toEqual({ refCalls: 1, consumerRenders: 1 });
    expect(handles.size).toBe(1);
  });
});
