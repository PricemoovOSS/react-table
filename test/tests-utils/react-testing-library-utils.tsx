import * as React from "react";
import { render, RenderOptions } from "@testing-library/react";
import { ThemeProvider, StyledEngineProvider, createTheme } from "@mui/material/styles";

export const blueDkt = "#0082c3";

const theme = createTheme({
  typography: { fontFamily: "Roboto" },
  palette: {
    primary: { light: blueDkt, dark: blueDkt, main: blueDkt },
    secondary: { light: blueDkt, dark: blueDkt, main: blueDkt },
  },
});

const AllTheProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <StyledEngineProvider injectFirst>
    <ThemeProvider theme={theme}>{children}</ThemeProvider>
  </StyledEngineProvider>
);

export const customRender = (ui: React.ReactElement, options?: Omit<RenderOptions, "queries">) =>
  render(ui, { wrapper: AllTheProviders, ...options });

export { screen, fireEvent, within } from "@testing-library/react";
