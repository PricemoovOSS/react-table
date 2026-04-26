import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import ResponsiveContainer from "../../src/components/responsive-container";

const meta: Meta<typeof ResponsiveContainer> = {
  title: "Components/ResponsiveContainer",
  component: ResponsiveContainer,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    jest: ["responsive-container"],
    docs: {
      description: {
        component:
          "Renders its children only once a non-zero width/height is detected. Useful to size virtualized children to their parent.",
      },
    },
  },
};

export default meta;

type Story = StoryObj<typeof ResponsiveContainer>;

const sizeStyles: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 30,
  fontWeight: 900,
  height: "100%",
};

const listStyles = {
  container: {
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    height: "100%",
  } satisfies React.CSSProperties,
  item: {
    width: "100%",
    textAlign: "center" as const,
    fontSize: 20,
    borderBottom: "solid 1px #d7d4d4",
    color: "gray",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
};

export const ShowSize: Story = {
  render: () => (
    <div style={{ height: "70vh", width: "100%", border: "1px dashed #999" }}>
      <ResponsiveContainer>
        {({ width, height }) => (
          <div style={sizeStyles}>
            {width} × {height}
          </div>
        )}
      </ResponsiveContainer>
    </div>
  ),
};

const MIN_ITEM_HEIGHT = 50;

export const FillingList: Story = {
  render: () => (
    <div style={{ height: "70vh", width: "100%", border: "1px dashed #999" }}>
      <ResponsiveContainer>
        {({ height }) => {
          const itemCount = Math.max(1, Math.ceil(height / MIN_ITEM_HEIGHT));
          const itemHeight = height / itemCount;
          return (
            <div style={listStyles.container}>
              {Array.from({ length: itemCount }, (_, index) => (
                <div key={index} style={{ ...listStyles.item, height: itemHeight }}>
                  Item {index + 1}
                </div>
              ))}
            </div>
          );
        }}
      </ResponsiveContainer>
    </div>
  ),
};
