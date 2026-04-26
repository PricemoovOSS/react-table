import * as React from "react";
import { ThemeProvider, StyledEngineProvider, createTheme } from "@mui/material/styles";
import type { Decorator } from "@storybook/react-vite";

export const blueDkt = "#0082c3";

const theme = createTheme({
  typography: { fontFamily: "Roboto" },
  palette: {
    primary: { light: blueDkt, dark: blueDkt, main: blueDkt },
    secondary: { light: blueDkt, dark: blueDkt, main: blueDkt },
  },
});

/**
 * Wraps a story with the MUI theme + emotion engine.
 */
export const withThemeProvider: Decorator = (Story) => (
  <StyledEngineProvider injectFirst>
    <ThemeProvider theme={theme}>
      <Story />
    </ThemeProvider>
  </StyledEngineProvider>
);
