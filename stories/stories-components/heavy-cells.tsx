import * as React from "react";

import { IContentCellProps } from "../../src/components/table/cell";
import { IRow } from "../../src/components/table/row";

/**
 * Heavy, interactive cell contents and the meter that counts what the table renders.
 * Used by the "Recipes/Heavy interactive cells" story and by the browser tests that lock
 * the rule: an interaction renders the cells that enter the window, nothing else.
 */
export type CellWeight = "light" | "medium" | "heavy";

export interface IRenderStats {
  /** Renders of a cell content since the last reset */
  renders: number;
  /** Cell contents mounted since the last reset */
  mounts: number;
}

export const renderStats: IRenderStats = { renders: 0, mounts: 0 };
(window as unknown as { renderStats: IRenderStats }).renderStats = renderStats;

export const resetRenderStats = () => {
  renderStats.renders = 0;
  renderStats.mounts = 0;
};

interface ICoordinates {
  row: number;
  column: number;
}

/** Number of points of the chart and of marks of the strip: what makes a cell heavy to build. */
const DETAIL: Record<CellWeight, number> = { light: 0, medium: 16, heavy: 48 };

const priceFormat = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Deterministic series for a cell: the same cell always shows the same data. */
function buildSeries(row: number, column: number, length: number): number[] {
  let seed = (row * 73856093) ^ (column * 19349663);
  return Array.from({ length }, () => {
    seed = (seed * 1664525 + 1013904223) | 0;
    return ((seed >>> 8) % 1000) / 10;
  });
}

function Sparkline({ series }: { series: number[] }) {
  const step = 96 / Math.max(series.length - 1, 1);
  const points = series.map((value, index) => `${(index * step).toFixed(1)},${(24 - value * 0.24).toFixed(1)}`).join(" ");
  return (
    <svg width={96} height={24} viewBox="0 0 96 24" aria-hidden="true" style={{ flexShrink: 0 }}>
      <polyline points={points} fill="none" stroke="#3355dd" strokeWidth={1.5} />
      {series.map((value, index) => (
        <circle key={index} cx={index * step} cy={24 - value * 0.24} r={0.8} fill="#3355dd" />
      ))}
    </svg>
  );
}

function Strip({ series }: { series: number[] }) {
  return (
    <span style={{ display: "inline-flex", gap: 1, alignItems: "flex-end", height: 12 }} aria-hidden="true">
      {series.map((value, index) => (
        <i key={index} style={{ width: 2, height: 2 + value * 0.1, background: value > 50 ? "#1a9a5a" : "#d0453a" }} />
      ))}
    </span>
  );
}

export interface IHeavyCellProps extends IContentCellProps<ICoordinates> {
  value?: string;
  weight?: CellWeight;
}

/**
 * An editable price with its trend, a chart, a strip of marks and a menu: what a rich cell
 * of a data application looks like. Its state (draft, menu) is local, so typing or opening
 * the menu renders this cell only.
 */
export function HeavyCell({ value = "", dataCoordinates, weight = "heavy" }: IHeavyCellProps) {
  renderStats.renders += 1;
  React.useEffect(() => {
    renderStats.mounts += 1;
  }, []);

  const { row = 0, column = 0 } = dataCoordinates || {};
  const [draft, setDraft] = React.useState(value);
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const [isPinned, setIsPinned] = React.useState(false);
  const series = React.useMemo(() => buildSeries(row, column, DETAIL[weight]), [row, column, weight]);
  const trend = series.length > 1 ? series[series.length - 1] - series[0] : 0;
  const amount = Number(draft);

  return (
    <div
      data-testid="heavy-cell"
      data-row={row}
      data-column={column}
      style={{ display: "flex", flexDirection: "column", gap: 2, width: "100%", padding: "0 8px", font: "12px sans-serif" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <input
          aria-label={`Price ${row}:${column}`}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          style={{ width: 60, font: "inherit", textAlign: "right" }}
        />
        {weight !== "light" ? (
          <span
            title={`Formatted: ${Number.isFinite(amount) ? priceFormat.format(amount) : "—"}`}
            style={{ color: trend >= 0 ? "#1a9a5a" : "#d0453a", flex: 1, whiteSpace: "nowrap" }}
          >
            {trend >= 0 ? "▲" : "▼"} {Math.abs(trend).toFixed(1)}
          </span>
        ) : (
          <span style={{ flex: 1 }} />
        )}
        <button
          type="button"
          aria-pressed={isPinned}
          aria-label={`Pin ${row}:${column}`}
          onClick={() => setIsPinned((pinned) => !pinned)}
        >
          {isPinned ? "★" : "☆"}
        </button>
        <span style={{ position: "relative" }}>
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={isMenuOpen}
            aria-label={`Actions ${row}:${column}`}
            onClick={() => setIsMenuOpen((open) => !open)}
          >
            ⋯
          </button>
          {isMenuOpen ? (
            <span
              role="menu"
              style={{ position: "absolute", right: 0, top: "100%", background: "#fff", border: "1px solid #ccc", zIndex: 1 }}
            >
              {["Copy", "Reset", "Lock"].map((action) => (
                <button
                  key={action}
                  type="button"
                  role="menuitem"
                  onClick={() => setIsMenuOpen(false)}
                  style={{ display: "block" }}
                >
                  {action}
                </button>
              ))}
            </span>
          ) : null}
        </span>
      </div>
      {weight !== "light" ? (
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 24, overflow: "hidden" }}>
          <Sparkline series={series} />
          {weight === "heavy" ? <Strip series={series} /> : null}
        </div>
      ) : null}
    </div>
  );
}

/** A header row, then rows made of a label and heavy cells. */
export function buildHeavyRows(rowsCount: number, columnsCount: number, weight: CellWeight): IRow<ICoordinates>[] {
  const header: IRow<ICoordinates> = {
    id: "header",
    isHeader: true,
    cells: Array.from({ length: columnsCount }, (_, column) => ({
      id: `column-${column}`,
      value: column === 0 ? "Product" : `Price ${column}`,
    })),
  };
  const body = Array.from({ length: rowsCount }, (_, index) => {
    const row = index + 1;
    return {
      id: `row-${row}`,
      cells: Array.from({ length: columnsCount }, (_c, column) =>
        column === 0
          ? { id: `row-${row}-label`, value: `Product ${row}` }
          : {
              id: `row-${row}-column-${column}`,
              value: (((row * 31 + column * 17) % 9000) / 100 + 10).toFixed(2),
              dataCoordinates: { row, column },
              cellContent: HeavyCell,
              cellContentProps: { weight },
            },
      ),
    };
  });
  return [header, ...body];
}

interface IMeterSnapshot {
  lastInteraction: number;
  lastInteractionMounts: number;
  average: number;
  worst: number;
  long: number;
}

const QUIET_FRAMES = 12;
const WINDOW_FRAMES = 120;
const LONG_FRAME = 34;

/**
 * Shows what the last interaction rendered and how long the last frames took. It lives next
 * to the table, not around it: refreshing the meter renders no cell.
 */
export function RenderMeter() {
  const [snapshot, setSnapshot] = React.useState<IMeterSnapshot>({
    lastInteraction: 0,
    lastInteractionMounts: 0,
    average: 0,
    worst: 0,
    long: 0,
  });

  React.useEffect(() => {
    let frameId = 0;
    let previousTime = performance.now();
    let previous = { ...renderStats };
    let current = { renders: 0, mounts: 0 };
    let last = { renders: 0, mounts: 0 };
    let quietFrames = 0;
    let tick = 0;
    const frames: number[] = [];

    const loop = (now: number) => {
      frames.push(now - previousTime);
      if (frames.length > WINDOW_FRAMES) frames.shift();
      previousTime = now;

      // an interaction is over after a few frames without any render
      const renders = renderStats.renders - previous.renders;
      const mounts = renderStats.mounts - previous.mounts;
      previous = { ...renderStats };
      if (renders > 0 || mounts > 0) {
        current = { renders: current.renders + renders, mounts: current.mounts + mounts };
        quietFrames = 0;
      } else if (current.renders > 0 && ++quietFrames > QUIET_FRAMES) {
        last = current;
        current = { renders: 0, mounts: 0 };
      }

      tick += 1;
      if (tick % 20 === 0) {
        setSnapshot({
          lastInteraction: last.renders,
          lastInteractionMounts: last.mounts,
          average: frames.reduce((sum, frame) => sum + frame, 0) / frames.length,
          worst: Math.max(...frames),
          long: frames.filter((frame) => frame > LONG_FRAME).length,
        });
      }
      frameId = requestAnimationFrame(loop);
    };
    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, []);

  const figure = (label: string, value: string, isAlert = false) => (
    <span style={{ display: "inline-flex", flexDirection: "column", minWidth: 150 }}>
      <small style={{ color: "#667" }}>{label}</small>
      <strong style={{ color: isAlert ? "#d0453a" : "#123" }}>{value}</strong>
    </span>
  );

  return (
    <div
      data-testid="render-meter"
      style={{ display: "flex", gap: 16, flexWrap: "wrap", font: "13px sans-serif", padding: "6px 0" }}
    >
      {figure(
        "Cells rendered by the last interaction",
        `${snapshot.lastInteraction} (${snapshot.lastInteractionMounts} mounted)`,
      )}
      {figure("Frame, average of the last 2 s", `${snapshot.average.toFixed(1)} ms`)}
      {figure("Worst frame", `${snapshot.worst.toFixed(1)} ms`, snapshot.worst > LONG_FRAME)}
      {figure(`Frames over ${LONG_FRAME} ms`, `${snapshot.long} of ${WINDOW_FRAMES}`, snapshot.long > 0)}
    </div>
  );
}
