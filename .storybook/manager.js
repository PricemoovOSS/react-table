import { addons } from "@storybook/addons";
import { themes } from "@storybook/theming";

addons.setConfig({
  panelPosition: "right",
  theme: {
    ...themes.normal,
    brandTitle: "@pricemoov-oss/react-table",
    brandUrl: "#",

    // UI
    appBg: "white",
    appBorderRadius: 4,
  },
});
