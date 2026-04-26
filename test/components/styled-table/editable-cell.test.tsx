import * as React from "react";
import { fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import EdiTableCell, { KEYCODE_ENTER, IEdiTableCellProps, IMask } from "../../../src/components/styled-table/editable-cell";
import { customRender, screen } from "../../tests-utils/react-testing-library-utils";
import { Nullable } from "../../../src/components/typing";

const mask: IMask = { decimals: 2, is_percentage: false, is_negative: false };

const formatValue = (value: Nullable<number>, m?: IMask) => {
  if (value === null || value === undefined) return "-";
  return new Intl.NumberFormat("en-US", {
    style: m?.is_percentage ? "percent" : undefined,
    maximumFractionDigits: m?.decimals ?? 2,
    minimumFractionDigits: m?.decimals ?? 2,
  }).format(value);
};

function renderCell(overrides: Partial<IEdiTableCellProps> = {}) {
  const onConfirmValue = jest.fn();
  const props: IEdiTableCellProps = {
    isEdited: false,
    value: 0,
    initial_value: 0,
    mask,
    onConfirmValue,
    formatValue,
    ...overrides,
  };
  customRender(<EdiTableCell {...props} />);
  return { onConfirmValue, props };
}

describe("EdiTableCell", () => {
  it("renders the formatted value when not focused", () => {
    renderCell({ value: 22 });
    expect(screen.getByTestId("editable-cell")).toHaveTextContent("22.00");
  });

  it("renders '-' for a null value", () => {
    renderCell({ value: null, initial_value: null });
    expect(screen.getByTestId("editable-cell")).toHaveTextContent("-");
  });

  it("scales percentage values to a 0–100 representation", () => {
    renderCell({ value: 1, initial_value: 1, mask: { ...mask, is_percentage: true } });
    expect(screen.getByTestId("editable-cell")).toHaveTextContent("100.00%");
  });

  it("flags edited values with the edited classname", () => {
    renderCell({ value: 50, isEdited: true });
    expect(screen.getByTestId("editable-cell").querySelector(".edited-cell")).not.toBeNull();
  });

  it("does not become editable when isDisabled", () => {
    renderCell({ isDisabled: true });
    fireEvent.click(screen.getByTestId("editable-cell"));
    expect(screen.queryByTestId("editable-cell-text-field")).toBeNull();
  });

  it("focuses the input when the cell is clicked", async () => {
    renderCell({ value: 0 });
    fireEvent.click(screen.getByTestId("editable-cell"));
    expect(screen.getByTestId("editable-cell-text-field")).toBeInTheDocument();
  });

  it("calls onConfirmValue with the typed number on Enter", async () => {
    const user = userEvent.setup();
    const { onConfirmValue } = renderCell({ value: 0 });
    await user.click(screen.getByTestId("editable-cell"));
    const input = screen.getByTestId("editable-cell-text-field").querySelector("input")!;
    await user.clear(input);
    await user.type(input, "22");
    fireEvent.keyPress(input, { keyCode: KEYCODE_ENTER, which: KEYCODE_ENTER, key: "Enter" });
    expect(onConfirmValue).toHaveBeenCalledWith(22);
  });

  it("scales typed percentage value to a 0–1 number on Enter", async () => {
    const user = userEvent.setup();
    const { onConfirmValue } = renderCell({ mask: { ...mask, is_percentage: true } });
    await user.click(screen.getByTestId("editable-cell"));
    const input = screen.getByTestId("editable-cell-text-field").querySelector("input")!;
    await user.clear(input);
    await user.type(input, "22");
    fireEvent.keyPress(input, { keyCode: KEYCODE_ENTER, which: KEYCODE_ENTER, key: "Enter" });
    expect(onConfirmValue).toHaveBeenCalledWith(0.22);
  });

  it("falls back to initial_value when the input is cleared (initial=null → null)", async () => {
    const user = userEvent.setup();
    const { onConfirmValue } = renderCell({ value: 22, initial_value: null });
    await user.click(screen.getByTestId("editable-cell"));
    const input = screen.getByTestId("editable-cell-text-field").querySelector("input")!;
    await user.clear(input);
    fireEvent.keyPress(input, { keyCode: KEYCODE_ENTER, which: KEYCODE_ENTER, key: "Enter" });
    expect(onConfirmValue).toHaveBeenCalledWith(null);
  });

  it("falls back to 0 when the input is cleared but initial_value is non-null", async () => {
    const user = userEvent.setup();
    const { onConfirmValue } = renderCell({ value: 22, initial_value: 22 });
    await user.click(screen.getByTestId("editable-cell"));
    const input = screen.getByTestId("editable-cell-text-field").querySelector("input")!;
    await user.clear(input);
    fireEvent.keyPress(input, { keyCode: KEYCODE_ENTER, which: KEYCODE_ENTER, key: "Enter" });
    expect(onConfirmValue).toHaveBeenCalledWith(0);
  });

  it("does not call onConfirmValue when the value did not change", async () => {
    const user = userEvent.setup();
    const { onConfirmValue } = renderCell({ value: 22, initial_value: 30, isEdited: true });
    await user.click(screen.getByTestId("editable-cell"));
    const input = screen.getByTestId("editable-cell-text-field").querySelector("input")!;
    fireEvent.keyPress(input, { keyCode: KEYCODE_ENTER, which: KEYCODE_ENTER, key: "Enter" });
    expect(onConfirmValue).not.toHaveBeenCalled();
  });

  it("does not call onConfirmValue on a non-Enter keypress", async () => {
    const user = userEvent.setup();
    const { onConfirmValue } = renderCell({ value: 0 });
    await user.click(screen.getByTestId("editable-cell"));
    const input = screen.getByTestId("editable-cell-text-field").querySelector("input")!;
    await user.type(input, "22");
    fireEvent.keyPress(input, { keyCode: 14, which: 14, key: "X" });
    expect(onConfirmValue).not.toHaveBeenCalled();
  });
});
