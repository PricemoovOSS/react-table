import * as React from "react";

import Table, { ITableHandle } from "../../src/components/table/table";
import { ICell, IContentCellProps } from "../../src/components/table/cell";
import { IRow } from "../../src/components/table/row";
import { IColumns, ITrees } from "../../src/components/table/elementary-table";
import { Group } from "../../src/components/utils/group";
import { OnScrollProps } from "../../src/components/virtualizer";
import TableInteractionsManager, {
  useTableInteractionsManager,
} from "../../src/components/table-interactions-manager/table-interactions-manager";
import { renderStats } from "./heavy-cells";

/**
 * A table whose rows and columns change while it is displayed: rows and columns inserted,
 * removed and updated, the way an application does it from its own data.
 *
 * It is the page of the "Recipes/Live data" stories and of the tests that guard these changes:
 * no error, the scroll kept, and only what changed rendered.
 */
export const NAME_COLUMN = "name";
export const TOTAL_COLUMN = "total";
export const HEADER_ROW_INDEX = 0;

export type LiveGroup = "identity" | "metrics" | "totals";

export interface ILiveColumn {
  id: string;
  label: string;
  group: LiveGroup;
  /** Seed of the values of the column */
  sequence: number;
}

export interface ILiveRow {
  id: string;
  label: string;
  /** Seed of the values of the row */
  sequence: number;
  /** Value per column id; the name column shows the label */
  values: Record<string, number>;
  children?: ILiveRow[];
}

export interface ILiveData {
  columns: ILiveColumn[];
  rows: ILiveRow[];
  /** Sequences of the next row and of the next column: ids are never reused */
  nextRow: number;
  nextColumn: number;
}

export type LiveOperation =
  | { type: "insertRows"; index: number; count?: number }
  | { type: "removeRows"; index: number; count?: number }
  | { type: "insertColumns"; index: number; count?: number }
  | { type: "removeColumns"; index: number; count?: number }
  | { type: "updateRow"; index: number }
  | { type: "updateCell"; index: number; columnId: string }
  | { type: "updateColumn"; columnId: string }
  | { type: "renameColumn"; columnId: string };

const seedValue = (rowSequence: number, columnSequence: number) => ((rowSequence * 31 + columnSequence * 17) % 900) + 100;

const valuesOf = (rowSequence: number, columns: ILiveColumn[]) =>
  Object.fromEntries(
    columns.filter((column) => column.id !== NAME_COLUMN).map((column) => [column.id, seedValue(rowSequence, column.sequence)]),
  );

const createColumn = (sequence: number): ILiveColumn => ({
  id: `c${sequence}`,
  label: `Column ${sequence}`,
  group: "metrics",
  sequence,
});

function createRow(sequence: number, columns: ILiveColumn[], withSubRows: boolean): ILiveRow {
  const row: ILiveRow = { id: `r${sequence}`, label: `Row ${sequence}`, sequence, values: valuesOf(sequence, columns) };
  if (withSubRows) {
    row.children = [1, 2].map((child) => ({
      id: `r${sequence}.${child}`,
      label: `Row ${sequence}.${child}`,
      sequence: sequence * 10 + child,
      values: valuesOf(sequence * 10 + child, columns),
    }));
  }
  return row;
}

/** `columnsCount` counts the name column and the total column. */
export function createLiveData(rowsCount: number, columnsCount: number, subRowsEvery = 0): ILiveData {
  const metrics = Array.from({ length: Math.max(columnsCount - 2, 0) }, (_, index) => createColumn(index + 1));
  const columns: ILiveColumn[] = [
    { id: NAME_COLUMN, label: "Name", group: "identity", sequence: 0 },
    ...metrics,
    { id: TOTAL_COLUMN, label: "Total", group: "totals", sequence: 9999 },
  ];
  const rows = Array.from({ length: rowsCount }, (_, index) =>
    createRow(index + 1, columns, subRowsEvery > 0 && (index + 1) % subRowsEvery === 0),
  );
  return { columns, rows, nextRow: rowsCount + 1, nextColumn: metrics.length + 1 };
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));

/** Applies a change of values to a row and to its sub rows; a row left as is keeps its identity. */
function mapRow(row: ILiveRow, change: (values: ILiveRow["values"], row: ILiveRow) => ILiveRow["values"]): ILiveRow {
  const values = change(row.values, row);
  const children = row.children?.map((child) => mapRow(child, change));
  return { ...row, values, children };
}

function withoutKeys(values: ILiveRow["values"], keys: string[]): ILiveRow["values"] {
  const next = { ...values };
  keys.forEach((key) => delete next[key]);
  return next;
}

/** The data after the operation. Rows and columns that do not change keep their identity. */
export function applyLiveOperation(data: ILiveData, operation: LiveOperation): ILiveData {
  switch (operation.type) {
    case "insertRows": {
      const count = operation.count ?? 1;
      const index = clamp(operation.index, 0, data.rows.length);
      const added = Array.from({ length: count }, (_, offset) => createRow(data.nextRow + offset, data.columns, false));
      return {
        ...data,
        rows: [...data.rows.slice(0, index), ...added, ...data.rows.slice(index)],
        nextRow: data.nextRow + count,
      };
    }
    case "removeRows": {
      const index = clamp(operation.index, 0, data.rows.length);
      return { ...data, rows: [...data.rows.slice(0, index), ...data.rows.slice(index + (operation.count ?? 1))] };
    }
    case "insertColumns": {
      const count = operation.count ?? 1;
      const index = clamp(operation.index, 1, data.columns.length);
      const added = Array.from({ length: count }, (_, offset) => createColumn(data.nextColumn + offset));
      const columns = [...data.columns.slice(0, index), ...added, ...data.columns.slice(index)];
      const rows = data.rows.map((row) =>
        mapRow(row, (values, { sequence }) => ({
          ...values,
          ...Object.fromEntries(added.map((column) => [column.id, seedValue(sequence, column.sequence)])),
        })),
      );
      return { ...data, columns, rows, nextColumn: data.nextColumn + count };
    }
    case "removeColumns": {
      const index = clamp(operation.index, 1, data.columns.length);
      const removed = data.columns.slice(index, index + (operation.count ?? 1)).map((column) => column.id);
      if (removed.length === 0) return data;
      const columns = data.columns.filter((column) => !removed.includes(column.id));
      return { ...data, columns, rows: data.rows.map((row) => mapRow(row, (values) => withoutKeys(values, removed))) };
    }
    case "updateRow": {
      const target = data.rows[operation.index];
      if (!target) return data;
      const bump = (values: ILiveRow["values"]) =>
        Object.fromEntries(Object.entries(values).map(([id, value]) => [id, value + 1]));
      return { ...data, rows: data.rows.map((row) => (row === target ? { ...row, values: bump(row.values) } : row)) };
    }
    case "updateCell": {
      const target = data.rows[operation.index];
      if (!target || !(operation.columnId in target.values)) return data;
      const values = { ...target.values, [operation.columnId]: target.values[operation.columnId] + 1 };
      return { ...data, rows: data.rows.map((row) => (row === target ? { ...row, values } : row)) };
    }
    case "updateColumn": {
      const { columnId } = operation;
      if (!data.columns.some((column) => column.id === columnId) || columnId === NAME_COLUMN) return data;
      return {
        ...data,
        rows: data.rows.map((row) => mapRow(row, (values) => ({ ...values, [columnId]: values[columnId] + 1 }))),
      };
    }
    case "renameColumn":
      return {
        ...data,
        columns: data.columns.map((column) =>
          column.id === operation.columnId ? { ...column, label: `${column.label} *` } : column,
        ),
      };
    default:
      return data;
  }
}

export interface ILiveCoordinates {
  rowId: string;
  columnId: string;
}

/** Content of a value cell: counts its renders, and flashes when its value changes. */
export function LiveCell({ value, dataCoordinates }: IContentCellProps<ILiveCoordinates> & { value?: string }) {
  renderStats.renders += 1;
  React.useEffect(() => {
    renderStats.mounts += 1;
  }, []);
  const shown = React.useRef({ value, changes: 0 });
  if (shown.current.value !== value) shown.current = { value, changes: shown.current.changes + 1 };
  const { changes } = shown.current;
  return (
    <span
      data-testid="live-cell"
      data-row-id={dataCoordinates?.rowId}
      data-column-id={dataCoordinates?.columnId}
      // two names for the same animation: it restarts at every change
      style={changes > 0 ? { animation: `live-flash-${changes % 2} 0.8s ease-out` } : undefined}
    >
      {value}
    </span>
  );
}

/** Content of the name cell: a box whose state is local, to see that it follows its row. */
export function LiveNameCell({ value, dataCoordinates }: IContentCellProps<ILiveCoordinates> & { value?: string }) {
  renderStats.renders += 1;
  React.useEffect(() => {
    renderStats.mounts += 1;
  }, []);
  const [isWatched, setIsWatched] = React.useState(false);
  return (
    <label data-testid="live-name" data-row-id={dataCoordinates?.rowId} style={{ display: "flex", gap: 6, width: "100%" }}>
      <input
        type="checkbox"
        aria-label={`Watch ${value}`}
        checked={isWatched}
        onChange={(event) => setIsWatched(event.target.checked)}
      />
      {value}
    </label>
  );
}

interface ICachedCell {
  value: string;
  cell: ICell<ILiveCoordinates>;
  /** For a name cell with sub rows: what the sub rows were built from */
  children?: ILiveRow[];
  columns?: ILiveColumn[];
}

/** What was built for the previous data: an application keeps it to hand the same objects back. */
export interface ILiveTableCache {
  headerCells: WeakMap<ILiveColumn, ICell>;
  header: { columns: ILiveColumn[]; row: IRow } | null;
  rows: WeakMap<ILiveRow, { columns: ILiveColumn[]; row: IRow<ILiveCoordinates> }>;
  cells: Map<string, Map<string, ICachedCell>>;
}

export const createLiveTableCache = (): ILiveTableCache => ({
  headerCells: new WeakMap(),
  header: null,
  rows: new WeakMap(),
  cells: new Map(),
});

function toHeaderRow(columns: ILiveColumn[], cache: ILiveTableCache): IRow {
  if (cache.header?.columns === columns) return cache.header.row;
  const cells = columns.map((column) => {
    let cell = cache.headerCells.get(column);
    if (!cell) {
      // the id of a header cell is the id of its column: the interactions manager resolves columns with it
      cell = { id: column.id, value: column.label };
      cache.headerCells.set(column, cell);
    }
    return cell;
  });
  const row: IRow = { id: "header", isHeader: true, cells };
  cache.header = { columns, row };
  return row;
}

function toCell(row: ILiveRow, column: ILiveColumn, columns: ILiveColumn[], cache: ILiveTableCache): ICell<ILiveCoordinates> {
  const isName = column.id === NAME_COLUMN;
  const value = isName ? row.label : String(row.values[column.id]);
  let cellsOfRow = cache.cells.get(row.id);
  if (!cellsOfRow) {
    cellsOfRow = new Map();
    cache.cells.set(row.id, cellsOfRow);
  }
  const known = cellsOfRow.get(column.id);
  const hasSameSubRows = !isName || !row.children || (known?.children === row.children && known?.columns === columns);
  if (known && known.value === value && hasSameSubRows) return known.cell;

  const cell: ICell<ILiveCoordinates> = {
    id: `${row.id}-${column.id}`,
    value,
    cellContent: isName ? LiveNameCell : LiveCell,
    dataCoordinates: { rowId: row.id, columnId: column.id },
    subItems: isName && row.children ? row.children.map((child) => toRow(child, columns, cache)) : undefined,
  };
  cellsOfRow.set(column.id, { value, cell, children: row.children, columns });
  return cell;
}

function toRow(row: ILiveRow, columns: ILiveColumn[], cache: ILiveTableCache): IRow<ILiveCoordinates> {
  const known = cache.rows.get(row);
  if (known?.columns === columns) return known.row;
  const tableRow: IRow<ILiveCoordinates> = { id: row.id, cells: columns.map((column) => toCell(row, column, columns, cache)) };
  cache.rows.set(row, { columns, row: tableRow });
  return tableRow;
}

/**
 * Rows of the table for the data. A row, a cell whose data did not change is the same
 * object as before: the table then has nothing to render for it.
 */
export function toTableRows(data: ILiveData, cache: ILiveTableCache): IRow[] {
  return [toHeaderRow(data.columns, cache), ...data.rows.map((row) => toRow(row, data.columns, cache))];
}

export const GROUPS: Group[] = [
  { id: "identity", label: "Identity" },
  { id: "metrics", label: "Metrics" },
  { id: "totals", label: "Totals" },
];

/** Options of the columns: they are given by index, so they are rebuilt when the columns change. */
export function toColumnsOptions(columns: ILiveColumn[], withGroups: boolean): IColumns {
  return Object.fromEntries(
    columns.map((column, index) => [
      index,
      {
        ...(column.id === NAME_COLUMN ? { size: 190 } : null),
        ...(withGroups ? { groupId: column.group } : null),
      },
    ]),
  );
}

/**
 * Opened trees are addressed by row index. When rows are inserted or removed above an opened
 * row, the application moves its tree: the table cannot know the row went elsewhere.
 */
export function shiftTrees(trees: ITrees, fromRowIndex: number, delta: number): ITrees {
  return Object.values(trees).reduce<ITrees>((next, tree) => {
    const isRemoved = delta < 0 && tree.rowIndex >= fromRowIndex && tree.rowIndex < fromRowIndex - delta;
    if (isRemoved) return next;
    const rowIndex = tree.rowIndex >= fromRowIndex ? tree.rowIndex + delta : tree.rowIndex;
    next[rowIndex] = { ...tree, rowIndex };
    return next;
  }, {});
}

export interface ILiveWindow {
  /** First scrolling row and column of the window, as indexes of the table */
  row: number;
  column: number;
}

export interface ILiveDataApi {
  apply: (...operations: LiveOperation[]) => void;
  getData: () => ILiveData;
  getWindow: () => ILiveWindow;
  getHandle: () => ITableHandle | null;
}

export interface ILiveDataProps {
  rows?: number;
  columns?: number;
  /** One row out of N has sub rows; 0 for none */
  subRowsEvery?: number;
  withGroups?: boolean;
  /** Explicit size: the table is sized by its container when omitted */
  width?: number;
  height?: number;
  /** Updates values on a timer, like a feed of prices */
  stream?: boolean;
  /** Receives the actions and the current data: the tests drive the page with it */
  onReady?: (api: ILiveDataApi) => void;
  /** Rendered inside the interactions manager, next to the table */
  children?: React.ReactNode;
}

interface ILiveTableProps {
  data: ILiveData;
  tableRows: IRow[];
  withGroups: boolean;
  width?: number;
  height?: number;
  onWindow: (props: OnScrollProps) => void;
  onHandle: (handle: ITableHandle | null) => void;
}

const GROUPS_PROPS = { rowsOptions: { size: 30 } };

function LiveTable({ data, tableRows, withGroups, width, height, onWindow, onHandle }: ILiveTableProps) {
  const { tableRef, fixedColumnsIndexes, hiddenColumnsIndexes } = useTableInteractionsManager();
  const setHandle = React.useCallback(
    (handle: ITableHandle | null) => {
      tableRef(handle);
      onHandle(handle);
    },
    [tableRef, onHandle],
  );
  const columns = React.useMemo(() => toColumnsOptions(data.columns, withGroups), [data.columns, withGroups]);

  return (
    <Table
      id="live"
      ref={setHandle}
      isVirtualized
      isSelectable={false}
      rows={tableRows}
      columns={columns}
      groups={withGroups ? GROUPS : undefined}
      groupsProps={GROUPS_PROPS}
      // Inline object and arrays on purpose: applications write it this way
      virtualizerProps={{
        fixedRows: [HEADER_ROW_INDEX],
        fixedColumns: [0, ...fixedColumnsIndexes],
        hiddenColumns: hiddenColumnsIndexes,
        minRowHeight: 40,
        minColumnWidth: 110,
        width,
        height,
        onScroll: onWindow,
      }}
    />
  );
}

type Place = "start" | "window" | "end";

const PLACES: { place: Place; label: string }[] = [
  { place: "start", label: "at the start" },
  { place: "window", label: "in the window" },
  { place: "end", label: "at the end" },
];

/** Deterministic picks for the stream: the same run shows the same updates. */
function createRandom(seed: number) {
  let state = seed;
  return (max: number) => {
    state = (state * 1664525 + 1013904223) | 0;
    return (state >>> 8) % Math.max(max, 1);
  };
}

const STREAM_INTERVAL = 250;
const STREAM_UPDATES = 12;

/** The page: the data, the manager around the table, and the actions that change the data. */
export function LiveDataPage({
  rows = 200,
  columns = 30,
  subRowsEvery = 0,
  withGroups = true,
  width,
  height,
  stream = false,
  onReady,
  children,
}: ILiveDataProps) {
  const [data, setData] = React.useState(() => createLiveData(rows, columns, subRowsEvery));
  const cache = React.useRef<ILiveTableCache | null>(null);
  if (!cache.current) cache.current = createLiveTableCache();
  const tableRows = React.useMemo(() => toTableRows(data, cache.current as ILiveTableCache), [data]);

  const latest = React.useRef(data);
  latest.current = data;
  const handleRef = React.useRef<ITableHandle | null>(null);
  const windowRef = React.useRef<ILiveWindow>({ row: 1, column: 1 });
  const pendingTrees = React.useRef<{ close: ITrees; open: ITrees } | null>(null);
  const [place, setPlace] = React.useState<Place>("window");

  const onWindow = React.useCallback(({ rowsCursor, columnsCursor }: OnScrollProps) => {
    windowRef.current = { row: rowsCursor, column: columnsCursor };
  }, []);
  const onHandle = React.useCallback((handle: ITableHandle | null) => {
    handleRef.current = handle;
  }, []);

  const apply = React.useCallback((...operations: LiveOperation[]) => {
    // opened rows below an inserted or removed row move with it
    const trees = handleRef.current?.getOpenedTrees() ?? {};
    const moved = operations.reduce<ITrees>((current, operation) => {
      if (operation.type === "insertRows") return shiftTrees(current, operation.index + 1, operation.count ?? 1);
      if (operation.type === "removeRows") return shiftTrees(current, operation.index + 1, -(operation.count ?? 1));
      return current;
    }, trees);
    const hasMoved = Object.keys(trees).join() !== Object.keys(moved).join();
    if (hasMoved) pendingTrees.current = { close: trees, open: moved };
    setData((current) => operations.reduce(applyLiveOperation, current));
  }, []);

  // once the new rows are in the table: the trees can be opened at their new indexes
  React.useLayoutEffect(() => {
    const pending = pendingTrees.current;
    if (!pending) return;
    pendingTrees.current = null;
    handleRef.current?.closeTrees(pending.close);
    handleRef.current?.openTrees(pending.open);
  }, [data]);

  const api = React.useMemo<ILiveDataApi>(
    () => ({
      apply,
      getData: () => latest.current,
      getWindow: () => windowRef.current,
      getHandle: () => handleRef.current,
    }),
    [apply],
  );
  React.useEffect(() => {
    (window as unknown as { liveData?: ILiveDataApi }).liveData = api;
    onReady?.(api);
  }, [api, onReady]);

  React.useEffect(() => {
    if (!stream) return undefined;
    const pick = createRandom(42);
    const timer = setInterval(() => {
      const current = latest.current;
      const metrics = current.columns.filter((column) => column.id !== NAME_COLUMN);
      if (current.rows.length === 0 || metrics.length === 0) return;
      const window = windowRef.current;
      // most updates land around the window: that is where they cost a render
      const operations = Array.from({ length: STREAM_UPDATES }, (): LiveOperation => {
        const index = clamp(window.row - 1 + pick(14), 0, current.rows.length - 1);
        return { type: "updateCell", index, columnId: metrics[clamp(window.column - 1 + pick(10), 0, metrics.length - 1)].id };
      });
      apply(...operations);
    }, STREAM_INTERVAL);
    return () => clearInterval(timer);
  }, [stream, apply]);

  /** Index, among the data rows or the columns, the chosen place stands for. */
  const rowIndexAt = (chosen: Place) =>
    chosen === "start" ? 0 : chosen === "end" ? data.rows.length : clamp(windowRef.current.row + 1, 0, data.rows.length);
  const columnIndexAt = (chosen: Place) =>
    chosen === "start"
      ? 1
      : chosen === "end"
        ? data.columns.length - 1
        : clamp(windowRef.current.column + 1, 1, data.columns.length - 1);
  const lastIndex = (index: number, length: number) => clamp(place === "end" ? index - 1 : index, 0, Math.max(length - 1, 0));
  const columnIdAt = (chosen: Place) => data.columns[lastIndex(columnIndexAt(chosen), data.columns.length)]?.id ?? NAME_COLUMN;

  const toggleableColumns = React.useMemo(
    () => data.columns.slice(1).map((column, index) => ({ id: column.id, index: index + 1 })),
    [data.columns],
  );
  const initialConfig = React.useMemo(() => ({ columnsCursor: null, hiddenColumnsIds: [], fixedColumnsIds: [TOTAL_COLUMN] }), []);

  const button = (testId: string, label: string, operation: () => LiveOperation) => (
    <button type="button" data-testid={testId} onClick={() => apply(operation())}>
      {label}
    </button>
  );

  return (
    <TableInteractionsManager initialConfig={initialConfig} toggleableColumns={toggleableColumns}>
      {children}
      <style>{`@keyframes live-flash-0 { from { background: #ffe28a; } to { background: transparent; } }
@keyframes live-flash-1 { from { background: #ffe28a; } to { background: transparent; } }`}</style>
      <div
        style={{ display: "flex", flexDirection: "column", height: height ? undefined : "calc(100vh - 60px)", minHeight: 360 }}
      >
        <div
          style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", font: "13px sans-serif", padding: "0 0 8px" }}
        >
          <label>
            Where{" "}
            <select data-testid="place" value={place} onChange={(event) => setPlace(event.target.value as Place)}>
              {PLACES.map((option) => (
                <option key={option.place} value={option.place}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          {button("insert-row", "Insert a row", () => ({ type: "insertRows", index: rowIndexAt(place) }))}
          {button("insert-rows", "Insert 100 rows", () => ({ type: "insertRows", index: rowIndexAt(place), count: 100 }))}
          {button("remove-row", "Remove a row", () => ({
            type: "removeRows",
            index: lastIndex(rowIndexAt(place), data.rows.length),
          }))}
          {button("update-row", "Update a row", () => ({
            type: "updateRow",
            index: lastIndex(rowIndexAt(place), data.rows.length),
          }))}
          {button("insert-column", "Insert a column", () => ({ type: "insertColumns", index: columnIndexAt(place) }))}
          {button("remove-column", "Remove a column", () => ({
            type: "removeColumns",
            index: lastIndex(columnIndexAt(place), data.columns.length),
          }))}
          {button("update-column", "Update a column", () => ({ type: "updateColumn", columnId: columnIdAt(place) }))}
          {button("rename-column", "Rename a column", () => ({ type: "renameColumn", columnId: columnIdAt(place) }))}
          <span data-testid="live-size">
            {data.rows.length} rows × {data.columns.length} columns
          </span>
        </div>
        <div id="table-container" style={{ flex: 1, minHeight: 0 }}>
          <LiveTable
            data={data}
            tableRows={tableRows}
            withGroups={withGroups}
            width={width}
            height={height}
            onWindow={onWindow}
            onHandle={onHandle}
          />
        </div>
      </div>
    </TableInteractionsManager>
  );
}
