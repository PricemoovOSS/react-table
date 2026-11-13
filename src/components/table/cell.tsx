import * as React from "react";
import IconButton from "@mui/material/IconButton";
import Skeleton from "@mui/material/Skeleton";
import Icon from "@mui/material/Icon";
import classNames from "classnames";

import { DEFAULT_ROW_HEIGHT, DEFAULT_COLUMN_WIDTH, DEFAULT_COLSPAN, MouseClickButtons } from "../constants";
import { IRow } from "./row";
import { getMouseClickButton } from "../utils/table";
import { ISelectionContext } from "../table-selection/context-menu-handler";
import shallowEqual from "../utils/shallowEqual";

export interface ICellCoordinates {
  rowIndex: number;
  cellIndex: number;
}

export interface IContentCellProps<IDataCoordinates = any> {
  id?: string;
  index?: number;
  rowIndex?: number;
  relativeRowIndex?: number;
  isSelected?: boolean;
  dataCoordinates?: IDataCoordinates;
  /** True while the cell, its row or its column is loading */
  loading?: boolean;
}

type CellTag = "td" | "th";

export interface SubRowsToggleButtonComponentProps {
  /**
   * Indicates whether sub-rows are currently open (expanded).
   */
  opened?: boolean;
  /**
   * Handler called when the toggle button is clicked.
   * Receives the standard MouseEvent for HTML button elements.
   */
  onClick: React.MouseEventHandler<HTMLButtonElement>;
  /** `-1` when the cell itself is the keyboard target (keyboard navigation on) */
  tabIndex?: number;
}

export interface ICell<IDataCoordinates = any> {
  id: string;
  /** Static CSS class for the cell */
  className?: string;
  /** Class getter (computed from cell props at render time) */
  getClassName?: (props: ICell) => string;
  /** Cell text value (used as title attribute and as fallback content) */
  value?: string;
  /** Colspan applied to the underlying `<td>` */
  colspan?: number;
  /** Custom component rendered in place of the cell text */
  cellContent?: React.ComponentType<any>;
  /** Extra props passed to `cellContent` */
  cellContentProps?: object;
  dataCoordinates?: IDataCoordinates;
  /** When the cell is openable, the rows revealed beneath */
  subItems?: IRow[];
  isSelectable?: boolean;
  style?: React.CSSProperties;
  component?: CellTag;
  loading?: boolean;
}

export interface ICellProps extends ICell {
  index: number;
  rowIndex: number;
  relativeRowIndex: number;
  isSelected?: boolean;
  /** Whether the cell is currently revealing its sub-items */
  opened?: boolean;
  /** Hides the open/close arrow even if the cell has sub-items */
  hideSubItemsOpener?: boolean;
  onCallOpen?: (cellIndex: number) => void;
  onMouseDown?: (coordinates: ICellCoordinates, mouseClickButton: MouseClickButtons) => void;
  onMouseEnter?: (coordinates: ICellCoordinates) => void;
  onMouseUp?: () => void;
  onContextMenu?: (selectionContext: ISelectionContext) => void;
  /**
   * Optional React component used to render a toggle button
   * for opening/closing subRows inside this cell.
   * defult = DefaultSubRowsToggleButtonComponent
   */
  SubRowsToggleButtonComponent?: React.ComponentType<SubRowsToggleButtonComponentProps>;
  /**
   * Indicates whether this cell is part of a sub-row
   * (i.e., a child row or nested row within another).
   */
  isSubCell?: boolean;
  /** Grid semantics: `gridcell` role, focusable cell, Enter/Space toggles the sub-rows */
  isGridCell?: boolean;
}

const DEFAULT_TAG: CellTag = "td";
const DEFAULT_STYLE: React.CSSProperties = { height: DEFAULT_ROW_HEIGHT, width: DEFAULT_COLUMN_WIDTH };

const DefaultSubRowsToggleButtonComponent = ({ opened, onClick, tabIndex }: SubRowsToggleButtonComponentProps) => {
  return (
    <IconButton
      className="table-cell-sub-item-toggle"
      data-testid="table-cell-sub-item-toggle"
      onClick={onClick}
      size="large"
      tabIndex={tabIndex}
      aria-expanded={!!opened}
      aria-label={opened ? "Collapse sub-rows" : "Expand sub-rows"}
    >
      <Icon>{opened ? "arrow_drop_down" : "arrow_right"}</Icon>
    </IconButton>
  );
};

/**
 * Roving tabIndex: grid cells are focusable by program but never in the tab order, the
 * grid container takes the Tab stop and hands the focus over to the active cell.
 */
function getGridCellProps(
  isHeader: boolean,
  rowIndex: number,
  columnIndex: number,
  isSelected: boolean,
  hasSubItems: boolean,
  opened?: boolean,
) {
  return {
    role: isHeader ? "columnheader" : "gridcell",
    tabIndex: -1,
    "aria-selected": isSelected ? true : undefined,
    "aria-expanded": hasSubItems ? !!opened : undefined,
    "data-cell-row": rowIndex,
    "data-cell-col": columnIndex,
  };
}

interface ICellStyles {
  column: React.CSSProperties;
  wrapper: React.CSSProperties;
  container?: React.CSSProperties;
  text?: React.CSSProperties;
}

const toLength = (value: string | number) => (typeof value === "number" ? `${value}px` : value);

/**
 * Padding of the cell: none, but the end padding the last column gets to fill the table.
 * One shorthand and no `paddingRight` next to it: React cannot remove a longhand safely while
 * the shorthand stays, the cell would fall back to the padding of the stylesheet.
 */
function getPaddingStyle({ padding, paddingRight }: React.CSSProperties): React.CSSProperties {
  if (padding !== undefined) return paddingRight === undefined ? { padding } : { padding, paddingRight };
  return { padding: paddingRight ? `0 ${toLength(paddingRight)} 0 0` : 0 };
}

function computeStyles(style: React.CSSProperties, hasCellContent: boolean, colspan: number): ICellStyles {
  const { height, width, padding, paddingRight, ...rest } = style;
  const cellHeight = (height as number) || DEFAULT_ROW_HEIGHT;
  const numericWidth = Number(width);
  const cellWidth = numericWidth ? numericWidth * colspan : (width as number) || (DEFAULT_COLUMN_WIDTH as never);
  return {
    column: { ...getPaddingStyle({ padding, paddingRight }), ...rest, height: cellHeight, width: cellWidth },
    wrapper: { width: cellWidth, height: cellHeight },
    container: style.justifyContent ? { justifyContent: style.justifyContent } : undefined,
    text: hasCellContent ? undefined : { lineHeight: `${cellHeight}px`, height: cellHeight },
  };
}

const stylesCache = new WeakMap<React.CSSProperties, Map<number, ICellStyles>>();

/**
 * The rows give the same `style` object to the cells of a column: their styles are computed
 * once, and React finds the same objects from one render to the next.
 */
function getStyles(style: React.CSSProperties, hasCellContent: boolean, colspan: number): ICellStyles {
  let variants = stylesCache.get(style);
  if (!variants) {
    variants = new Map();
    stylesCache.set(style, variants);
  }
  const variant = colspan * 2 + (hasCellContent ? 1 : 0);
  let styles = variants.get(variant);
  if (!styles) {
    styles = computeStyles(style, hasCellContent, colspan);
    variants.set(variant, styles);
  }
  return styles;
}

interface ICellHandlers {
  open: () => void;
  mouseDown: (event: React.MouseEvent<HTMLElement>) => void;
  mouseEnter: () => void;
  mouseUp: () => void;
  contextMenu: (event: React.MouseEvent<HTMLElement>) => void;
  keyDown: (event: React.KeyboardEvent<HTMLElement>) => void;
}

interface ICellMemory {
  props: ICellProps;
  handlers?: ICellHandlers;
}

const getCoordinates = ({ rowIndex, index = 0 }: ICellProps): ICellCoordinates => ({ rowIndex, cellIndex: index });

const canToggle = ({ subItems, hideSubItemsOpener }: ICellProps) => !hideSubItemsOpener && !!subItems && subItems.length > 0;

/** Handlers of a cell, created once: they read the props of its last render. */
function createCellHandlers(memory: ICellMemory): ICellHandlers {
  return {
    open: () => memory.props.onCallOpen?.(memory.props.index ?? 0),
    mouseDown: (event) => memory.props.onMouseDown?.(getCoordinates(memory.props), getMouseClickButton(event.nativeEvent.button)),
    mouseEnter: () => memory.props.onMouseEnter?.(getCoordinates(memory.props)),
    mouseUp: () => memory.props.onMouseUp?.(),
    contextMenu: (event) => {
      const { onContextMenu } = memory.props;
      if (!onContextMenu) return;
      event.preventDefault();
      // the wrapper of the content is the only child of the cell
      onContextMenu({ anchorEl: event.currentTarget.firstElementChild, contextCell: getCoordinates(memory.props) });
    },
    // Enter or Space on a focused cell opens its sub rows, like a click on its toggle
    keyDown: (event) => {
      if (event.target !== event.currentTarget || !canToggle(memory.props)) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        memory.props.onCallOpen?.(memory.props.index ?? 0);
      }
    },
  };
}

/**
 * Handlers of the cell, if it needs any: most cells of a table without selection need none,
 * and nothing is allocated for them when they mount at every scroll step.
 */
function useCellHandlers(props: ICellProps, isInteractive: boolean): ICellHandlers | undefined {
  const memoryRef = React.useRef<ICellMemory | null>(null);
  if (!isInteractive) return undefined;
  if (!memoryRef.current) memoryRef.current = { props };
  const memory = memoryRef.current;
  memory.props = props;
  if (!memory.handlers) memory.handlers = createCellHandlers(memory);
  return memory.handlers;
}

function CellComponent(props: ICellProps): JSX.Element {
  const {
    id,
    index = 0,
    rowIndex,
    relativeRowIndex,
    loading,
    getClassName,
    className,
    component = DEFAULT_TAG,
    value,
    opened,
    subItems,
    cellContent: CellContent,
    cellContentProps,
    dataCoordinates,
    style = DEFAULT_STYLE,
    colspan = DEFAULT_COLSPAN,
    isSelectable = true,
    isSelected,
    isSubCell,
    isGridCell = false,
    SubRowsToggleButtonComponent = DefaultSubRowsToggleButtonComponent,
    onMouseDown,
    onMouseEnter,
    onMouseUp,
    onContextMenu,
  } = props;
  const canToggleSubItems = canToggle(props);
  const isInteractive = !!(onMouseDown || onMouseEnter || onMouseUp || onContextMenu || canToggleSubItems || isGridCell);
  const handlers = useCellHandlers(props, isInteractive);

  const styles = getStyles(style, Boolean(CellContent), colspan);
  const Component = component;
  const dynamicClassName = getClassName ? getClassName(props) : className;

  const isHeader = component === "th";
  const hasSubItems = !!subItems && subItems.length > 0;

  return (
    <Component
      colSpan={colspan}
      // 1-based, in the whole table and not in the visible window; the row carries `aria-rowindex`
      aria-colindex={index + 1}
      aria-colspan={colspan > 1 ? colspan : undefined}
      {...(isGridCell ? getGridCellProps(isHeader, rowIndex, index, isSelectable && !!isSelected, hasSubItems, opened) : null)}
      data-testid="table-column"
      className={classNames("table-column", dynamicClassName, {
        selected: isSelected && isSelectable,
        "table-sub-cell": isSubCell,
      })}
      onMouseDown={onMouseDown && handlers?.mouseDown}
      onMouseEnter={onMouseEnter && handlers?.mouseEnter}
      onMouseUp={onMouseUp && handlers?.mouseUp}
      onContextMenu={onContextMenu && handlers?.contextMenu}
      onKeyDown={isGridCell ? handlers?.keyDown : undefined}
      style={styles.column}
    >
      <div data-testid={`table-cell-wrapper-${id}`} className="table-overflow-wrapper" style={styles.wrapper}>
        <div
          className={canToggleSubItems ? "table-cell-container table-cell-container__with-toggle" : "table-cell-container"}
          style={styles.container}
        >
          {canToggleSubItems && handlers ? (
            <SubRowsToggleButtonComponent onClick={handlers.open} opened={opened} tabIndex={isGridCell ? -1 : undefined} />
          ) : null}
          {CellContent ? (
            <CellContent
              key={id}
              value={value}
              {...cellContentProps}
              id={id}
              index={index}
              rowIndex={rowIndex}
              relativeRowIndex={relativeRowIndex}
              isSelected={isSelected}
              dataCoordinates={dataCoordinates}
              loading={loading}
            />
          ) : (
            <div style={styles.text} className="cell-value" title={value || ""}>
              {loading ? (
                <div className="cell-skeleton-container" style={styles.text}>
                  <Skeleton variant="rectangular" width={30} height={15} />
                </div>
              ) : (
                value
              )}
            </div>
          )}
        </div>
      </div>
    </Component>
  );
}

const NO_STYLE: React.CSSProperties = {};
const hasOwn = Object.prototype.hasOwnProperty;

/**
 * Same props, `style` being compared one level deep (it is rebuilt at every render of the
 * row). Written without any allocation: it runs for every cell of every row that renders.
 */
function arePropsEqual(prev: ICellProps, next: ICellProps): boolean {
  const keys = Object.keys(prev) as (keyof ICellProps)[];
  if (keys.length !== Object.keys(next).length) return false;
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (!hasOwn.call(next, key)) return false;
    if (Object.is(prev[key], next[key])) continue;
    if (key !== "style" || !shallowEqual(prev.style ?? NO_STYLE, next.style ?? NO_STYLE)) return false;
  }
  return true;
}

const Cell = React.memo(CellComponent, arePropsEqual);
Cell.displayName = "Cell";

export default Cell;
