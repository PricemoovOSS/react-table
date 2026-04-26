import { addons } from "storybook/manager-api";
import { themes, create } from "storybook/theming";

addons.setConfig({
  panelPosition: "right",
  theme: create({
    ...themes.light,
    base: "light",
    brandTitle: "@pricemoov/react-table",
    brandUrl: "https://github.com/PricemoovOSS/react-table",
    appBg: "white",
    appBorderRadius: 4,
  }),
});
