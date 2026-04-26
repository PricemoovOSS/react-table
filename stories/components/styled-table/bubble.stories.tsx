import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { withThemeProvider } from "../../utils/decorators";
import Bubble, { BubbleType } from "../../../src/components/styled-table/bubble";

const meta: Meta<typeof Bubble> = {
  title: "Styled Table/Bubble",
  component: Bubble,
  decorators: [withThemeProvider],
  tags: ["autodocs"],
  parameters: {
    jest: ["bubble"],
  },
  argTypes: {
    type: {
      control: { type: "select" },
      options: [BubbleType.info, BubbleType.success, BubbleType.warning, BubbleType.error],
    },
    badge: { control: { type: "text" } },
  },
};

export default meta;

type Story = StoryObj<typeof Bubble>;

export const Default: Story = {
  args: { badge: "20" },
  render: (args) => (
    <div style={{ width: 200, height: 200 }}>
      <Bubble {...args} />
    </div>
  ),
};

export const WithoutBadge: Story = {
  args: {},
  render: (args) => (
    <div style={{ width: 200, height: 200 }}>
      <Bubble {...args} />
    </div>
  ),
};

interface IWithContentArgs {
  badge: string;
  type: BubbleType;
  content: string;
}

export const WithContent: StoryObj<IWithContentArgs> = {
  args: { badge: "20", type: BubbleType.info, content: "My content" },
  argTypes: {
    type: {
      control: { type: "select" },
      options: [BubbleType.info, BubbleType.success, BubbleType.warning, BubbleType.error],
    },
    badge: { control: { type: "text" } },
    content: { control: { type: "text" } },
  },
  render: ({ badge, type, content }) => (
    <div style={{ width: 200, height: 200 }}>
      <Bubble badge={badge} type={type}>
        <div style={{ fontSize: 20, fontWeight: 900 }}>{content}</div>
      </Bubble>
    </div>
  ),
};
