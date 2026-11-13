import * as React from "react";

import { MouseClickButtons } from "../constants";
import { ICellCoordinates } from "../table/cell";
import ContextMenuHandler, { ISelectionContext } from "./context-menu-handler";
import { Nullable } from "../typing";

export interface ISelectedCells {
  [rowIndex: string]: number[];
}

export interface ISelection {
  onCellMouseDown?: (coordinates: ICellCoordinates, mouseClickButton: MouseClickButtons) => void;
  onCellMouseEnter?: (coordinates: ICellCoordinates) => void;
  onCellMouseUp?: () => void;
  onCellContextMenu?: (selectionContext: ISelectionContext) => void;
  selectedCells: ISelectedCells;
}

export interface ISelectionHandlerOptionalProps {
  isDisabledVerticalSelection?: boolean;
  isDisabledHorizontalSelection?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  menuComponent?: React.ComponentType<any>;
}

export interface ISelectionHandlerProps extends ISelectionHandlerOptionalProps {
  children: (props: ISelection) => JSX.Element;
}

const EMPTY: ISelectedCells = {};

const SelectionHandler: React.FC<ISelectionHandlerProps> = ({
  children,
  menuComponent,
  isDisabledVerticalSelection,
  isDisabledHorizontalSelection,
}) => {
  const [selectedCells, setSelectedCells] = React.useState<ISelectedCells>(EMPTY);
  const startingCellRef = React.useRef<Nullable<ICellCoordinates>>(null);

  const onCellMouseDown = React.useCallback((coordinates: ICellCoordinates, mouseClickButton: MouseClickButtons) => {
    const isRightClick = mouseClickButton === MouseClickButtons.right;
    const isLeftClick = mouseClickButton === MouseClickButtons.left;

    setSelectedCells((current) => {
      const currentRow = current[coordinates.rowIndex];
      const isAlreadySelected = currentRow && currentRow.includes(coordinates.cellIndex);
      if (isLeftClick || (!isAlreadySelected && isRightClick)) {
        startingCellRef.current = coordinates;
        return { [coordinates.rowIndex]: [coordinates.cellIndex] };
      }
      return current;
    });
  }, []);

  const onCellMouseEnter = React.useCallback(
    (coordinates: ICellCoordinates) => {
      const start = startingCellRef.current;
      if (!start) return;

      const rowStart = isDisabledVerticalSelection ? start.rowIndex : Math.min(start.rowIndex, coordinates.rowIndex);
      const rowEnd = isDisabledVerticalSelection ? start.rowIndex : Math.max(start.rowIndex, coordinates.rowIndex);
      const colStart = isDisabledHorizontalSelection ? start.cellIndex : Math.min(start.cellIndex, coordinates.cellIndex);
      const colEnd = isDisabledHorizontalSelection ? start.cellIndex : Math.max(start.cellIndex, coordinates.cellIndex);

      const next: ISelectedCells = {};
      for (let r = rowStart; r <= rowEnd; r += 1) {
        next[r] = [];
        for (let c = colStart; c <= colEnd; c += 1) {
          next[r].push(c);
        }
      }
      setSelectedCells(next);
    },
    [isDisabledVerticalSelection, isDisabledHorizontalSelection],
  );

  const onCellMouseUp = React.useCallback(() => {
    startingCellRef.current = null;
  }, []);

  return (
    <div className="selection-handler-container">
      <ContextMenuHandler selectedCells={selectedCells} menuComponent={menuComponent}>
        {({ onContextMenu }) =>
          children({
            onCellMouseDown,
            onCellMouseEnter,
            onCellMouseUp,
            onCellContextMenu: onContextMenu,
            selectedCells,
          })
        }
      </ContextMenuHandler>
    </div>
  );
};

export default SelectionHandler;
