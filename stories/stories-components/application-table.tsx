import * as React from "react";

import Table from "../../src/components/table/table";
import { IContentCellProps, SubRowsToggleButtonComponentProps } from "../../src/components/table/cell";
import { IRow } from "../../src/components/table/row";
import { IColumns, ITrees } from "../../src/components/table/elementary-table";
import { GroupCellProps } from "../../src/components/table/group-rows";
import { Group } from "../../src/components/utils/group";
import { OnVerticallyScrollProps, useVirtualizerManager } from "../../src/components/virtualizer";
import { ScrollDirection } from "../../src/components/scroller";
import TableInteractionsManager, {
  useTableInteractionsManager,
} from "../../src/components/table-interactions-manager/table-interactions-manager";

/**
 * A table wired the way a data application does it: an interactions manager around the
 * table (fixed and hidden columns, hidden rows, columns cursor), custom group cells and
 * sub-rows toggle, pages loaded when the scroll reaches the bottom, rows opened from outside.
 *
 * It is the page of the "Recipes/Application table" story and of the tests that guard this usage.
 */
export const HEADER_ROW_INDEX = 0;
export const SELECTION_COLUMN_INDEX = 0;
export const COLUMNS_COUNT = 30;
export const PAGE_SIZE = 40;

export interface IDataCoordinates {
  rowId: string;
  columnId: string;
}

export const columnId = (index: number) => (index === SELECTION_COLUMN_INDEX ? "selection" : `column-${index}`);

interface IApplicationGroup extends Group {
  /** Identifiers of the columns of the group: the group cell hides them all at once */
  groupedColumnIds?: string[];
  subGroups?: IApplicationGroup[];
}

export const GROUPS: IApplicationGroup[] = [
  { id: "identity", label: "Identity", groupedColumnIds: [1, 2].map(columnId) },
  {
    id: "prices",
    label: "Prices",
    subGroups: [
      { id: "current", label: "Current", groupedColumnIds: [3, 4, 5].map(columnId) },
      { id: "next", label: "Next", groupedColumnIds: [6, 7].map(columnId) },
    ],
  },
  { id: "totals", label: "Totals", groupedColumnIds: [COLUMNS_COUNT - 1].map(columnId) },
];

const GROUP_OF_COLUMN: Record<number, string> = {
  1: "identity",
  2: "identity",
  3: "current",
  4: "current",
  5: "current",
  6: "next",
  7: "next",
  [COLUMNS_COUNT - 1]: "totals",
};

export const COLUMNS: IColumns = {
  [SELECTION_COLUMN_INDEX]: { size: 48 },
  ...Object.fromEntries(Object.entries(GROUP_OF_COLUMN).map(([index, groupId]) => [index, { groupId }])),
};

const ROWS_PROPS = { [HEADER_ROW_INDEX]: { size: 48 } };

/** Content of a data cell: the application reads its own coordinates, not the table indexes. */
export function ValueCell({
  value,
  dataCoordinates,
  loading,
  unit,
}: IContentCellProps<IDataCoordinates> & { value?: string; unit?: string }) {
  if (loading) return <span data-testid="value-loading">…</span>;
  return (
    <span data-testid="value-cell" data-row-id={dataCoordinates?.rowId} data-column-id={dataCoordinates?.columnId}>
      {value}
      {unit ? ` ${unit}` : ""}
    </span>
  );
}

function SelectionCell({ dataCoordinates }: IContentCellProps<IDataCoordinates>) {
  return <input type="checkbox" aria-label={`Select ${dataCoordinates?.rowId}`} data-testid="row-selector" />;
}

function buildRow(rowId: string, withSubRows: boolean, loading = false): IRow<IDataCoordinates> {
  return {
    id: rowId,
    loading,
    cells: Array.from({ length: COLUMNS_COUNT }, (_, index) => ({
      id: `${rowId}-${columnId(index)}`,
      value: `${rowId}:${index}`,
      dataCoordinates: { rowId, columnId: columnId(index) },
      cellContent: index === SELECTION_COLUMN_INDEX ? SelectionCell : ValueCell,
      cellContentProps: index > 2 ? { unit: "€" } : undefined,
      // the sub-rows hang on the first cell after the selection, like a grouped view
      subItems: withSubRows && index === 1 ? [buildRow(`${rowId}.1`, false), buildRow(`${rowId}.2`, false)] : undefined,
    })),
  };
}

const headerRow: IRow<IDataCoordinates> = {
  id: "header",
  isHeader: true,
  cells: Array.from({ length: COLUMNS_COUNT }, (_, index) => ({
    // the id of a header cell is the id of its column: the manager resolves columns with it
    id: columnId(index),
    value: index === SELECTION_COLUMN_INDEX ? "" : `Column ${index}`,
  })),
};

export const buildPage = (page: number, pageSize = PAGE_SIZE): IRow<IDataCoordinates>[] =>
  Array.from({ length: pageSize }, (_, index) => {
    const position = page * pageSize + index;
    return buildRow(`row-${position}`, position % 5 === 0);
  });

/** Group cell of the application: reads the visible window and the fixed columns, hides its columns. */
function ApplicationGroupCell({ className, group, style }: GroupCellProps) {
  const { cellWidth, visibleColumnIndexes } = useVirtualizerManager();
  const { hiddenColumnsIds, updateHiddenIds } = useTableInteractionsManager();
  const groupedColumnIds = (group as IApplicationGroup).groupedColumnIds;
  return (
    <th
      className={className}
      colSpan={group.size}
      style={style}
      data-testid={`group-${group.label || "unnamed"}`}
      data-cell-width={cellWidth}
      data-visible-columns={visibleColumnIndexes.length}
    >
      {group.label}
      {groupedColumnIds?.length ? (
        <button
          type="button"
          aria-label={`Hide ${group.label}`}
          onClick={() => updateHiddenIds([...hiddenColumnsIds, ...groupedColumnIds])}
        >
          ×
        </button>
      ) : null}
    </th>
  );
}

function ApplicationToggle({ opened, onClick, tabIndex }: SubRowsToggleButtonComponentProps) {
  return (
    <button
      type="button"
      className="table-cell-sub-item-toggle"
      data-testid="table-cell-sub-item-toggle"
      aria-expanded={!!opened}
      tabIndex={tabIndex}
      onClick={onClick}
    >
      {opened ? "▾" : "▸"}
    </button>
  );
}

const GROUPS_PROPS = { rowsOptions: { size: 30 }, CustomGroupCell: ApplicationGroupCell };

export interface IApplicationTableProps {
  /** Explicit size: the table is sized by its container when omitted */
  width?: number;
  height?: number;
  pages?: number;
  pageSize?: number;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  onOpenedTreesUpdate?: (trees: ITrees) => void;
  scrollbarSize?: number;
  scrollEndThreshold?: number;
  withGroups?: boolean;
}

/** Rows of the header and of every loaded page, plus placeholders while a page is loading. */
function useRows(pages: number, pageSize: number, isLoadingMore: boolean) {
  return React.useMemo(() => {
    const rows = [headerRow];
    for (let page = 0; page < pages; page++) rows.push(...buildPage(page, pageSize));
    if (isLoadingMore) rows.push(buildRow("loading-1", false, true), buildRow("loading-2", false, true));
    return rows;
  }, [pages, pageSize, isLoadingMore]);
}

export function ApplicationTable({
  width,
  height,
  pages = 1,
  pageSize = PAGE_SIZE,
  isLoadingMore = false,
  onLoadMore,
  onOpenedTreesUpdate,
  scrollbarSize,
  scrollEndThreshold,
  withGroups = true,
}: IApplicationTableProps) {
  const { tableRef, columnsCursor, fixedColumnsIndexes, hiddenColumnsIndexes, hiddenRowIndexes, onHorizontallyScroll } =
    useTableInteractionsManager();
  const rows = useRows(pages, pageSize, isLoadingMore);

  // Next page when the scroll reaches the bottom, going down
  const loadNextPage = React.useCallback(
    ({ scrollValues: { maxBottomReached, directions } }: OnVerticallyScrollProps) => {
      if (!isLoadingMore && maxBottomReached && directions.includes(ScrollDirection.down)) onLoadMore?.();
    },
    [isLoadingMore, onLoadMore],
  );

  return (
    <Table
      id="application-table"
      ref={tableRef}
      isVirtualized
      isSelectable={false}
      rows={rows}
      rowsProps={ROWS_PROPS}
      columns={COLUMNS}
      groups={withGroups ? GROUPS : undefined}
      groupsProps={GROUPS_PROPS}
      SubRowsToggleButtonComponent={ApplicationToggle}
      onOpenedTreesUpdate={onOpenedTreesUpdate}
      // Inline object and arrays on purpose: applications write it this way
      virtualizerProps={{
        fixedColumns: [SELECTION_COLUMN_INDEX, ...fixedColumnsIndexes],
        fixedRows: [HEADER_ROW_INDEX],
        hiddenColumns: hiddenColumnsIndexes,
        hiddenRows: hiddenRowIndexes,
        minColumnWidth: 120,
        minRowHeight: 40,
        initialScroll: { columnIndex: columnsCursor?.index },
        onVerticallyScroll: loadNextPage,
        onHorizontallyScroll,
        scrollbarSize,
        scrollEndThreshold,
        width,
        height,
      }}
    />
  );
}

export const TOGGLEABLE_COLUMNS = Array.from({ length: COLUMNS_COUNT - 1 }, (_, index) => ({
  id: columnId(index + 1),
  index: index + 1,
}));

export interface IApplicationProps extends IApplicationTableProps {
  initialFixedColumnsIds?: string[];
  initialHiddenColumnsIds?: string[];
  initialColumnsCursorIndex?: number;
  children?: React.ReactNode;
}

/** The manager and the table, as an application mounts them. */
export function Application({
  initialFixedColumnsIds = [],
  initialHiddenColumnsIds = [],
  initialColumnsCursorIndex,
  children,
  ...tableProps
}: IApplicationProps) {
  const initialConfig = React.useMemo(
    () => ({
      columnsCursor:
        initialColumnsCursorIndex === undefined
          ? null
          : { id: columnId(initialColumnsCursorIndex), index: initialColumnsCursorIndex },
      hiddenColumnsIds: initialHiddenColumnsIds,
      fixedColumnsIds: initialFixedColumnsIds,
    }),
    [initialColumnsCursorIndex, initialHiddenColumnsIds, initialFixedColumnsIds],
  );
  return (
    <TableInteractionsManager initialConfig={initialConfig} toggleableColumns={TOGGLEABLE_COLUMNS}>
      {children}
      <ApplicationTable {...tableProps} />
    </TableInteractionsManager>
  );
}
