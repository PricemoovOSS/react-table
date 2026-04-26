import * as React from "react";
import classnames from "classnames";

import Row, { IRow, IRowOptions } from "./row";
import { IIndexesMap, filterRowsByIndexes, getRowTreeLength, filterIndexes, IElevateds } from "../utils/table";
import { ISelection } from "../table-selection/selection-handler";
import { Nullable } from "../typing";

export enum Type {
  error = "error",
  success = "success",
  warning = "warning",
  info = "info",
}

export interface ITree {
  rowIndex: number;
  columnIndex: number;
  subTrees?: ITrees;
}

export interface ITrees {
  [rowIndex: number]: ITree;
}

export interface IColumnOptions {
  className?: string;
  size?: number;
  type?: Type;
  style?: React.CSSProperties;
}

export interface IColumn extends IColumnOptions {
  isSelectable?: boolean;
  disableLevelPadding?: boolean;
  loading?: boolean;
}

export interface IColumns {
  [index: number]: IColumn;
}

export interface IElementaryTable<IDataCoordinates = any> {
  id: string;
  rows: IRow<IDataCoordinates>[];
  visibleColumnIndexes?: number[];
  visibleRowIndexes?: number[];
  elevatedColumnIndexes?: IElevateds;
  elevatedRowIndexes?: IElevateds;
  columns?: IColumns;
  /** Per-row options keyed by absolute index */
  rowsProps?: Record<number, IRowOptions>;
  /** Defaults shared by every row */
  globalRowProps?: IRowOptions;
  /** Defaults shared by every column */
  globalColumnProps?: IColumnOptions;
  /** When true, renders a span column at the start of rows that opens the first openable child */
  isSpan?: boolean;
}

export interface IElementaryTableProps<IDataCoordinates = any> extends IElementaryTable<IDataCoordinates>, ISelection {
  fixedRowsIndexes?: number[];
  indexesMapping: IIndexesMap;
  openedTrees: ITrees;
  onRowOpen?: (openedTree: ITree) => void;
  onRowClose?: (closedTree: ITree) => void;
  /** Total number of rows in the full grid (used for `aria-rowcount` under virtualization) */
  totalRowCount?: number;
  /** Total number of columns in the full grid (used for `aria-colcount`) */
  totalColumnCount?: number;
  /** When true, the grid declares `aria-multiselectable="true"` (rectangular cell selection) */
  multiSelectable?: boolean;
}

const EMPTY_ELEVATED: IElevateds = { elevations: {}, absoluteEndPositions: {} };
const EMPTY_TREES: ITrees = {};
const EMPTY_ROWS_PROPS: Record<number, IRowOptions> = {};

function ElementaryTable<IDataCoordinates = any>({
  id,
  isSpan,
  rows,
  columns,
  rowsProps = EMPTY_ROWS_PROPS,
  globalRowProps,
  globalColumnProps = {},
  visibleColumnIndexes,
  visibleRowIndexes,
  fixedRowsIndexes,
  indexesMapping,
  openedTrees = EMPTY_TREES,
  elevatedColumnIndexes = EMPTY_ELEVATED,
  elevatedRowIndexes = EMPTY_ELEVATED,
  selectedCells = {},
  onRowOpen,
  onRowClose,
  onCellMouseDown,
  onCellMouseUp,
  onCellMouseEnter,
  onCellContextMenu,
  totalRowCount,
  totalColumnCount,
  multiSelectable,
}: IElementaryTableProps<IDataCoordinates>): JSX.Element {
  // Stable callbacks: we capture `visibleRowIndexes` and `indexesMapping` via refs so the
  // returned function identity never changes. This is critical for `<Row>` memoization —
  // otherwise every vertical scroll invalidates these props on every row, including fixed
  // ones whose content didn't change.
  const visibleRowIndexesRef = React.useRef(visibleRowIndexes);
  visibleRowIndexesRef.current = visibleRowIndexes;
  const indexesMappingRef = React.useRef(indexesMapping);
  indexesMappingRef.current = indexesMapping;

  const getRowTreeLengthForIndex = React.useCallback(
    (absoluteIndex: number): number =>
      getRowTreeLength(absoluteIndex, visibleRowIndexesRef.current || [], indexesMappingRef.current.absolute),
    [],
  );

  const getVisibleRows = React.useCallback(
    (subRows: IRow[], absoluteIndex: Nullable<number>, fixedRowsAbsoluteIndexes: number[] = []): [number[] | null, IRow[]] =>
      filterRowsByIndexes(
        subRows,
        visibleRowIndexesRef.current || null,
        indexesMappingRef.current.absolute,
        absoluteIndex,
        fixedRowsAbsoluteIndexes,
      ),
    [],
  );

  // Cache `style` objects by `absolutePosition` value so two consecutive renders with the
  // same elevation position reuse the same `{ bottom: N }` reference. Without this, the
  // memo on `<Row>` breaks for elevated-end rows (typically the bottom-fixed ones).
  const rowStyleCacheRef = React.useRef<Map<number, React.CSSProperties>>(new Map());

  // `getVisibleRows` is intentionally stable (reads via refs) so we don't put it in deps;
  // we explicitly track the inputs that should trigger a recompute.
  const [relativeIndexes, rowsToRender] = React.useMemo(
    () => getVisibleRows(rows, null, fixedRowsIndexes),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, fixedRowsIndexes, visibleRowIndexes, indexesMapping],
  );

  const { header, body } = React.useMemo(() => {
    const result = { header: [] as JSX.Element[], body: [] as JSX.Element[] };

    rowsToRender.forEach((row, index) => {
      if (!row) return;
      const rowIndex = relativeIndexes ? relativeIndexes[index] : index;
      const rowProps = rowsProps[rowIndex];
      const relativeMapping = indexesMapping.relative[rowIndex];
      if (!relativeMapping) return;
      const { subItems, index: rowAbsoluteIndex } = relativeMapping;
      const isVisible = !visibleRowIndexes || visibleRowIndexes.includes(rowAbsoluteIndex);
      const rowOpenedTree = openedTrees[rowIndex];
      const elevation = elevatedRowIndexes.elevations[rowAbsoluteIndex];

      let rowSelectedCells = subItems || selectedCells[rowAbsoluteIndex] ? selectedCells : undefined;
      if (rowSelectedCells) {
        const nextRowMap = indexesMapping.relative[rowIndex + 1];
        const nextRowAbsoluteIndex = nextRowMap?.index;
        rowSelectedCells = nextRowAbsoluteIndex
          ? filterIndexes(rowSelectedCells, rowAbsoluteIndex, nextRowAbsoluteIndex)
          : rowSelectedCells;
      }

      const absolutePosition = elevatedRowIndexes.absoluteEndPositions[rowAbsoluteIndex];
      let rowStyle: React.CSSProperties | undefined;
      if (absolutePosition != null) {
        const cached = rowStyleCacheRef.current.get(absolutePosition);
        if (cached) {
          rowStyle = cached;
        } else {
          rowStyle = { bottom: absolutePosition };
          rowStyleCacheRef.current.set(absolutePosition, rowStyle);
        }
      }

      const renderedRow = (
        <Row
          key={`row-${id}-${row.id}`}
          {...globalRowProps}
          {...row}
          {...rowProps}
          className={classnames(row.className, { [`elevated-${elevation}`]: !!elevation })}
          style={rowStyle}
          absoluteIndex={rowAbsoluteIndex}
          index={rowIndex}
          level={0}
          isVisible={isVisible}
          isSpan={isSpan}
          columns={columns}
          elevatedColumnIndexes={elevatedColumnIndexes}
          elevatedRowIndexes={elevatedRowIndexes}
          globalColumnProps={globalColumnProps}
          visibleColumnIndexes={visibleColumnIndexes}
          visibleRowIndexes={visibleRowIndexes}
          openedTree={rowOpenedTree}
          relativeSubIndexesMapping={subItems ?? {}}
          onOpen={onRowOpen}
          onClose={onRowClose}
          onCellMouseDown={onCellMouseDown}
          onCellMouseEnter={onCellMouseEnter}
          onCellMouseUp={onCellMouseUp}
          onCellContextMenu={onCellContextMenu}
          selectedCells={rowSelectedCells ?? {}}
          getVisibleRows={getVisibleRows}
          getRowTreeLength={getRowTreeLengthForIndex}
        />
      );

      if (row.isHeader) result.header.push(renderedRow);
      else result.body.push(renderedRow);
    });

    return result;
  }, [
    rowsToRender,
    relativeIndexes,
    rowsProps,
    indexesMapping,
    visibleRowIndexes,
    visibleColumnIndexes,
    openedTrees,
    elevatedRowIndexes,
    elevatedColumnIndexes,
    selectedCells,
    id,
    isSpan,
    columns,
    globalRowProps,
    globalColumnProps,
    onRowOpen,
    onRowClose,
    onCellMouseDown,
    onCellMouseEnter,
    onCellMouseUp,
    onCellContextMenu,
    getVisibleRows,
    getRowTreeLengthForIndex,
  ]);

  return (
    <table
      className="table-root"
      role="grid"
      aria-rowcount={totalRowCount}
      aria-colcount={totalColumnCount}
      aria-multiselectable={multiSelectable ? true : undefined}
    >
      {header.length > 0 ? <thead>{header}</thead> : null}
      {body.length > 0 ? <tbody>{body}</tbody> : null}
    </table>
  );
}

export default ElementaryTable;
