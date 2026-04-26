import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import Virtualizer from "../../src/components/virtualizer";
import { withThemeProvider } from "../utils/decorators";

const ITEMS = Array.from({ length: 100 }, (_, index) => ({ id: index, title: `Item ${index}` }));
const FIXED = [0, 3, 20];

const styles = {
  horizontalListContainer: {
    display: "flex",
    alignItems: "center",
  } satisfies React.CSSProperties,
  listContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
  } satisfies React.CSSProperties,
  listItem: {
    height: 56,
    lineHeight: "56px",
    width: "100%",
    textAlign: "center" as const,
    fontSize: 18,
    borderBottom: "solid 1px #d7d4d4",
    borderRight: "solid 1px #d7d4d4",
    color: "gray",
  },
  fixedItem: {
    backgroundColor: "#1ea7fd",
    color: "white",
  },
  horizontalPadding: {
    width: "100%",
    backgroundColor: "orange",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "white",
    fontWeight: 900,
  } satisfies React.CSSProperties,
  verticalPadding: {
    height: 56,
    backgroundColor: "orange",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "white",
    fontWeight: 900,
  } satisfies React.CSSProperties,
};

const VerticalList: React.FC<{ items: typeof ITEMS; itemHeight: number; fixedItems?: number[]; children?: React.ReactNode }> = ({
  items,
  itemHeight,
  fixedItems = [],
  children,
}) => (
  <div style={styles.listContainer}>
    {children}
    {items.map((item) => (
      <div
        key={item.id}
        style={{
          ...styles.listItem,
          height: itemHeight,
          lineHeight: `${itemHeight}px`,
          ...(fixedItems.includes(item.id) ? styles.fixedItem : {}),
        }}
      >
        {item.title}
      </div>
    ))}
  </div>
);

const HorizontalList: React.FC<{ items: typeof ITEMS; itemWidth: number; fixedItems?: number[]; children?: React.ReactNode }> = ({
  items,
  itemWidth,
  fixedItems = [],
  children,
}) => (
  <div style={styles.horizontalListContainer}>
    {children}
    {items.map((item) => (
      <div
        key={item.id}
        style={{
          ...styles.listItem,
          width: itemWidth,
          ...(fixedItems.includes(item.id) ? styles.fixedItem : {}),
        }}
      >
        {item.title}
      </div>
    ))}
    {children}
  </div>
);

const meta: Meta<typeof Virtualizer> = {
  title: "Components/Virtualizer",
  component: Virtualizer,
  decorators: [withThemeProvider],
  tags: ["autodocs"],
  parameters: {
    jest: ["virtualizer", "virtualized-table"],
    docs: {
      description: {
        component:
          "Virtualizes a 2D grid of items. Returns visible row/column indexes via a render-prop. Supports fixed rows/columns, hidden indexes, custom sizes and padding.",
      },
    },
  },
  argTypes: {
    height: { control: { type: "number" } },
    width: { control: { type: "number" } },
    rowsCount: { control: { type: "number" } },
    columnsCount: { control: { type: "number" } },
  },
};

export default meta;

type Story = StoryObj<typeof Virtualizer>;

export const VirtualizedVerticalList: Story = {
  args: { height: 500, width: 300, rowsCount: 7, rowsLength: ITEMS.length, columnsLength: 1 },
  render: (args) => (
    <Virtualizer {...args}>
      {({ visibleRowIndexes, cellHeight }) => (
        <VerticalList items={visibleRowIndexes.map((i) => ITEMS[i])} itemHeight={cellHeight} />
      )}
    </Virtualizer>
  ),
};

export const VerticalListWithFixedRows: Story = {
  args: { height: 500, width: 300, rowsCount: 7, rowsLength: ITEMS.length, columnsLength: 1, fixedRows: FIXED },
  render: (args) => (
    <Virtualizer {...args}>
      {({ visibleRowIndexes, cellHeight }) => (
        <VerticalList items={visibleRowIndexes.map((i) => ITEMS[i])} itemHeight={cellHeight} fixedItems={FIXED} />
      )}
    </Virtualizer>
  ),
};

export const VirtualizedHorizontalList: Story = {
  args: { height: 70, width: 1000, columnsCount: 7, rowsLength: 1, columnsLength: ITEMS.length },
  render: (args) => (
    <Virtualizer {...args}>
      {({ visibleColumnIndexes, cellWidth }) => (
        <HorizontalList items={visibleColumnIndexes.map((i) => ITEMS[i])} itemWidth={cellWidth} />
      )}
    </Virtualizer>
  ),
};

export const HorizontalListWithFixedColumns: Story = {
  args: { height: 70, width: 1000, columnsCount: 7, rowsLength: 1, columnsLength: ITEMS.length, fixedColumns: FIXED },
  render: (args) => (
    <Virtualizer {...args}>
      {({ visibleColumnIndexes, cellWidth }) => (
        <HorizontalList items={visibleColumnIndexes.map((i) => ITEMS[i])} itemWidth={cellWidth} fixedItems={FIXED} />
      )}
    </Virtualizer>
  ),
};

export const VerticalListWithHorizontalPadding: Story = {
  args: {
    height: 500,
    width: 300,
    rowsCount: 7,
    rowsLength: ITEMS.length,
    columnsLength: 1,
    fixedRows: FIXED,
    horizontalPadding: 100,
  },
  render: (args) => (
    <Virtualizer {...args}>
      {({ visibleRowIndexes, cellHeight }) => (
        <VerticalList items={visibleRowIndexes.map((i) => ITEMS[i])} itemHeight={cellHeight} fixedItems={FIXED}>
          <div style={{ ...styles.horizontalPadding, height: 100 }}>My Padding</div>
        </VerticalList>
      )}
    </Virtualizer>
  ),
};

export const HiddenRows: Story = {
  args: {
    height: 500,
    width: 300,
    rowsCount: 7,
    rowsLength: ITEMS.length,
    columnsLength: 1,
    fixedRows: FIXED,
    hiddenRows: [1, 2, 4, 5],
  },
  render: (args) => (
    <Virtualizer {...args}>
      {({ visibleRowIndexes, cellHeight }) => (
        <VerticalList items={visibleRowIndexes.map((i) => ITEMS[i])} itemHeight={cellHeight} fixedItems={FIXED} />
      )}
    </Virtualizer>
  ),
};

export const HiddenColumns: Story = {
  args: {
    height: 70,
    width: 1000,
    columnsCount: 7,
    rowsLength: 1,
    columnsLength: ITEMS.length,
    fixedColumns: FIXED,
    hiddenColumns: [2, 3, 4],
  },
  render: (args) => (
    <Virtualizer {...args}>
      {({ visibleColumnIndexes, cellWidth }) => (
        <HorizontalList items={visibleColumnIndexes.map((i) => ITEMS[i])} itemWidth={cellWidth} fixedItems={FIXED} />
      )}
    </Virtualizer>
  ),
};
