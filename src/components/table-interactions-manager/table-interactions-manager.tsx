import * as React from "react";

import { ITableHandle } from "../table/table";
import { OnHorizontallyScrollProps } from "../virtualizer";
import {
  TableInteractionsAction,
  updateHiddenColumns,
  updateRowHeight,
  updateCellWidth,
  updateColumnsCursor,
  updateFixedColumns,
  updateFixedRows,
  updateHiddenRows,
} from "./actions";
import TableInteractionsManagerReducer, {
  ITableInteractionManagerState,
  CellValue,
  initialState,
  CellDimension,
} from "./reducers";
import { ICellCoordinates, ICell } from "../table/cell";
import { Nullable } from "../typing";
import { ITrees } from "../table/elementary-table";
import useComponent, { ComponentRef } from "../../hooks/useComponent";
import { compareNumbers } from "../utils/table";

export interface OnScrollCallbackProps {
  /** Identifier of the column currently aligned with the scroll cursor */
  columnsCursorId: string | undefined;
}

interface Column {
  id: string;
  index: number;
}

export interface ITableInteractionsManagerProps extends ITableInteractionManagerState {
  tableRef: Nullable<(table: ITableHandle) => void>;
  table: Nullable<ComponentRef<ITableHandle>>;
  hiddenColumnsIndexes: number[];
  fixedColumnsIndexes: number[];
  fixedRowsIndexes: number[];
  updateHiddenIds: (hiddenIds: string[]) => void;
  updateHiddenRowIndexes: (rowIndexes: number[]) => void;
  updateFixedColumnsIds: (fixedIds: string[]) => void;
  updateFixedRowsIndexes: (fixedIndexes: number[]) => void;
  updateRowHeight: (value: CellDimension) => void;
  updateCellWidth: (value: CellDimension) => void;
  goToColumnId: (columnId: string) => void;
  goToColumnIndex: (columnIndex: number) => void;
  getCell: (cellCoordinates: ICellCoordinates) => Nullable<ICell>;
  openTrees: (trees: ITrees) => void;
  closeTrees: (trees: ITrees) => void;
  onHorizontallyScroll: (
    props: OnHorizontallyScrollProps,
    callback?: (onScrollCallbackProps: OnScrollCallbackProps) => void,
  ) => void;
  onTableUpdate: () => void;
}

interface IProps {
  children: React.ReactNode;
  toggleableColumns?: Column[];
  initialConfig?: Partial<ITableInteractionManagerState>;
  onStateUpdate?: (state: ITableInteractionManagerState) => void;
}

const noop: (...args: unknown[]) => never = () => null as never;

const initialContext: ITableInteractionsManagerProps = {
  ...initialState,
  tableRef: noop,
  table: null,
  hiddenColumnsIndexes: [],
  fixedColumnsIndexes: [],
  fixedRowsIndexes: [],
  updateHiddenIds: noop,
  updateHiddenRowIndexes: noop,
  updateFixedColumnsIds: noop,
  updateFixedRowsIndexes: noop,
  updateRowHeight: noop,
  updateCellWidth: noop,
  goToColumnId: noop,
  goToColumnIndex: noop,
  getCell: noop,
  openTrees: noop,
  closeTrees: noop,
  onHorizontallyScroll: noop,
  onTableUpdate: noop,
};

export const TableInteractionsContext: React.Context<ITableInteractionsManagerProps> =
  React.createContext<ITableInteractionsManagerProps>({ ...initialContext });

const mapDispatchToProps = (dispatch: React.Dispatch<TableInteractionsAction>) => ({
  updateHiddenIds: (hiddenIds: string[]) => dispatch(updateHiddenColumns(hiddenIds)),
  updateHiddenRowIndexes: (hiddenIndexes: number[]) => dispatch(updateHiddenRows(hiddenIndexes)),
  updateFixedColumnsIds: (fixedIds: string[]) => dispatch(updateFixedColumns(fixedIds)),
  updateFixedRowsIndexes: (fixedIndexes: number[]) => dispatch(updateFixedRows(fixedIndexes)),
  updateRowHeight: (value: CellDimension) => dispatch(updateRowHeight(value)),
  updateCellWidth: (value: CellDimension) => dispatch(updateCellWidth(value)),
  updateColumnsCursor: (columnsCursor: CellValue) => dispatch(updateColumnsCursor(columnsCursor)),
});

const TableInteractionsManager: React.FC<IProps> = ({ children, initialConfig, onStateUpdate, toggleableColumns = [] }) => {
  const initialHiddenColumnsIds = React.useMemo(() => toggleableColumns.map((column) => column.id), [toggleableColumns]);

  const [state, dispatch] = React.useReducer(TableInteractionsManagerReducer, {
    ...initialState,
    hiddenColumnsIds: initialHiddenColumnsIds,
    ...initialConfig,
  });

  const [tableRef, table, onTableUpdate] = useComponent<ITableHandle>();

  const { columnsCursor, hiddenColumnsIds, fixedColumnsIds, fixedRowsIndexes } = state;
  const { id: currentColumnsCursorId, index: currentColumnsCursorIndex } = columnsCursor || { id: null, index: null };

  const hiddenColumnsIdsMapping = React.useMemo(
    () =>
      toggleableColumns.reduce<Record<string, number>>((mapping, column) => {
        mapping[column.id] = column.index;
        return mapping;
      }, {}),
    [toggleableColumns],
  );

  const actions = React.useMemo(() => mapDispatchToProps(dispatch), [dispatch]);

  React.useEffect(() => {
    onStateUpdate?.(state);
  }, [state, onStateUpdate]);

  const goToColumnId = React.useCallback(
    (columnId: string) => {
      if (!table.current) return;
      const columnIndex = table.current.getColumnIndex(columnId);
      if (columnIndex === undefined) return;
      actions.updateColumnsCursor({ index: columnIndex, id: columnId });
      table.current.goToColumnId(columnId);
    },
    [actions, table],
  );

  const goToColumnIndex = React.useCallback(
    (columnIndex: number) => {
      if (!table.current) return;
      const columnId = table.current.getColumnId(columnIndex);
      actions.updateColumnsCursor({ index: columnIndex, id: columnId ?? "" });
      table.current.goToColumnIndex(columnIndex);
    },
    [actions, table],
  );

  const getCell = React.useCallback(
    (cellCoordinates: ICellCoordinates) => (table.current ? table.current.getCell(cellCoordinates) : null),
    [table],
  );

  const openTrees = React.useCallback((trees: ITrees) => table.current?.openTrees(trees), [table]);
  const closeTrees = React.useCallback((trees: ITrees) => table.current?.closeTrees(trees), [table]);

  const onHorizontallyScroll = React.useCallback(
    (onScrollProps: OnHorizontallyScrollProps, callback?: (props: OnScrollCallbackProps) => void) => {
      if (!table.current) return;
      const { columnsCursor: cursor } = onScrollProps;
      const columnId = table.current.getColumnId(cursor);
      if (!currentColumnsCursorIndex || currentColumnsCursorIndex !== cursor) {
        actions.updateColumnsCursor({ index: cursor, id: columnId ?? "" });
      }
      callback?.({ columnsCursorId: columnId });
    },
    [actions, table, currentColumnsCursorIndex],
  );

  const updateCellWidth = React.useCallback(
    (value: CellDimension) => {
      actions.updateCellWidth(value);
      // Async scroll: wait for the cell width to apply before re-aligning to the cursor.
      if (currentColumnsCursorId) {
        setTimeout(() => goToColumnId(currentColumnsCursorId), 0);
      }
    },
    [actions, currentColumnsCursorId, goToColumnId],
  );

  const hiddenColumnsIndexes = React.useMemo(
    () =>
      hiddenColumnsIds
        .reduce<number[]>((result, columnId) => {
          const columnIndex = hiddenColumnsIdsMapping[columnId];
          if (columnIndex >= 0) result.push(columnIndex);
          return result;
        }, [])
        .sort(compareNumbers),
    [hiddenColumnsIds, hiddenColumnsIdsMapping],
  );

  const fixedColumnsIndexes = React.useMemo(
    () =>
      fixedColumnsIds.reduce<number[]>((result, columnId) => {
        const columnIndex = table.current?.getColumnIndex(columnId);
        if (columnIndex !== undefined && columnIndex >= 0) result.push(columnIndex);
        return result;
      }, []),
    [fixedColumnsIds, table],
  );

  return (
    <TableInteractionsContext.Provider
      value={{
        ...actions,
        ...state,
        hiddenColumnsIndexes,
        fixedColumnsIndexes,
        fixedRowsIndexes,
        updateCellWidth,
        onHorizontallyScroll,
        goToColumnIndex,
        goToColumnId,
        getCell,
        openTrees,
        closeTrees,
        tableRef,
        onTableUpdate,
        table,
      }}
    >
      {children}
    </TableInteractionsContext.Provider>
  );
};

export const useTableInteractionsManager = (): ITableInteractionsManagerProps => React.useContext(TableInteractionsContext);

export default TableInteractionsManager;
