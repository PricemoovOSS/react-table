import type { Meta, StoryObj } from "@storybook/react-vite";

import { RenderMeter } from "../stories-components/heavy-cells";
import { ILiveDataProps, LiveDataPage } from "../stories-components/live-data";

const meta: Meta<ILiveDataProps> = {
  title: "Recipes/Live data",
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: `
Rows and columns that change while the table is displayed: inserted, removed, updated — at the start, in
the window or at the end. The table is given new \`rows\` and \`columns\`, nothing else: there is no call to
make to tell it what changed.

What keeps it cheap is on the side of the application:

- **a row or a cell that did not change is the same object as before** (see \`toTableRows\` in
  \`stories/stories-components/live-data.tsx\`): the table has nothing to render for it. Updating one value
  renders one cell;
- **rows and cells have stable ids**: the state of a cell (the *watch* box of the first column) follows its
  row when rows are inserted or removed above it;
- **columns are pinned and hidden by id** through the interactions manager: the *Total* column stays pinned
  on the right whatever is inserted or removed before it;
- options given by index (\`columns\`, \`rowsProps\`, opened rows) are rebuilt by the application when the
  indexes move — the story moves the opened rows with \`shiftTrees\`.

The scroll position is kept: inserting above the window shifts what the window shows by as many rows, the
scroll bar does not jump. Removing the rows under the window, down to none, never leaves it empty.

The same operations are run by \`test/it-tests/data-updates.test.tsx\` and, in a real browser, by
\`test/browser/live-data.spec.ts\`.
        `,
      },
    },
  },
  argTypes: {
    rows: { control: { type: "number", min: 0, max: 20000, step: 10 } },
    columns: { control: { type: "number", min: 3, max: 500, step: 1 } },
    subRowsEvery: { control: { type: "number", min: 0, max: 50, step: 1 } },
    withGroups: { control: "boolean" },
    stream: { control: "boolean" },
    width: { table: { disable: true } },
    height: { table: { disable: true } },
    onReady: { table: { disable: true } },
  },
};

export default meta;

// `onReady` is for the tests that mount the page themselves: Storybook must not turn it into an action
const render = ({ rows, columns, subRowsEvery, withGroups, stream }: ILiveDataProps) => (
  <>
    <RenderMeter />
    {/* a change of size or of options starts from fresh data */}
    <LiveDataPage
      key={`${rows}-${columns}-${subRowsEvery}`}
      rows={rows}
      columns={columns}
      subRowsEvery={subRowsEvery}
      withGroups={withGroups}
      stream={stream}
    />
  </>
);

export const Default: StoryObj<ILiveDataProps> = {
  name: "Insert, remove and update rows and columns",
  args: { rows: 200, columns: 30, subRowsEvery: 5, withGroups: true, stream: false },
  render,
};

export const Stream: StoryObj<ILiveDataProps> = {
  name: "Values updated four times a second",
  args: { rows: 2000, columns: 60, subRowsEvery: 0, withGroups: true, stream: true },
  render,
};

export const Large: StoryObj<ILiveDataProps> = {
  name: "5 000 rows × 200 columns",
  args: { rows: 5000, columns: 200, subRowsEvery: 0, withGroups: false, stream: false },
  render,
};
