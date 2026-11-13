export { default as useComponent } from "./useComponent";
export * from "./useComponent";

export { useVirtualizer, getScrollAxes, bindScrollerToVirtualizer } from "./useVirtualizer";
export type {
  IUseVirtualizerProps,
  IUseVirtualizerResult,
  IRowsState as IUseVirtualizerRowsState,
  IColumnState as IUseVirtualizerColumnState,
} from "./useVirtualizer";
