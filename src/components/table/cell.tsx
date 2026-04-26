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
}

type CellTag = "td" | "th";

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
}

const DEFAULT_TAG: CellTag = "td";
const DEFAULT_STYLE: React.CSSProperties = { height: DEFAULT_ROW_HEIGHT, width: DEFAULT_COLUMN_WIDTH };

function computeStyles(style: React.CSSProperties, hasCellContent: boolean, colspan: number) {
  const { height, width, ...rest } = style;
  const cellHeight = (height as number) || DEFAULT_ROW_HEIGHT;
  const numericWidth = Number(width);
  const cellWidth = numericWidth ? numericWidth * colspan : (width as number) || (DEFAULT_COLUMN_WIDTH as never);
  return {
    column: { padding: 0, ...rest, height: cellHeight, width: cellWidth } as React.CSSProperties,
    wrapper: { width: cellWidth, height: cellHeight } as React.CSSProperties,
    text: hasCellContent ? undefined : ({ lineHeight: `${cellHeight}px`, height: cellHeight } as React.CSSProperties),
  };
}

function CellComponent({
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
  hideSubItemsOpener,
  cellContent: CellContent,
  cellContentProps,
  dataCoordinates,
  style = DEFAULT_STYLE,
  colspan = DEFAULT_COLSPAN,
  isSelectable = true,
  isSelected,
  onCallOpen,
  onMouseDown,
  onMouseEnter,
  onMouseUp,
  onContextMenu,
}: ICellProps): JSX.Element {
  const wrapperRef = React.useRef<HTMLDivElement | null>(null);

  const handleOpen = React.useCallback(() => {
    onCallOpen?.(index);
  }, [onCallOpen, index]);

  const handleMouseDown = React.useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      if (!onMouseDown) return;
      onMouseDown({ rowIndex, cellIndex: index }, getMouseClickButton(event.nativeEvent.button));
    },
    [onMouseDown, rowIndex, index],
  );

  const handleMouseEnter = React.useCallback(() => {
    onMouseEnter?.({ rowIndex, cellIndex: index });
  }, [onMouseEnter, rowIndex, index]);

  const handleMouseUp = React.useCallback(() => {
    onMouseUp?.();
  }, [onMouseUp]);

  const handleContextMenu = React.useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      if (!onContextMenu) return;
      event.preventDefault();
      onContextMenu({
        anchorEl: wrapperRef.current,
        contextCell: { rowIndex, cellIndex: index },
      });
    },
    [onContextMenu, rowIndex, index],
  );

  // Keyboard activation: Enter/Space on a cell with sub-items toggles its expand state,
  // mirroring what clicking the chevron icon does. Lets keyboard-only users open trees
  // without ever reaching the (visually obscured) `<IconButton>` inside the cell.
  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      if (event.target !== event.currentTarget) return;
      if (!subItems || subItems.length === 0 || hideSubItemsOpener) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onCallOpen?.(index);
      }
    },
    [subItems, hideSubItemsOpener, onCallOpen, index],
  );

  const styles = computeStyles(style, Boolean(CellContent), colspan);
  const Component = component;
  const dynamicClassName = getClassName
    ? getClassName({ id, className, value, colspan, dataCoordinates, style, component })
    : className;
  const canToggleSubItems = !hideSubItemsOpener && !!subItems && subItems.length > 0;
  const justifyContent = style?.justifyContent;

  const isHeader = component === "th";
  const hasSubItems = !!subItems && subItems.length > 0;

  return (
    <Component
      key={`cell-${id}`}
      colSpan={colspan}
      role={isHeader ? "columnheader" : "gridcell"}
      // 1-based for ARIA; covers the FULL grid (not just visible window) so screen
      // readers announce "row N of total" correctly under virtualization.
      aria-rowindex={rowIndex + 1}
      aria-colindex={index + 1}
      aria-colspan={colspan > 1 ? colspan : undefined}
      aria-selected={isSelectable && isSelected ? true : undefined}
      aria-expanded={hasSubItems ? !!opened : undefined}
      // Roving tabIndex: cells are programmatically focusable but never in the tab
      // order. The grid container takes Tab focus and delegates to the active cell.
      tabIndex={-1}
      data-cell-row={rowIndex}
      data-cell-col={index}
      data-testid="table-column"
      className={classNames("table-column", dynamicClassName, { selected: isSelected && isSelectable })}
      onMouseDown={handleMouseDown}
      onMouseEnter={handleMouseEnter}
      onMouseUp={handleMouseUp}
      onContextMenu={handleContextMenu}
      onKeyDown={handleKeyDown}
      style={styles.column}
    >
      <div data-testid={`table-cell-wrapper-${id}`} ref={wrapperRef} className="table-overflow-wrapper" style={styles.wrapper}>
        <div className="table-cell-container" style={{ justifyContent }}>
          {canToggleSubItems ? (
            <IconButton
              className="table-cell-sub-item-toggle"
              data-testid="table-cell-sub-item-toggle"
              onClick={handleOpen}
              size="large"
              // Roving tabIndex: the cell itself owns focus, and Enter/Space on the cell
              // triggers `handleKeyDown` → `onCallOpen`. The button stays clickable for
              // mouse users but is removed from the tab sequence to keep the grid a
              // single tab stop. We deliberately don't `aria-hidden` it: the cell already
              // exposes `aria-expanded`, and `aria-hidden` on focusable content is an axe
              // rule violation.
              tabIndex={-1}
              aria-label={opened ? "Collapse sub-rows" : "Expand sub-rows"}
            >
              <Icon>{opened ? "keyboard_arrow_down" : "keyboard_arrow_right"}</Icon>
            </IconButton>
          ) : null}
          {CellContent ? (
            <CellContent
              key={`cell-${id}-cellContent`}
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

/**
 * Custom equality: most props are compared shallowly. `style` gets a one-level shallow
 * compare too — CSS property objects are flat by nature, and a shallow check on the ~6
 * properties used here is roughly 20× faster than `lodash.isEqual`.
 */
function arePropsEqual(prev: ICellProps, next: ICellProps): boolean {
  if (!shallowEqual(prev.style ?? {}, next.style ?? {})) return false;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { style: _ps, ...prevRest } = prev;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { style: _ns, ...nextRest } = next;
  return shallowEqual(prevRest, nextRest);
}

const Cell = React.memo(CellComponent, arePropsEqual);
Cell.displayName = "Cell";

export default Cell;
