import * as React from "react";
import classNames from "classnames";
import { isEqual } from "lodash";

import { MouseClickButtons, MAX_ROW_LEVEL } from "../constants";
import Cell, { ICell, ICellCoordinates, SubRowsToggleButtonComponentProps } from "./cell";
import RowSpan, { IRowSpan } from "./row-span";
import { IColumn, IColumnOptions, ITree } from "./elementary-table";
import {
  computeCellStyle,
  computeRowStyle,
  IRelativeIndexesMap,
  getTreesLength,
  filterIndexes,
  getMappingCellsWithColspan,
  getColspanValues,
  IIndexColspanMapping,
  IElevateds,
  ElevationType,
  IRelativeIndex,
  getSubRowsCellIndex,
} from "../utils/table";
import { ISelectedCells } from "../table-selection/selection-handler";
import { ISelectionContext } from "../table-selection/context-menu-handler";

export interface IRowOptions {
  size?: number;
}

export interface IRow<IDataCoordinates = any> extends IRowOptions {
  id: string;
  className?: string;
  cells: ICell<IDataCoordinates>[];
  isHeader?: boolean;
  isSelectable?: boolean;
  rowSpanProps?: IRowSpan;
  /** When true, sub-rows of this row remain fixed at the bottom while scrolling */
  fixSubRows?: boolean;
  loading?: boolean;
}

export interface IRowProps extends IRow {
  absoluteIndex: number;
  index: number;
  level: number;
  relativeSubIndexesMapping: IRelativeIndexesMap;
  selectedCells: ISelectedCells;
  visibleRowIndexes?: number[];
  visibleColumnIndexes?: number[];
  elevatedColumnIndexes?: IElevateds;
  elevatedRowIndexes?: IElevateds;
  openedTree?: ITree;
  isSpan?: boolean;
  delegatedSpan?: JSX.Element;
  isVisible?: boolean;
  style?: React.CSSProperties;
  columns?: { [index: number]: IColumn };
  globalColumnProps: IColumnOptions;
  getVisibleRows: (rows: IRow[], absoluteIndex: number) => [number[] | null, IRow[]];
  getRowTreeLength?: (absoluteIndex: number) => number;
  onCellMouseDown?: (coordinates: ICellCoordinates, mouseClickButton: MouseClickButtons) => void;
  onCellMouseEnter?: (coordinates: ICellCoordinates) => void;
  onCellMouseUp?: () => void;
  onCellContextMenu?: (selectionContext: ISelectionContext) => void;
  onOpen?: (openedTree: ITree) => void;
  onClose?: (closedTree: ITree) => void;
  /**
   * Optional React component used to render a toggle button
   * for opening/closing subRows inside the row cells.
   * defult = DefaultSubRowsToggleButtonComponent
   */
  SubRowsToggleButtonComponent?: React.ComponentType<SubRowsToggleButtonComponentProps>;
  /**
   * Internal index used to distinguish cells belonging to sub-rows that share
   * the same order as the root-row cell containing those sub-rows.
   * If undefined, it means there are no sub-rows.
   */
  subRowsCellIndex?: number;
}

const DEFAULT_RELATIVE_INDEX: Partial<IRelativeIndex> = {
  subItems: undefined,
  index: undefined,
};

const DEFAULT_ELEVATED: IElevateds = { elevations: {}, absoluteEndPositions: {} };
const DEFAULT_GET_VISIBLE_ROWS: IRowProps["getVisibleRows"] = (rows) => [null, rows];
const DEFAULT_RELATIVE_MAP: IRelativeIndexesMap = {};
const DEFAULT_GLOBAL_COLUMN_PROPS: IColumnOptions = {};
const DEFAULT_COLUMNS: { [index: number]: IColumn } = {};
const EMPTY_SELECTED_CELLS: ISelectedCells = {};

const NO_COLUMN: IColumn = {};
const NO_CLASS_NAME = "";

/** The first of the cells fixed at the end: it draws their relief. */
const isAbsoluteEdge = (elevation?: ElevationType, previousElevation?: ElevationType) =>
  elevation === ElevationType.absolute && previousElevation !== ElevationType.absolute;

function hasColspans(cells: ICell[]): boolean {
  for (let i = 0; i < cells.length; i++) {
    if ((cells[i].colspan || 1) > 1) return true;
  }
  return false;
}

/** The column that gives its elevation to the cell: the cell itself, or one of the columns it spans. */
function getElevationIndex(
  cellIndex: number,
  elevations: IElevateds["elevations"],
  colspanMapping: IIndexColspanMapping | null,
): number | undefined {
  if (!colspanMapping) return elevations[cellIndex] ? cellIndex : undefined;
  const spannedIndexes = colspanMapping.indexToColspan[cellIndex];
  for (let i = 0; i < spannedIndexes.length; i++) {
    if (elevations[spannedIndexes[i]]) return spannedIndexes[i];
  }
  return undefined;
}

function getCellClassName(cellClassName?: string, columnClassName?: string, elevation?: ElevationType, isEdge?: boolean) {
  if (!elevation) return cellClassName || columnClassName ? classNames(cellClassName, columnClassName) : NO_CLASS_NAME;
  return classNames(cellClassName, columnClassName, `elevated-${elevation}`, isEdge && "elevated-absolute-edge");
}

/** What the cells of a column share, on the rows of a given height */
interface IColumnLayout {
  style: React.CSSProperties;
  className?: string;
  isSelectable: boolean;
  loading?: boolean;
}

type ILayoutsByPlace = Map<number | undefined, Map<number, IColumnLayout>>;
type ILayoutsByColumn = WeakMap<IColumn, ILayoutsByPlace>;
/** Per `columns` object then per global options: options modified in place come with a new object, and start afresh */
const columnLayouts = new WeakMap<object, WeakMap<IColumnOptions, ILayoutsByColumn>>();
/** Row heights, then end positions, kept per column: a handful in practice */
const MAX_LAYOUTS = 16;

function computeColumnLayout(
  globalColumnProps: IColumnOptions,
  cellColumn: IColumn,
  right: number,
  size?: number,
): IColumnLayout {
  const column = {
    isSelectable: true,
    ...globalColumnProps,
    ...cellColumn,
    style: { ...globalColumnProps.style, ...cellColumn.style, right },
  };
  return {
    style: computeCellStyle(column, { size }),
    className: column.className,
    isSelectable: column.isSelectable,
    loading: column.loading,
  };
}

/** Level of the cache for a row height: bounded, a table has a handful of them. */
function getLayoutsByRight(byPlace: ILayoutsByPlace, size?: number): Map<number, IColumnLayout> {
  let byRight = byPlace.get(size);
  if (!byRight) {
    if (byPlace.size >= MAX_LAYOUTS) byPlace.clear();
    byRight = new Map();
    byPlace.set(size, byRight);
  }
  return byRight;
}

/**
 * Computed once per column and not once per cell: every row renders at a horizontal scroll
 * step. The cells of a column also get the same `style` object, from one render to the next.
 */
function getColumnLayout(
  columns: object,
  globalColumnProps: IColumnOptions,
  cellColumn: IColumn,
  right: number,
  size?: number,
): IColumnLayout {
  let byGlobalProps = columnLayouts.get(columns);
  if (!byGlobalProps) {
    byGlobalProps = new WeakMap();
    columnLayouts.set(columns, byGlobalProps);
  }
  let byColumn = byGlobalProps.get(globalColumnProps);
  if (!byColumn) {
    byColumn = new WeakMap();
    byGlobalProps.set(globalColumnProps, byColumn);
  }
  let byPlace = byColumn.get(cellColumn);
  if (!byPlace) {
    byPlace = new Map();
    byColumn.set(cellColumn, byPlace);
  }
  const byRight = getLayoutsByRight(byPlace, size);
  let layout = byRight.get(right);
  if (!layout) {
    if (byRight.size >= MAX_LAYOUTS) byRight.clear();
    layout = computeColumnLayout(globalColumnProps, cellColumn, right, size);
    byRight.set(right, layout);
  }
  return layout;
}

function RowComponent(props: IRowProps): JSX.Element | null {
  const {
    id,
    loading,
    className,
    cells,
    absoluteIndex = 0,
    index: relativeRowIndex = 0,
    isVisible = true,
    isSelectable = true,
    isSpan,
    isHeader,
    columns = DEFAULT_COLUMNS,
    openedTree,
    globalColumnProps = DEFAULT_GLOBAL_COLUMN_PROPS,
    visibleColumnIndexes,
    elevatedColumnIndexes = DEFAULT_ELEVATED,
    delegatedSpan,
    size,
    onCellMouseDown,
    onCellMouseEnter,
    onCellMouseUp,
    onCellContextMenu,
    selectedCells = EMPTY_SELECTED_CELLS,
    style,
    SubRowsToggleButtonComponent,
    subRowsCellIndex,
  } = props;

  // Only for a row with spanning cells: the mapping costs one pass over all the cells of the
  // row, visible or not, each time a row enters the window.
  const colspanMapping: IIndexColspanMapping | null = React.useMemo(
    () => (hasColspans(cells) ? getMappingCellsWithColspan(cells) : null),
    [cells],
  );

  const openedCellIndex = openedTree ? openedTree.columnIndex : null;
  const openedCell = openedCellIndex !== null ? cells[openedCellIndex] : null;

  const firstCellIndexWithSubItems: number = React.useMemo(
    () => (isSpan ? cells.findIndex((cell) => (cell.subItems ? cell.subItems.length > 0 : false)) : -1),
    [isSpan, cells],
  );

  // Read-through-ref pattern: the props identity changes every render but the callbacks
  // we hand to <Cell> / <RowSpan> / nested <Row> must stay referentially stable to keep
  // their `React.memo` honest. Without this, every vertical scroll re-renders every cell
  // because `toggleCell` got a new identity (its dep `updateOpenedCell` had `[props]`).
  const propsRef = React.useRef(props);
  propsRef.current = props;

  const updateOpenedCell = React.useCallback((cellIndex: number) => {
    const { onOpen, onClose, index, openedTree: tree } = propsRef.current;
    const currentOpenedIndex = tree ? tree.columnIndex : null;
    const newIndex = currentOpenedIndex === cellIndex ? null : cellIndex;
    if (newIndex === currentOpenedIndex) return;
    if (newIndex !== null && onOpen) onOpen({ rowIndex: index, columnIndex: newIndex });
    else if (newIndex === null && onClose) onClose({ rowIndex: index, columnIndex: cellIndex });
  }, []);

  const onSubRowOpen = React.useCallback((newOpenedTree: ITree) => {
    const { onOpen, openedTree: tree } = propsRef.current;
    if (!onOpen) return;
    const subTrees = (tree && tree.subTrees) || {};
    onOpen({ ...(tree as ITree), subTrees: { ...subTrees, [newOpenedTree.rowIndex]: newOpenedTree } });
  }, []);

  const onSubRowClose = React.useCallback((treeToClose: ITree) => {
    const { onOpen, openedTree: tree } = propsRef.current;
    if (!onOpen) return;
    const subTrees = { ...((tree && tree.subTrees) || {}) };
    delete subTrees[treeToClose.rowIndex];
    onOpen({ ...(tree as ITree), subTrees });
  }, []);

  const toggleCell = React.useCallback(
    (cellIndex: number) => {
      const { cells: currentCells } = propsRef.current;
      if (currentCells[cellIndex]) updateOpenedCell(cellIndex);
    },
    [updateOpenedCell],
  );

  const toggleFirstCell = React.useCallback(() => {
    const { cells: currentCells, openedTree: tree, isSpan: span } = propsRef.current;
    const currentOpenedCellIndex = tree ? tree.columnIndex : null;
    if (currentOpenedCellIndex !== null) {
      updateOpenedCell(currentOpenedCellIndex);
      return;
    }
    const firstWithSubItems = span ? currentCells.findIndex((c) => (c.subItems ? c.subItems.length > 0 : false)) : -1;
    if (firstWithSubItems >= 0) updateOpenedCell(firstWithSubItems);
  }, [openedCellIndex, firstCellIndexWithSubItems, updateOpenedCell]);

  const renderRowSpan = (hasSubItems: boolean) => {
    if (!hasSubItems) return <td className="table-column row-span-column" rowSpan={1} />;
    const { absoluteIndex: absIndex, getRowTreeLength, visibleRowIndexes, rowSpanProps } = props;
    const subItems = openedCell ? openedCell.subItems || [] : [];
    const subTrees = openedTree ? openedTree.subTrees || {} : {};
    const length =
      visibleRowIndexes && getRowTreeLength
        ? getRowTreeLength(absIndex) + (isVisible ? 1 : 0)
        : getTreesLength(subTrees, subItems) + subItems.length + 1;
    return (
      <RowSpan opened={!!openedCell} length={openedCell ? length : 1} toggle={toggleFirstCell} {...rowSpanProps} height={size} />
    );
  };

  const getDelegatedSpan = (firstCellIdx: number): JSX.Element | undefined =>
    (props.level === 0 && isSpan && renderRowSpan(firstCellIdx >= 0)) || delegatedSpan;

  const renderSubRows = (firstCellIdx: number): JSX.Element[] | null => {
    const {
      level = 0,
      visibleRowIndexes,
      getVisibleRows = DEFAULT_GET_VISIBLE_ROWS,
      relativeSubIndexesMapping = DEFAULT_RELATIVE_MAP,
      elevatedRowIndexes = DEFAULT_ELEVATED,
    } = props;
    const subRows = openedCell ? openedCell.subItems || [] : [];
    const [relativeIndexes, rowsToRender] = getVisibleRows(subRows, props.absoluteIndex);
    if (!rowsToRender.length) return null;

    const globalProps: IRowOptions = { size };
    const subOpenedTrees = (openedTree && openedTree.subTrees) || {};
    const subRowSpan = !isVisible ? getDelegatedSpan(firstCellIdx) : undefined;
    const subLevel = level + 1;
    const minLevel = Math.min(subLevel, MAX_ROW_LEVEL);

    return rowsToRender.map((subRow, idx) => {
      const subRowIndex = relativeIndexes ? relativeIndexes[idx] : idx;
      const { subItems, index: rowAbsoluteIndex } = relativeSubIndexesMapping[subRowIndex] || DEFAULT_RELATIVE_INDEX;
      const subRowVisible =
        !visibleRowIndexes || (rowAbsoluteIndex !== undefined && visibleRowIndexes.includes(rowAbsoluteIndex));
      const subOpenedTree = subOpenedTrees[subRowIndex];
      const elevation = rowAbsoluteIndex !== undefined ? elevatedRowIndexes.elevations[rowAbsoluteIndex] : undefined;
      const absolutePosition =
        rowAbsoluteIndex !== undefined ? elevatedRowIndexes.absoluteEndPositions[rowAbsoluteIndex] : undefined;
      const rowStyle = absolutePosition != null ? { bottom: absolutePosition } : undefined;

      let rowSelectedCells =
        rowAbsoluteIndex !== undefined && (subItems || selectedCells[rowAbsoluteIndex]) ? selectedCells : undefined;
      const nextRowMap = relativeSubIndexesMapping[subRowIndex + 1];
      const nextRowAbsoluteIndex = nextRowMap?.index;
      if (rowSelectedCells && rowAbsoluteIndex !== undefined && nextRowAbsoluteIndex) {
        rowSelectedCells = filterIndexes(rowSelectedCells, rowAbsoluteIndex, nextRowAbsoluteIndex);
      }

      const subDelegatedSpan = idx === 0 ? subRowSpan : undefined;
      const subrowId = `${id}-${subRow.id}`;

      return (
        <Row
          key={`row-${subrowId}`}
          {...globalProps}
          {...subRow}
          id={subrowId}
          className={classNames(subRow.className, `sub-row sub-row__${minLevel}`, {
            "last-sub-row": subRows.length === subRowIndex + 1,
            [`elevated-${elevation}`]: !!elevation,
          })}
          subRowsCellIndex={getSubRowsCellIndex(subRow) ?? subRowsCellIndex}
          style={rowStyle}
          absoluteIndex={rowAbsoluteIndex ?? 0}
          index={subRowIndex}
          level={subLevel}
          isVisible={subRowVisible}
          columns={columns}
          globalColumnProps={globalColumnProps}
          visibleColumnIndexes={visibleColumnIndexes}
          visibleRowIndexes={visibleRowIndexes}
          openedTree={subOpenedTree}
          elevatedColumnIndexes={elevatedColumnIndexes}
          elevatedRowIndexes={elevatedRowIndexes}
          relativeSubIndexesMapping={subItems ?? DEFAULT_RELATIVE_MAP}
          delegatedSpan={subDelegatedSpan}
          getVisibleRows={getVisibleRows}
          onCellMouseDown={onCellMouseDown}
          onCellMouseEnter={onCellMouseEnter}
          onCellMouseUp={onCellMouseUp}
          onCellContextMenu={onCellContextMenu}
          onOpen={onSubRowOpen}
          onClose={onSubRowClose}
          selectedCells={rowSelectedCells ?? EMPTY_SELECTED_CELLS}
          SubRowsToggleButtonComponent={SubRowsToggleButtonComponent}
        />
      );
    });
  };

  const subRowElements = openedCell ? renderSubRows(firstCellIndexWithSubItems) : null;

  if (!isVisible) {
    return <>{subRowElements}</>;
  }

  const options: IRowOptions = { size };
  const selectedRowCells = selectedCells && selectedCells[absoluteIndex];

  const [visibleColumnIndexesAfterMapping, mappingColspanToIndex] =
    visibleColumnIndexes && colspanMapping
      ? getColspanValues(visibleColumnIndexes, colspanMapping.colspanToIndex)
      : [visibleColumnIndexes, null];

  const cellsToRender = visibleColumnIndexesAfterMapping
    ? visibleColumnIndexesAfterMapping.map((idx: number) => cells[idx])
    : cells;
  let previousElevation: ElevationType | undefined;

  return (
    <>
      <tr
        role="row"
        aria-rowindex={absoluteIndex + 1}
        data-testid={`table-${isHeader ? "header" : "row"}-${id}`}
        className={classNames("table-row", className, {
          head: isHeader,
          opened: openedCellIndex !== null,
        })}
        style={computeRowStyle(options, style)}
      >
        {delegatedSpan}
        {isSpan && !delegatedSpan ? renderRowSpan(firstCellIndexWithSubItems >= 0) : null}
        {cellsToRender.map((cell, idx) => {
          if (!cell) return null;
          const cellIndex = (visibleColumnIndexesAfterMapping && visibleColumnIndexesAfterMapping[idx]) || idx;
          const cellColumn = (columns && columns[cellIndex]) || NO_COLUMN;

          const elevationIndex = getElevationIndex(cellIndex, elevatedColumnIndexes.elevations, colspanMapping);
          const elevation = elevationIndex !== undefined ? elevatedColumnIndexes.elevations[elevationIndex] : undefined;
          const absolutePosition =
            elevationIndex !== undefined ? elevatedColumnIndexes.absoluteEndPositions[elevationIndex] || 0 : 0;
          const isEdge = isAbsoluteEdge(elevation, previousElevation);
          previousElevation = elevation;

          const column = getColumnLayout(columns, globalColumnProps, cellColumn, absolutePosition, size);

          const cellSelected = (selectedRowCells && selectedRowCells.includes(cellIndex)) || false;
          const cellIsSelectable =
            isSelectable && column.isSelectable && (cell.isSelectable === undefined || cell.isSelectable === true);
          const cellLoading = column.loading || cell.loading || loading;

          return (
            <Cell
              key={`cell-${id}-${cell.id}`}
              component={isHeader ? "th" : "td"}
              {...cell}
              loading={cellLoading}
              // When a virtualizer column-mapping exists (i.e. visible columns may be a
              // subset that splits a colspan), use it. Otherwise fall back to the cell's
              // own colspan so non-virtualized tables still render the right span.
              colspan={mappingColspanToIndex ? mappingColspanToIndex[cellIndex] : (cell.colspan ?? 1)}
              className={getCellClassName(cell.className, column.className, elevation, isEdge)}
              index={cellIndex}
              // by position among the displayed cells, as in 4.x: when the column that carries the sub rows
              // is scrolled out, the first cell displayed keeps the indent and the connector of the sub rows
              isSubCell={subRowsCellIndex == idx}
              rowIndex={absoluteIndex}
              relativeRowIndex={relativeRowIndex}
              isSelectable={cellIsSelectable}
              isSelected={cellSelected}
              opened={openedCellIndex === cellIndex}
              hideSubItemsOpener={isSpan && firstCellIndexWithSubItems === cellIndex}
              onCallOpen={toggleCell}
              style={column.style}
              onMouseDown={onCellMouseDown}
              onMouseEnter={onCellMouseEnter}
              onMouseUp={onCellMouseUp}
              onContextMenu={onCellContextMenu}
              SubRowsToggleButtonComponent={SubRowsToggleButtonComponent}
            />
          );
        })}
      </tr>
      {subRowElements}
    </>
  );
}

const hasOwn = Object.prototype.hasOwnProperty;
/** Rebuilt by the callers at every render: their content is what matters. */
const DEEP_COMPARED_PROPS: ReadonlySet<string> = new Set(["selectedCells", "elevatedRowIndexes", "elevatedColumnIndexes"]);

/**
 * Same props, with two exceptions: the props above are compared by content, and
 * `visibleRowIndexes` is ignored while the row has no opened cell (it only serves its
 * sub rows). Written without any allocation: it runs for every row at every scroll step.
 */
function arePropsEqual(prev: IRowProps, next: IRowProps): boolean {
  const keys = Object.keys(prev) as (keyof IRowProps)[];
  if (keys.length !== Object.keys(next).length) return false;
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (!hasOwn.call(next, key)) return false;
    if (Object.is(prev[key], next[key])) continue;
    if (key === "visibleRowIndexes" && !next.openedTree) continue;
    if (!DEEP_COMPARED_PROPS.has(key) || !isEqual(prev[key], next[key])) return false;
  }
  return true;
}

const Row = React.memo(RowComponent, arePropsEqual);
Row.displayName = "Row";

export default Row;
