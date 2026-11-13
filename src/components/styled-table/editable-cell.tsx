import * as React from "react";
import TextField from "@mui/material/TextField";
import { NumericFormat, NumberFormatValues } from "react-number-format";
import classnames from "classnames";

import { IContentCellProps } from "../table/cell";
import { Nullable } from "../typing";
import { getStringNumberWithoutTrailingZeros } from "../utils/common";

export const EDITED_CELL_CLASSNAME = "edited-cell";
export const KEYCODE_ENTER = 13;
const MIN_INPUT_WIDTH = 20;

export interface IMask {
  decimals: number;
  is_percentage: boolean;
  is_negative: boolean;
}

export interface IEdiTableCellProps extends IContentCellProps {
  isEdited: boolean;
  /**
   * Required to differentiate the case where the input is set to "0" and the case
   * where the input has not been set yet (value is `null`). When the input is cleared,
   * the value falls back to `initial_value`.
   */
  initial_value: Nullable<number>;
  value: Nullable<number>;
  mask: IMask;
  isDisabled?: boolean;
  formatValue: (value: Nullable<number>, mask?: IMask) => string;
  onConfirmValue: (value: Nullable<number>) => void;
  validateValue?: (value: Nullable<number>) => boolean;
}

function toInputString(value: Nullable<number>, mask: IMask): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "";
  const scaled = mask.is_percentage ? value * 100 : value;
  return getStringNumberWithoutTrailingZeros(scaled, mask.decimals);
}

function fromInput(inputValue: string, mask: IMask): Nullable<number> {
  const parsed = parseFloat(inputValue);
  let next: Nullable<number> = Number.isNaN(parsed) ? null : parsed;
  if (mask.is_percentage && next !== null) next /= 100;
  return next;
}

const EdiTableCell: React.FC<IEdiTableCellProps> = ({
  isEdited,
  initial_value,
  value,
  mask,
  isDisabled,
  formatValue,
  onConfirmValue,
  validateValue,
}) => {
  const [inputValue, setInputValue] = React.useState<string>(() => toInputString(value, mask));
  const [isFocused, setIsFocused] = React.useState(false);
  const [isValidValue, setIsValidValue] = React.useState<boolean>(() =>
    validateValue && value != null && !Number.isNaN(value) ? validateValue(value) : true,
  );

  const checkValidValue = React.useCallback(
    (next: Nullable<number> | undefined) => {
      const isNumber = next != null && !Number.isNaN(next);
      return validateValue && isNumber ? validateValue(next as number) : true;
    },
    [validateValue],
  );

  const computeNewValue = React.useCallback((): [boolean, Nullable<number>] => {
    let next = fromInput(inputValue, mask);
    if (next !== value) {
      const isCleared = inputValue === "";
      if (isCleared) next = initial_value === null ? null : 0;
      return [true, next];
    }
    return [false, next];
  }, [inputValue, mask, value, initial_value]);

  // Confirm pending value if the cell unmounts while focused.
  const stateRef = React.useRef({ isFocused, computeNewValue, onConfirmValue });
  stateRef.current = { isFocused, computeNewValue, onConfirmValue };
  React.useEffect(
    () => () => {
      const { isFocused: wasFocused, computeNewValue: latest, onConfirmValue: confirm } = stateRef.current;
      if (wasFocused) {
        const [hasChanged, newValue] = latest();
        if (hasChanged) confirm(newValue);
      }
    },
    [],
  );

  const focus = React.useCallback(() => {
    setIsFocused(true);
    setInputValue(toInputString(value, mask));
    setIsValidValue(checkValidValue(value));
  }, [value, mask, checkValidValue]);

  const handleChange = React.useCallback((values: NumberFormatValues) => {
    setInputValue(values.value);
  }, []);

  const handleAllowed = React.useCallback(
    (values: NumberFormatValues) => {
      const valid = checkValidValue(values.floatValue ?? null);
      setIsValidValue((prev) => (prev !== valid ? valid : prev));
      return valid;
    },
    [checkValidValue],
  );

  const blur = React.useCallback(() => {
    const [hasChanged, newValue] = computeNewValue();
    if (hasChanged) {
      setInputValue("");
      onConfirmValue(newValue);
    }
    setIsFocused(false);
  }, [computeNewValue, onConfirmValue]);

  const handleKeyPress = React.useCallback(
    (event: React.KeyboardEvent) => {
      if (event.which === KEYCODE_ENTER || event.keyCode === KEYCODE_ENTER) blur();
    },
    [blur],
  );

  const selectInputValue = React.useCallback((event: React.FocusEvent<HTMLInputElement>) => {
    event.currentTarget.select();
  }, []);

  const trimmedLength = inputValue !== "" ? inputValue.trim().length * 10 : MIN_INPUT_WIDTH;
  const inputValueWidth = trimmedLength < MIN_INPUT_WIDTH ? MIN_INPUT_WIDTH : trimmedLength;
  const formattedValue = formatValue(value, mask);

  return (
    <div
      className={classnames("editable-cell", {
        empty: !isFocused && value === null,
        error: !isValidValue,
      })}
      data-testid="editable-cell"
      onClick={!isDisabled && !isFocused ? focus : undefined}
    >
      {!isDisabled && isFocused ? (
        <NumericFormat
          autoFocus
          data-testid="editable-cell-text-field"
          customInput={TextField}
          variant="standard"
          defaultValue={inputValue}
          onValueChange={handleChange}
          onBlur={blur}
          onKeyPress={handleKeyPress}
          thousandSeparator=" "
          decimalSeparator=","
          style={{ width: inputValueWidth }}
          // Standard variant exposes `underline` on its classes; the union TextField type doesn't, so cast.
          InputProps={
            {
              classes: { underline: "editable-cell__underline" },
              onFocus: selectInputValue,
            } as React.ComponentProps<typeof TextField>["InputProps"]
          }
          valueIsNumericString
          decimalScale={mask.decimals}
          allowNegative={mask.is_negative}
          isAllowed={handleAllowed}
        />
      ) : (
        <div className={classnames("editable-cell__value", { [EDITED_CELL_CLASSNAME]: isEdited })} title={formattedValue}>
          <span className="text">{formattedValue}</span>
        </div>
      )}
    </div>
  );
};

export default EdiTableCell;
