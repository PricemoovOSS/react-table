import * as React from "react";

import Table from "../../src/components/table/table";
import { IRow } from "../../src/components/table/row";
import { IColumns } from "../../src/components/table/elementary-table";

export type MixedTableOption =
  | "columnSizes"
  | "groups"
  | "fixedStartColumns"
  | "fixedEndColumn"
  | "hiddenColumns"
  | "rowSizes"
  | "fixedBottomRow"
  | "hiddenRows";
export type IMixedTableOptions = Record<MixedTableOption, boolean>;

/**
 * What the page lets change while the table is displayed. A list, not an exported object read by its
 * keys: Storybook adds its documentation to the exported objects of a story file.
 */
const OPTION_LABELS: [MixedTableOption, string][] = [
  ["columnSizes", "Columns of different sizes"],
  ["groups", "Groups, the last one over several columns"],
  ["fixedStartColumns", "Small columns fixed at the start"],
  ["fixedEndColumn", "Last column fixed at the end"],
  ["hiddenColumns", "Two columns hidden"],
  ["rowSizes", "Rows of different sizes"],
  ["fixedBottomRow", "Last row fixed at the bottom"],
  ["hiddenRows", "Three rows hidden"],
];

/**
 * Columns of an application table: selection and an action, wide formulas, a group at the end.
 * With the padding of the default cells, a column cannot be narrower than 48 px.
 */
export const MIXED_COLUMNS = [
  { label: "Select", size: 48 },
  { label: "Pin", size: 56 },
  { label: "Name", size: 200, group: "identity" },
  { label: "Formula min", size: 600, group: "formulas" },
  { label: "Formula max", size: 600, group: "formulas" },
  { label: "Status", size: 120 },
  { label: "Owner", size: 180 },
  { label: "Lists", size: 220 },
  { label: "Scope", size: 140 },
  { label: "Comment", size: 320 },
  { label: "Stock A", size: 160, group: "end" },
  { label: "Stock B", size: 110, group: "end" },
  { label: "Stock C", size: 260, group: "end" },
  { label: "Actions", size: 90, group: "end" },
];
export const MIXED_ROWS = 60;
export const MIXED_HIDDEN_COLUMNS = [6, 9];
export const MIXED_HIDDEN_ROWS = [5, 12, MIXED_ROWS - 2];
export const MIXED_ROW_SIZES: Record<number, number> = {
  0: 36,
  3: 120,
  10: 200,
  11: 30,
  25: 90,
  [MIXED_ROWS - 3]: 150,
  [MIXED_ROWS - 1]: 70,
};

const LAST_COLUMN = MIXED_COLUMNS.length - 1;
const ROWS_PROPS = Object.fromEntries(Object.entries(MIXED_ROW_SIZES).map(([index, size]) => [index, { size }]));
const LAST_ROW = MIXED_ROWS - 1;
const GROUPS = [
  { id: "identity", label: "Identity" },
  { id: "formulas", label: "Formulas" },
  { id: "end", label: "Stock and actions" },
];

const rows: IRow[] = Array.from(Array(MIXED_ROWS), (_, rowIndex) => ({
  id: `row-${rowIndex}`,
  isHeader: rowIndex === 0,
  cells: MIXED_COLUMNS.map(({ label, size }, columnIndex) => ({
    id: `cell-${rowIndex}-${columnIndex}`,
    value: rowIndex === 0 ? `${columnIndex} · ${label} · ${size}` : `${rowIndex} · ${columnIndex}`,
  })),
}));

function getColumns({ columnSizes, groups }: IMixedTableOptions): IColumns {
  return Object.fromEntries(
    MIXED_COLUMNS.map(({ size, group }, index) => [
      index,
      { ...(columnSizes ? { size } : {}), ...(groups && group ? { groupId: group } : {}) },
    ]),
  );
}

export interface IMixedTablePageProps extends Partial<IMixedTableOptions> {
  width?: number;
  height?: number;
}

/**
 * Sizes, groups, fixed and hidden rows and columns, each one switched while the table is displayed:
 * whatever the mix, scrolling goes through every row and column, down to the last ones.
 */
export function MixedTablePage({ width = 1100, height = 520, ...initial }: IMixedTablePageProps): JSX.Element {
  const [options, setOptions] = React.useState<IMixedTableOptions>(() => ({
    columnSizes: true,
    groups: true,
    fixedStartColumns: true,
    fixedEndColumn: true,
    hiddenColumns: false,
    rowSizes: true,
    fixedBottomRow: false,
    hiddenRows: false,
    ...initial,
  }));
  const toggle = (option: MixedTableOption) => setOptions((current) => ({ ...current, [option]: !current[option] }));

  const columns = React.useMemo(() => getColumns(options), [options]);
  const virtualizerProps = {
    width,
    height,
    minRowHeight: 40,
    minColumnWidth: 120,
    fixedRows: options.fixedBottomRow ? [0, LAST_ROW] : [0],
    fixedColumns: [0, ...(options.fixedStartColumns ? [1] : []), ...(options.fixedEndColumn ? [LAST_COLUMN] : [])],
    hiddenColumns: options.hiddenColumns ? MIXED_HIDDEN_COLUMNS : [],
    hiddenRows: options.hiddenRows ? MIXED_HIDDEN_ROWS : [],
  };

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 20px", marginBottom: 12, fontSize: 13 }}>
        {OPTION_LABELS.map(([option, label]) => (
          <label key={option} style={{ cursor: "pointer" }}>
            <input type="checkbox" data-testid={`option-${option}`} checked={options[option]} onChange={() => toggle(option)} />{" "}
            {label}
          </label>
        ))}
      </div>
      <Table
        id="mixed-table"
        rows={rows}
        isVirtualized
        isSelectable={false}
        columns={columns}
        rowsProps={options.rowSizes ? ROWS_PROPS : undefined}
        groups={options.groups ? GROUPS : undefined}
        groupsProps={{ rowsOptions: { size: 30 } }}
        virtualizerProps={virtualizerProps}
      />
    </div>
  );
}
