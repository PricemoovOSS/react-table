import * as React from "react";
import classNames from "classnames";
import { isEqual } from "lodash";

import { MouseClickButtons, MAX_ROW_LEVEL } from "../constants";
import Cell, { ICell, ICellCoordinates } from "./cell";
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
  IRelativeIndex,
} from "../utils/table";
import { ISelectedCells } from "../table-selection/selection-handler";
import { ISelectionContext } from "../table-selection/context-menu-handler";
import shallowEqual from "../utils/shallowEqual";

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
  } = props;

  // Memoized colspan map; recomputed only when the cells array reference changes.
  // Note: `getMappingCellsWithColspan` is itself memoized in utils/table.
  const mappingCellsWithColspan: IIndexColspanMapping = React.useMemo(() => getMappingCellsWithColspan(cells), [cells]);

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
    visibleColumnIndexes && !mappingCellsWithColspan.isIdentity
      ? getColspanValues(visibleColumnIndexes, mappingCellsWithColspan.colspanToIndex)
      : [visibleColumnIndexes, null];

  const cellsToRender = visibleColumnIndexesAfterMapping
    ? visibleColumnIndexesAfterMapping.map((idx: number) => cells[idx])
    : cells;

  return (
    <>
      <tr
        role="row"
        aria-rowindex={absoluteIndex + 1}
        data-row-index={absoluteIndex}
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
          const cellColumn = columns ? columns[cellIndex] || {} : {};

          const elevationIndex = mappingCellsWithColspan.indexToColspan[cellIndex].find(
            (i) => !!elevatedColumnIndexes.elevations[i],
          );
          const elevation = elevationIndex !== undefined ? elevatedColumnIndexes.elevations[elevationIndex] : undefined;
          const absolutePosition =
            elevationIndex !== undefined ? elevatedColumnIndexes.absoluteEndPositions[elevationIndex] || 0 : 0;

          const column = {
            isSelectable: true,
            ...globalColumnProps,
            ...cellColumn,
            style: {
              ...globalColumnProps.style,
              ...cellColumn.style,
              right: absolutePosition,
            },
          };

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
              className={classNames(cell.className, column.className, {
                [`elevated-${elevation}`]: !!elevation,
              })}
              index={cellIndex}
              rowIndex={absoluteIndex}
              relativeRowIndex={relativeRowIndex}
              isSelectable={cellIsSelectable}
              isSelected={cellSelected}
              opened={openedCellIndex === cellIndex}
              hideSubItemsOpener={isSpan && firstCellIndexWithSubItems === cellIndex}
              onCallOpen={toggleCell}
              style={computeCellStyle(column, options)}
              onMouseDown={onCellMouseDown}
              onMouseEnter={onCellMouseEnter}
              onMouseUp={onCellMouseUp}
              onContextMenu={onCellContextMenu}
            />
          );
        })}
      </tr>
      {subRowElements}
    </>
  );
}

/**
 * Custom equality:
 * - selectedCells / elevatedRowIndexes / elevatedColumnIndexes are deep-compared (callers
 *   tend to spread fresh `{}` objects every render)
 * - other props use shallow equality
 * - if no cell of this row is opened, we ignore `visibleRowIndexes` since it only impacts subtree rendering
 */
function arePropsEqual(prev: IRowProps, next: IRowProps): boolean {
  const a: Partial<IRowProps> = { ...prev };
  const b: Partial<IRowProps> = { ...next };
  if (!next.openedTree) {
    delete a.visibleRowIndexes;
    delete b.visibleRowIndexes;
  }
  const {
    selectedCells: prevSelected,
    elevatedRowIndexes: prevElevatedRows,
    elevatedColumnIndexes: prevElevatedCols,
    ...prevRest
  } = a;
  const {
    selectedCells: nextSelected,
    elevatedRowIndexes: nextElevatedRows,
    elevatedColumnIndexes: nextElevatedCols,
    ...nextRest
  } = b;
  if (!shallowEqual(prevRest, nextRest)) return false;
  if (!isEqual(prevSelected, nextSelected)) return false;
  if (!isEqual(prevElevatedRows, nextElevatedRows)) return false;
  if (!isEqual(prevElevatedCols, nextElevatedCols)) return false;
  return true;
}

const Row = React.memo(RowComponent, arePropsEqual);
Row.displayName = "Row";

export default Row;
