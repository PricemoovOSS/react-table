import type { Meta, StoryObj } from "@storybook/react-vite";

import Table from "../../../src/components/table/table";
import { generateTable } from "../../utils/tables";

interface IThemeArgs {
  elevationColor: string;
  elevationSize: number;
  elevationStartColumnShadow: string;
  elevationStartRowShadow: string;
  elevationEndRowShadow: string;
  rowSeparatorColor: string;
  columnSeparatorColor: string;
  fixedBackground: string;
  selectedBackground: string;
  headerColor: string;
  focusRingColor: string;
  subRowConnectorColor: string;
}

const meta: Meta<IThemeArgs> = {
  title: "Table/Theming",
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: `
The look of the table is driven by CSS custom properties. Set them on the table or on any element
around it; a property that is not set keeps its default value.

| Property | Default | Role |
| --- | --- | --- |
| \`--rt-elevation-color\` | \`rgba(0, 0, 0, 0.12)\` | Relief of the columns fixed on the right, and of the fixed columns on the group rows |
| \`--rt-elevation-size\` | \`6px\` | Width of that relief |
| \`--rt-elevation-start-column-shadow\` | \`0 0 7px 2px rgba(0, 0, 0, 0.5)\` | Relief of the columns fixed on the left |
| \`--rt-elevation-start-row-shadow\` | \`0 7px 7px -10px rgba(0, 0, 0, 0.5)\` | Relief under the rows fixed at the top |
| \`--rt-elevation-end-row-shadow\` | \`0 -2px 7px -6px rgba(0, 0, 0, 0.5)\` | Relief above the rows fixed at the bottom |
| \`--rt-row-separator-color\` | \`rgba(236, 236, 236, 0.5)\` | Line between two rows |
| \`--rt-column-separator-color\` | \`transparent\` | Line between two columns (none by default) |
| \`--rt-fixed-background\` | \`#fff\` | Background of the columns fixed on the right and of the rows fixed at the bottom |
| \`--rt-selected-background\` | \`rgba(2, 171, 255, 0.1)\` | Background of a selected cell |
| \`--rt-header-color\` | \`rgba(0, 0, 0, 0.54)\` | Text of the header cells |
| \`--rt-focus-ring-color\` | \`#0082c3\` | Outline of the cell focused with the keyboard |
| \`--rt-sub-row-connector-color\` | \`#aaa\` | Lines that tie the sub rows to their parent |

Set a relief to \`none\` (shadows) or \`transparent\` (\`--rt-elevation-color\`) to remove it. Use the controls
below to try values.
        `,
      },
    },
  },
  argTypes: {
    elevationColor: { control: "color", name: "--rt-elevation-color" },
    elevationSize: { control: { type: "range", min: 0, max: 24, step: 1 }, name: "--rt-elevation-size (px)" },
    elevationStartColumnShadow: { control: "text", name: "--rt-elevation-start-column-shadow" },
    elevationStartRowShadow: { control: "text", name: "--rt-elevation-start-row-shadow" },
    elevationEndRowShadow: { control: "text", name: "--rt-elevation-end-row-shadow" },
    rowSeparatorColor: { control: "color", name: "--rt-row-separator-color" },
    columnSeparatorColor: { control: "color", name: "--rt-column-separator-color" },
    fixedBackground: { control: "color", name: "--rt-fixed-background" },
    selectedBackground: { control: "color", name: "--rt-selected-background" },
    headerColor: { control: "color", name: "--rt-header-color" },
    focusRingColor: { control: "color", name: "--rt-focus-ring-color" },
    subRowConnectorColor: { control: "color", name: "--rt-sub-row-connector-color" },
  },
};

export default meta;

const COLUMNS = 30;
const ROWS = 40;
const table = generateTable(ROWS, COLUMNS, {}, true);

const toStyle = (theme: IThemeArgs) =>
  ({
    "--rt-elevation-color": theme.elevationColor,
    "--rt-elevation-size": `${theme.elevationSize}px`,
    "--rt-elevation-start-column-shadow": theme.elevationStartColumnShadow,
    "--rt-elevation-start-row-shadow": theme.elevationStartRowShadow,
    "--rt-elevation-end-row-shadow": theme.elevationEndRowShadow,
    "--rt-row-separator-color": theme.rowSeparatorColor,
    "--rt-column-separator-color": theme.columnSeparatorColor,
    "--rt-fixed-background": theme.fixedBackground,
    "--rt-selected-background": theme.selectedBackground,
    "--rt-header-color": theme.headerColor,
    "--rt-focus-ring-color": theme.focusRingColor,
    "--rt-sub-row-connector-color": theme.subRowConnectorColor,
  }) as React.CSSProperties;

const defaults: IThemeArgs = {
  elevationColor: "rgba(0, 0, 0, 0.12)",
  elevationSize: 6,
  elevationStartColumnShadow: "0 0 7px 2px rgba(0, 0, 0, 0.5)",
  elevationStartRowShadow: "0 7px 7px -10px rgba(0, 0, 0, 0.5)",
  elevationEndRowShadow: "0 -2px 7px -6px rgba(0, 0, 0, 0.5)",
  rowSeparatorColor: "rgba(236, 236, 236, 0.5)",
  columnSeparatorColor: "transparent",
  fixedBackground: "#fff",
  selectedBackground: "rgba(2, 171, 255, 0.1)",
  headerColor: "rgba(0, 0, 0, 0.54)",
  focusRingColor: "#0082c3",
  subRowConnectorColor: "#aaa",
};

const render = (theme: IThemeArgs) => (
  <div style={toStyle(theme)}>
    <Table
      {...table}
      isVirtualized
      keyboardNavigation
      initialOpenedTrees={{ 2: { rowIndex: 2, columnIndex: 0 } }}
      virtualizerProps={{
        height: 460,
        width: 1000,
        minRowHeight: 40,
        fixedRows: [0, ROWS - 1],
        fixedColumns: [0, COLUMNS - 1],
      }}
    />
  </div>
);

export const Default: StoryObj<IThemeArgs> = {
  name: "Default theme",
  args: defaults,
  render,
};

export const WithSeparators: StoryObj<IThemeArgs> = {
  name: "Column separators, stronger reliefs",
  args: {
    ...defaults,
    columnSeparatorColor: "#e4e6e8",
    rowSeparatorColor: "#e4e6e8",
    elevationColor: "rgba(0, 0, 0, 0.3)",
    elevationSize: 10,
  },
  render,
};

export const Flat: StoryObj<IThemeArgs> = {
  name: "No relief",
  args: {
    ...defaults,
    elevationColor: "transparent",
    elevationStartColumnShadow: "none",
    elevationStartRowShadow: "none",
    elevationEndRowShadow: "none",
    columnSeparatorColor: "#e4e6e8",
  },
  render,
};

export const Dark: StoryObj<IThemeArgs> = {
  name: "Dark surface",
  args: {
    ...defaults,
    elevationColor: "rgba(0, 0, 0, 0.6)",
    elevationSize: 10,
    rowSeparatorColor: "#3a3f47",
    columnSeparatorColor: "#3a3f47",
    fixedBackground: "#22262c",
    selectedBackground: "rgba(80, 160, 255, 0.25)",
    headerColor: "#9aa4b2",
    focusRingColor: "#6cb6ff",
    subRowConnectorColor: "#6b7380",
  },
  render: (theme) => <div style={{ background: "#22262c", color: "#e6e9ee", padding: 8 }}>{render(theme)}</div>,
};
