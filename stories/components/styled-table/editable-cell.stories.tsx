import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { action } from "@storybook/addon-actions";

import { withThemeProvider } from "../../utils/decorators";
import EditableCell, { IMask } from "../../../src/components/styled-table/editable-cell";
import Table from "../../../src/components/table/table";
import { IContentCellProps } from "../../../src/components/table/cell";
import { getTable } from "./tables";
import { Nullable } from "../../../src/components/typing";

interface IEditableCellParentProps extends IContentCellProps {
  defaultValue: Nullable<number>;
  alreadyEdited?: boolean;
  maxValue?: number;
  isDisabled?: boolean;
}

const mask: IMask = {
  is_percentage: false,
  is_negative: true,
  decimals: 2,
};

export function formatValue(value: Nullable<number>, valueMask?: IMask): string {
  if (valueMask && (value === null || value === undefined)) {
    return "-";
  }
  const decimals = valueMask?.decimals ?? 2;
  return new Intl.NumberFormat("fr-FR", {
    style: valueMask?.is_percentage ? "percent" : undefined,
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  }).format(value as number);
}

const EditableCellParent: React.FC<IEditableCellParentProps> = ({ defaultValue, alreadyEdited, maxValue, isDisabled }) => {
  const [isEdited, setIsEdited] = React.useState<boolean>(alreadyEdited ?? false);
  const [value, setValue] = React.useState<Nullable<number>>(defaultValue);

  const handleOnConfirmValue = (nextValue: Nullable<number>) => {
    action("onConfirmValue")(nextValue);
    setValue(nextValue);
    setIsEdited(defaultValue !== nextValue);
  };

  return (
    <EditableCell
      isEdited={isEdited}
      initial_value={defaultValue}
      value={value}
      mask={mask}
      formatValue={formatValue}
      validateValue={maxValue ? (next: Nullable<number>) => (next ? next <= maxValue : false) : undefined}
      onConfirmValue={handleOnConfirmValue}
      isDisabled={isDisabled}
    />
  );
};

const integratedProps = getTable({
  1: {
    1: {
      cellContent: EditableCellParent,
      cellContentProps: {
        defaultValue: null,
      },
    },
  },
});

const meta: Meta<typeof EditableCellParent> = {
  title: "Styled Table/editable cell",
  component: EditableCellParent,
  decorators: [withThemeProvider],
  tags: ["autodocs"],
};

export default meta;

type Story = StoryObj<typeof EditableCellParent>;

export const Default: Story = {
  args: { defaultValue: 0 },
  render: (args) => (
    <div style={{ padding: 10 }}>
      <EditableCellParent {...args} />
    </div>
  ),
};

export const Edited: Story = {
  args: { defaultValue: 123.45, alreadyEdited: true },
  render: (args) => (
    <div style={{ padding: 10 }}>
      <EditableCellParent {...args} />
    </div>
  ),
};

export const Disabled: Story = {
  args: { defaultValue: 123.45, alreadyEdited: true, isDisabled: true },
  render: (args) => (
    <div style={{ padding: 10 }}>
      <EditableCellParent {...args} />
    </div>
  ),
};

export const ErrorWithInvalidValue: Story = {
  args: { defaultValue: 10, maxValue: 10 },
  render: (args) => (
    <div style={{ padding: 10 }}>
      <EditableCellParent {...args} />
    </div>
  ),
};

interface IIntegratedArgs {
  height: number;
  width: number;
  fixedRows: number[];
  fixedColumns: number[];
}

export const Integrated: StoryObj<IIntegratedArgs> = {
  args: { height: 500, width: 1000, fixedRows: [0], fixedColumns: [0] },
  argTypes: {
    height: { control: { type: "number" } },
    width: { control: { type: "number" } },
    fixedRows: { control: { type: "object" } },
    fixedColumns: { control: { type: "object" } },
  },
  render: ({ height, width, fixedRows, fixedColumns }) => (
    <Table
      {...integratedProps}
      columns={{ 0: { style: { justifyContent: "left" } } }}
      isVirtualized
      isSelectable={false}
      virtualizerProps={{
        fixedRows,
        fixedColumns,
        height,
        width,
        rowsCount: 5,
        columnsCount: 6,
      }}
    />
  ),
};
