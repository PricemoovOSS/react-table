import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import Button from "@mui/material/Button";
import Fab from "@mui/material/Fab";

import Scroller, { IScrollerHandle, ScrollDirection } from "../../src/components/scroller";
import { withThemeProvider } from "../utils/decorators";

const defaultProps = {
  width: 300,
  height: 300,
  virtualWidth: 4000,
  virtualHeight: 4000,
};

const meta: Meta<typeof Scroller> = {
  title: "Components/Scroller",
  component: Scroller,
  decorators: [withThemeProvider],
  tags: ["autodocs"],
  parameters: {
    jest: ["scroller", "virtualized-table"],
    docs: {
      description: {
        component:
          "Low-level scroll container exposing imperative `scrollToTop` / `scrollToLeft` and reporting scroll origin (native vs imperative).",
      },
    },
  },
  args: defaultProps,
  argTypes: {
    width: { control: { type: "number", min: 0, step: 50 } },
    height: { control: { type: "number", min: 0, step: 50 } },
    virtualWidth: { control: { type: "number", min: 0, step: 100 } },
    virtualHeight: { control: { type: "number", min: 0, step: 100 } },
  },
};

export default meta;

type Story = StoryObj<typeof Scroller>;

const PlaceholderContent = () => <div style={{ padding: 16 }}>Scroll content</div>;

export const Default: Story = {
  render: (args) => (
    <Scroller {...args} onScroll={(s) => console.log(s)}>
      <PlaceholderContent />
    </Scroller>
  ),
};

export const VerticalOnly: Story = {
  args: { virtualWidth: defaultProps.width },
  render: (args) => (
    <Scroller {...args} onScroll={(s) => console.log(s)}>
      <PlaceholderContent />
    </Scroller>
  ),
};

export const HorizontalOnly: Story = {
  args: { virtualHeight: defaultProps.height },
  render: (args) => (
    <Scroller {...args} onScroll={(s) => console.log(s)}>
      <PlaceholderContent />
    </Scroller>
  ),
};

export const Imperative: Story = {
  parameters: {
    docs: {
      description: {
        story: "Demonstrates the imperative ref API with `scrollToTop` and `scrollToLeft`.",
      },
    },
  },
  render: (args) => <ImperativeStory {...args} />,
};

const ImperativeStory: React.FC<typeof defaultProps> = (args) => {
  const ref = React.useRef<IScrollerHandle>(null);
  const [topCount, setTopCount] = React.useState(0);
  const [leftCount, setLeftCount] = React.useState(0);
  const onScroll = ({ directions }: { directions: ScrollDirection[] }) => {
    if (directions.includes(ScrollDirection.down)) setTopCount((v) => v + 1);
    else if (directions.includes(ScrollDirection.up)) setTopCount((v) => Math.max(0, v - 1));
    if (directions.includes(ScrollDirection.right)) setLeftCount((v) => v + 1);
    else if (directions.includes(ScrollDirection.left)) setLeftCount((v) => Math.max(0, v - 1));
  };
  return (
    <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <Button variant="contained" onClick={() => ref.current?.scrollToTop(args.virtualHeight / 2)}>
          Scroll to middle (top)
        </Button>
        <Button variant="outlined" onClick={() => ref.current?.scrollToLeft(args.virtualWidth / 2)}>
          Scroll to middle (left)
        </Button>
        <Fab color="primary" size="medium">
          <span style={{ fontSize: 12 }}>
            ↓{topCount} →{leftCount}
          </span>
        </Fab>
      </div>
      <Scroller ref={ref} {...args} onScroll={onScroll}>
        <PlaceholderContent />
      </Scroller>
    </div>
  );
};
