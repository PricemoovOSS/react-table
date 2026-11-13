import * as React from "react";
import { act } from "@testing-library/react";

import { ITableProps } from "../../../src/components/table/table";
import { ITrees } from "../../../src/components/table/elementary-table";
import { loggedErrors, mount } from "./harness";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { runScenario } = require("./scenario");

/**
 * Exploration (held): a table that went through a random sequence of changes and scrolls shows
 * exactly what a table mounted with the final props, at the same scroll position, shows — and
 * React logs no error on the way.
 *
 * FUZZ_SEEDS / FUZZ_STEPS / FUZZ_FIRST / FUZZ_EXTENDED=0 change the run. FUZZ_VALID_GROUPS=1 also
 * checks the group rows against the columns, FUZZ_COLUMN_OPS=1 inserts, removes and moves
 * columns. FUZZ_STRICT=1 runs under StrictMode: it fails at once, see
 * discarded-render-stale-window.test.tsx.
 */
const SEEDS = Number(process.env.FUZZ_SEEDS || 40);
const STEPS = Number(process.env.FUZZ_STEPS || 25);
const FIRST = Number(process.env.FUZZ_FIRST || 1);
const EXTENDED = process.env.FUZZ_EXTENDED !== "0";
const STRICT = process.env.FUZZ_STRICT === "1";
const VALID_GROUPS = process.env.FUZZ_VALID_GROUPS === "1";
const COLUMN_OPS = process.env.FUZZ_COLUMN_OPS === "1";

const wrap = STRICT ? (node: React.ReactElement) => <React.StrictMode>{node}</React.StrictMode> : undefined;

/** Ids and labels of the groups above a column, from the top row of groups to the bottom one (depths equalized). */
const GROUP_PATHS: Record<string, { ids: string[]; labels: string[] }> = {
  g1: { ids: ["g1-root-0", "g1-root-1", "g1"], labels: ["G1", "", ""] },
  g2a: { ids: ["g2", "g2a-root-1", "g2a"], labels: ["G2", "G2a", ""] },
  g2b1: { ids: ["g2", "g2b", "g2b1"], labels: ["G2", "G2b", "G2b1"] },
  g3: { ids: ["g3-root-0", "g3-root-1", "g3"], labels: ["G3", "", ""] },
  none: { ids: ["d-0", "d-1", "d"], labels: ["", "", ""] },
};

/**
 * The group rows must cover the visible columns, in order: a cell per run of columns of the
 * same group, the columns fixed at the end having their own cells (5.0).
 */
function checkGroups(container: HTMLElement, model: any): string | null {
  if (!VALID_GROUPS) return null;
  const rows = Array.from(container.querySelectorAll<HTMLElement>("tr.table-row:not(.table-groups-row)"));
  // a row of the data without merged cells: the index of its cells is the index of their column
  const plainIds = new Set(
    model.rows
      .filter((row: any) => row.cells.every((cell: any) => !cell.colspan))
      .map((row: any) => `table-${row.isHeader ? "header" : "row"}-${row.id}`),
  );
  const plain = rows.find((row) => plainIds.has(row.getAttribute("data-testid") || ""));
  if (!plain) return null;
  const cells = Array.from(plain.querySelectorAll<HTMLElement>(":scope > [data-testid='table-column']"));
  // every column hidden: no group to show
  if (cells.length === 0) return null;
  const columns = cells.map((cell) => ({
    index: Number(cell.getAttribute("aria-colindex")) - 1,
    fixedEnd: cell.classList.contains("elevated-absolute"),
  }));
  const pathOf = (index: number) => GROUP_PATHS[model.groupIds?.[index] ?? "none"];
  const groupRows = Array.from(container.querySelectorAll<HTMLElement>("tr.table-groups-row"));
  if (groupRows.length !== 3) return `expected 3 group rows, got ${groupRows.length}`;
  for (let depth = 0; depth < 3; depth++) {
    const expected: string[] = [];
    let previous: { key: string; fixedEnd: boolean } | null = null;
    let size = 0;
    let label = "";
    columns.forEach((column) => {
      const path = pathOf(column.index);
      const key = path.ids.slice(0, depth + 1).join("/");
      if (previous && previous.key === key && previous.fixedEnd === column.fixedEnd) {
        size += 1;
      } else {
        if (previous) expected.push(`${label}x${size}`);
        size = 1;
        label = path.labels[depth];
      }
      previous = { key, fixedEnd: column.fixedEnd };
    });
    if (previous) expected.push(`${label}x${size}`);
    const actual = Array.from(groupRows[depth].children).map(
      (cell) => `${cell.textContent}x${(cell as HTMLTableCellElement).colSpan}`,
    );
    // a group fixed at the end sits exactly above its columns
    let position = 0;
    for (const groupCell of Array.from(groupRows[depth].children) as HTMLTableCellElement[]) {
      const covered = cells.slice(position, position + groupCell.colSpan);
      position += groupCell.colSpan;
      const isFixedEnd = groupCell.classList.contains("elevated-absolute");
      if (isFixedEnd !== covered.every((cell) => cell.classList.contains("elevated-absolute")) || !covered.length) {
        return `depth ${depth}: group "${groupCell.textContent}" fixed at the end: ${isFixedEnd}, its columns: ${covered.map((cell) => cell.className)}`;
      }
      if (isFixedEnd) {
        const width = covered.reduce((sum, cell) => sum + parseFloat(cell.style.width), 0);
        const right = parseFloat(covered[covered.length - 1].style.right);
        if (parseFloat(groupCell.style.width) !== width || parseFloat(groupCell.style.right) !== right) {
          return `depth ${depth}: group "${groupCell.textContent}" at right ${groupCell.style.right} width ${groupCell.style.width}, its columns: right ${right} width ${width}`;
        }
      }
    }
    if (actual.join(" | ") !== expected.join(" | ")) {
      return `depth ${depth}: columns ${JSON.stringify(columns.map((c) => `${c.index}${c.fixedEnd ? "F" : ""}:${model.groupIds?.[c.index] ?? "-"}`))} expected [${expected.join(" | ")}] got [${actual.join(" | ")}]`;
    }
  }
  return null;
}

function run(seed: number) {
  const toProps = (model: any, trees?: ITrees): ITableProps => ({
    id: "t",
    isVirtualized: true,
    isSelectable: false,
    rows: model.rows,
    ...model.props,
    virtualizerProps: { ...model.virtualizer },
    ...(trees ? { initialOpenedTrees: trees } : {}),
  });
  let table = null as unknown as ReturnType<typeof mount>;
  const log: string[] = [];
  let failure: Record<string, unknown> | null = null;

  runScenario(
    seed,
    STEPS,
    (op: any, model: any) => {
      if (failure) return;
      let label = op.label || op.type;
      switch (op.type) {
        case "mount":
          table = mount(toProps(model), wrap);
          break;
        case "scroll":
          label = `scroll ${JSON.stringify({ ...op, type: undefined })}`;
          if (table.scroller()) table.scroll({ ...op, type: undefined });
          break;
        case "props":
          table.rerender(toProps(model));
          break;
        case "toggleTree": {
          const opened = table.handle()?.getOpenedTrees() ?? {};
          label = `${opened[op.rowIndex] ? "close" : "open"} ${op.rowIndex}${op.withSubTree ? " +sub" : ""}`;
          act(() => {
            if (opened[op.rowIndex]) table.handle()?.closeTrees({ [op.rowIndex]: opened[op.rowIndex] });
            else
              table.handle()?.openTrees({
                [op.rowIndex]: {
                  rowIndex: op.rowIndex,
                  columnIndex: 0,
                  ...(op.withSubTree ? { subTrees: { 0: { rowIndex: 0, columnIndex: 0 } } } : {}),
                },
              });
          });
          break;
        }
        case "goToRow":
          label = `goToRow ${op.rowIndex}`;
          act(() => table.handle()?.goToRowIndex(op.rowIndex));
          break;
        case "goToColumn":
          label = `goToColumn ${op.columnIndex}`;
          act(() => table.handle()?.goToColumnIndex(op.columnIndex));
          break;
        default:
      }
      // a browser dispatches a scroll event after a programmatic scroll
      table.flushScroll();
      log.push(label);

      const scroller = table.scroller();
      if (!scroller) return;
      const position = { scrollTop: scroller.scrollTop, scrollLeft: scroller.scrollLeft };
      const fresh = mount(toProps(model, table.handle()?.getOpenedTrees()), wrap);
      if (fresh.scroller()) fresh.scroll(position);
      const expected = fresh.signature();
      fresh.unmount();
      const actual = table.signature();
      const groupsProblem = model.props.groups ? checkGroups(table.container, model) : null;
      if (groupsProblem && !failure) failure = { seed, step: log.length, log, groupsProblem, virtualizer: model.virtualizer };
      // a row rendered twice (duplicated index in a list): same key, React does not reconcile it reliably
      const duplicated = loggedErrors(table.errors).some((message) => message.includes("same key"));
      if (actual !== expected && !duplicated)
        failure = { seed, step: log.length, log, position, actual, expected, virtualizer: model.virtualizer };
    },
    { extended: EXTENDED, validGroups: VALID_GROUPS, noDuplicates: VALID_GROUPS, columnOps: COLUMN_OPS },
  );
  // duplicated indexes in the lists given by the scenario render a row twice: same key, in every version
  const errors = loggedErrors(table.errors).filter((message) => !message.includes("same key"));
  table.errors.mockClear();
  table.unmount();
  if (failure) return failure;
  return errors.length ? { seed, step: -1, log, errors: Array.from(new Set(errors)) } : null;
}

describe("exploration: incremental changes vs fresh mount", () => {
  it("shows the same table", () => {
    const failures: unknown[] = [];
    for (let seed = FIRST; seed < FIRST + SEEDS; seed++) {
      const failure = run(seed) as any;
      if (!failure) continue;
      const summarize = (html: string) =>
        Array.from(html.matchAll(/data-testid="table-(?:row|header)-([^"]+)"/g))
          .map((match) => match[1])
          .join(",");
      failures.push(
        failure.actual
          ? {
              seed: failure.seed,
              step: failure.step,
              log: failure.log.slice(-8),
              position: failure.position,
              actualRows: summarize(failure.actual),
              expectedRows: summarize(failure.expected),
              firstDiff: (() => {
                let i = 0;
                while (i < failure.actual.length && failure.actual[i] === failure.expected[i]) i++;
                return {
                  actual: failure.actual.slice(Math.max(0, i - 200), i + 200),
                  expected: failure.expected.slice(Math.max(0, i - 200), i + 200),
                };
              })(),
              virtualizer: failure.virtualizer,
            }
          : failure,
      );
    }
    // eslint-disable-next-line no-console
    if (failures.length) console.log(JSON.stringify(failures.slice(0, 5), null, 1), `\n${failures.length} failing seeds`);
    expect(failures.length).toBe(0);
  });
});
