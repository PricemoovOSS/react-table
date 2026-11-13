import * as React from "react";
import type { Preview } from "@storybook/react-vite";
import { withTests } from "@storybook/addon-jest";

import "../src/style/index.scss";

let testResults: Parameters<typeof withTests>[0]["results"];
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  testResults = require("../jest-test-results.json");
} catch {
  testResults = { numTotalTests: 0 } as never;
}

const preview: Preview = {
  parameters: {
    actions: { argTypesRegex: "^on[A-Z].*" },
    controls: {
      matchers: { color: /(background|color)$/i, date: /Date$/i },
    },
    layout: "padded",
    options: {
      storySort: {
        order: [
          "Introduction",
          "Table",
          ["Basics", "Virtualized", "Column groups", "Sub rows", "Selection", "Keyboard navigation", "Theming", "Combinations"],
          "Interactions",
          "Cells",
          "Building blocks",
          "Recipes",
        ],
      },
    },
  },
  decorators: [
    (Story) => (
      <div style={{ padding: 16 }}>
        <Story />
      </div>
    ),
    withTests({ results: testResults }),
  ],
};

export default preview;
