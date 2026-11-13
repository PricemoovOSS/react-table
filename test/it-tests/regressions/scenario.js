/**
 * Review only. Seeded scenario shared by 5.0 and 4.0.2 (differential run): a table, then a
 * sequence of operations. Pure data: no dependency on the library.
 */
function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeRow(id, columns, subRows) {
  return {
    id,
    cells: Array.from(Array(columns), (_, cellIndex) => ({
      id: `c${cellIndex}`,
      value: `${id}:${cellIndex}`,
      ...(subRows && cellIndex === 0 ? { subItems: subRows } : {}),
    })),
  };
}

const GROUPS = [
  { id: "g1", label: "G1" },
  {
    id: "g2",
    label: "G2",
    subGroups: [
      { id: "g2a", label: "G2a" },
      { id: "g2b", label: "G2b", subGroups: [{ id: "g2b1", label: "G2b1" }] },
    ],
  },
  { id: "g3", label: "G3" },
];
const GROUP_LEAVES = ["g1", "g2a", "g2b1", "g3", undefined];

/**
 * Applies `visit(op, model)` for each step. `model` holds the props to give to the table.
 * `options.extended` adds the less common inputs (groups, colspans, forced counts, odd index lists…).
 */
function runScenario(seed, steps, visit, options = {}) {
  const extended = !!options.extended;
  const random = mulberry32(seed);
  const int = (max) => Math.floor(random() * max);
  let nextId = 0;
  let columnsCount = 3 + int(30);
  let nextColumnId = 0;
  const newRow = () => {
    nextId += 1;
    const withSub = random() < 0.25;
    const subRows = withSub
      ? Array.from(Array(1 + int(4)), (_, index) =>
          makeRow(
            `s${index}`,
            columnsCount,
            random() < 0.3 ? [makeRow("x0", columnsCount), makeRow("x1", columnsCount)] : undefined,
          ),
        )
      : undefined;
    const row = makeRow(`r${nextId}`, columnsCount, subRows);
    if (model && model.columnIds) withColumns(row, model.columnIds);
    if (extended && withSub && random() < 0.3) row.fixSubRows = true;
    if (extended && !options.columnOps && !withSub && random() < 0.05) {
      // merged cells: the row keeps the same number of columns
      const at = 1 + int(Math.max(columnsCount - 2, 1));
      const span = 2 + int(Math.min(3, columnsCount - at - 1));
      if (at + span <= columnsCount) {
        row.cells = [...row.cells.slice(0, at), { ...row.cells[at], colspan: span }, ...row.cells.slice(at + span)];
      }
    }
    return row;
  };
  /** Gives the row (and its sub rows) the cells of the current columns, keeping the sub rows on the first cell. */
  function withColumns(row, columnIds) {
    const subItems = row.cells[0] && row.cells[0].subItems;
    if (subItems) subItems.forEach((subRow) => withColumns(subRow, columnIds));
    row.cells = columnIds.map((columnId, index) => ({
      id: columnId,
      value: `${row.id}:${columnId.slice(1)}`,
      ...(index === 0 && subItems ? { subItems } : {}),
    }));
    return row;
  }
  const cloneRow = (row) => ({
    ...row,
    cells: row.cells.map((cell) => (cell.subItems ? { ...cell, subItems: cell.subItems.map(cloneRow) } : { ...cell })),
  });
  let model = null;
  const header = { ...makeRow("head", columnsCount), isHeader: true };
  model = {
    columnsCount,
    rows: [header, ...Array.from(Array(int(60)), newRow)],
    props: {},
    virtualizer: { width: 300 + int(900), height: 150 + int(600) },
    // for the runs that mount a new table at each step
    scrollTop: 0,
    scrollLeft: 0,
    trees: {},
    // options of the columns, merged into props.columns
    sizes: undefined,
    groupIds: undefined,
    columnIds: undefined,
  };
  const changeColumns = (change) => {
    const columnIds = model.columnIds || Array.from(Array(columnsCount), (_, index) => `c${index}`);
    model.columnIds = change([...columnIds]);
    columnsCount = model.columnIds.length;
    model.columnsCount = columnsCount;
    // new rows, like an application that rebuilds them from its data
    model.rows = model.rows.map((row) => withColumns(cloneRow(row), model.columnIds));
  };
  const randomIndexes = (length, max) => {
    const indexes = Array.from(new Set(Array.from(Array(int(max + 1)), () => int(Math.max(length, 1))))).sort((a, b) => a - b);
    if (!extended) return indexes;
    const oddity = int(12);
    if (oddity === 0) return [...indexes, length + 3]; // out of range
    if (oddity === 1 && indexes.length && !options.noDuplicates) return [...indexes, indexes[0]]; // duplicated
    if (oddity === 2) return [...indexes].reverse(); // unsorted
    if (oddity === 3 && !indexes.includes(length - 1)) return [...indexes, length - 1]; // the last one
    return indexes;
  };
  const setColumns = () => {
    if (!model.sizes && !model.groupIds) {
      model.props = { ...model.props, columns: undefined };
      return;
    }
    const columns = {};
    Object.entries(model.sizes || {}).forEach(([index, size]) => {
      columns[index] = { ...columns[index], size };
    });
    Object.entries(model.groupIds || {}).forEach(([index, groupId]) => {
      if (groupId) columns[index] = { ...columns[index], groupId };
    });
    model.props = { ...model.props, columns };
  };

  const mutations = [
    () => {
      const at = 1 + int(model.rows.length);
      const count = 1 + int(5);
      model.rows = [...model.rows.slice(0, at), ...Array.from(Array(count), newRow), ...model.rows.slice(at)];
      return `insert ${count} rows at ${at}`;
    },
    () => {
      const at = 1 + int(model.rows.length);
      const count = 1 + int(Math.max(model.rows.length - 1, 1));
      model.rows = [...model.rows.slice(0, at), ...model.rows.slice(at + count)];
      return `remove ${count} rows at ${at}`;
    },
    () => {
      model.virtualizer = { ...model.virtualizer, fixedRows: random() < 0.3 ? undefined : randomIndexes(model.rows.length, 3) };
      return `fixedRows ${JSON.stringify(model.virtualizer.fixedRows)}`;
    },
    () => {
      model.virtualizer = { ...model.virtualizer, fixedColumns: random() < 0.3 ? undefined : randomIndexes(columnsCount, 3) };
      return `fixedColumns ${JSON.stringify(model.virtualizer.fixedColumns)}`;
    },
    () => {
      model.virtualizer = { ...model.virtualizer, hiddenRows: random() < 0.3 ? undefined : randomIndexes(model.rows.length, 4) };
      return `hiddenRows ${JSON.stringify(model.virtualizer.hiddenRows)}`;
    },
    () => {
      model.virtualizer = { ...model.virtualizer, hiddenColumns: random() < 0.3 ? undefined : randomIndexes(columnsCount, 4) };
      return `hiddenColumns ${JSON.stringify(model.virtualizer.hiddenColumns)}`;
    },
    () => {
      model.virtualizer = { ...model.virtualizer, width: 300 + int(900), height: 150 + int(600) };
      return `size ${model.virtualizer.width}x${model.virtualizer.height}`;
    },
    () => {
      const sized = randomIndexes(model.rows.length, 3);
      model.props = {
        ...model.props,
        rowsProps: random() < 0.3 ? undefined : Object.fromEntries(sized.map((index) => [index, { size: 30 + int(200) }])),
      };
      return `rowsProps ${JSON.stringify(model.props.rowsProps)}`;
    },
    () => {
      const sized = randomIndexes(columnsCount, 3);
      model.sizes = random() < 0.3 ? undefined : Object.fromEntries(sized.map((index) => [index, 40 + int(300)]));
      setColumns();
      return `column sizes ${JSON.stringify(model.sizes)}`;
    },
    () => {
      model.props = { ...model.props, isSpan: random() < 0.5 };
      return `isSpan ${model.props.isSpan}`;
    },
  ];
  const extendedMutations = [
    () => {
      const on = random() < 0.7;
      // without `validGroups`, some columns refer to a group that is not declared
      const count = 1 + int(GROUPS.length);
      model.props = { ...model.props, groups: on ? (options.validGroups ? GROUPS : GROUPS.slice(0, count)) : undefined };
      // contiguous blocks of columns, like real groups
      let current;
      model.groupIds = on
        ? Object.fromEntries(
            Array.from(Array(columnsCount), (_, index) => {
              if (index === 0 || random() < 0.3) current = GROUP_LEAVES[int(GROUP_LEAVES.length)];
              return [index, current];
            }),
          )
        : undefined;
      setColumns();
      return `groups ${on ? JSON.stringify(Object.values(model.groupIds)) : "off"}`;
    },
    () => {
      const kind = int(4);
      const next = { ...model.virtualizer };
      if (kind === 0) next.rowsCount = random() < 0.4 ? undefined : 1 + int(15);
      if (kind === 1) next.columnsCount = random() < 0.4 ? undefined : 1 + int(15);
      if (kind === 2) next.minRowHeight = random() < 0.4 ? undefined : 20 + int(120);
      if (kind === 3) next.minColumnWidth = random() < 0.4 ? undefined : 40 + int(250);
      model.virtualizer = next;
      return `counts ${JSON.stringify({ r: next.rowsCount, c: next.columnsCount, h: next.minRowHeight, w: next.minColumnWidth })}`;
    },
    () => {
      model.virtualizer = { ...model.virtualizer, scrollbarSize: random() < 0.5 ? undefined : 15 };
      return `scrollbarSize ${model.virtualizer.scrollbarSize}`;
    },
    () => {
      // same content, new arrays and objects
      model.virtualizer = Object.fromEntries(
        Object.entries(model.virtualizer).map(([key, value]) => [key, Array.isArray(value) ? [...value] : value]),
      );
      if (model.props.columns) setColumns();
      return "same props, new identities";
    },
    () => {
      // replace a row by a new object with the same id (updated value)
      if (model.rows.length < 2) return "no row to update";
      const at = 1 + int(model.rows.length - 1);
      const row = model.rows[at];
      model.rows = [...model.rows];
      model.rows[at] = {
        ...row,
        cells: row.cells.map((cell, index) => (index === 1 ? { ...cell, value: `${cell.value}'` } : cell)),
      };
      return `update row ${at}`;
    },
    () => {
      // move a block of rows
      if (model.rows.length < 4) return "no rows to move";
      const from = 1 + int(model.rows.length - 1);
      const count = 1 + int(3);
      const block = model.rows.slice(from, from + count);
      const rest = [...model.rows.slice(0, from), ...model.rows.slice(from + count)];
      const to = 1 + int(rest.length);
      model.rows = [...rest.slice(0, to), ...block, ...rest.slice(to)];
      return `move ${block.length} rows from ${from} to ${to}`;
    },
  ];
  const columnMutations = [
    () => {
      const at = int(columnsCount + 1);
      nextColumnId += 1;
      const id = `cn${nextColumnId}`;
      changeColumns((ids) => [...ids.slice(0, at), id, ...ids.slice(at)]);
      return `insert column ${id} at ${at}`;
    },
    () => {
      if (columnsCount < 3) return "no column to remove";
      const at = int(columnsCount);
      const count = 1 + int(Math.min(3, columnsCount - 2));
      changeColumns((ids) => [...ids.slice(0, at), ...ids.slice(at + count)]);
      return `remove ${count} columns at ${at}`;
    },
    () => {
      const from = int(columnsCount);
      const to = int(columnsCount);
      changeColumns((ids) => {
        const [moved] = ids.splice(from, 1);
        ids.splice(to, 0, moved);
        return ids;
      });
      return `move column ${from} to ${to}`;
    },
  ];
  const allMutations = extended ? [...mutations, ...extendedMutations, ...(options.columnOps ? columnMutations : [])] : mutations;

  visit({ type: "mount" }, model);
  for (let step = 0; step < steps; step++) {
    const action = int(extended ? 20 : 16);
    let op;
    if (action <= 1) {
      op = { type: "scroll", scrollTop: int(model.rows.length * 70) };
      model.scrollTop = op.scrollTop;
    } else if (action === 2) {
      op = { type: "scroll", scrollLeft: int(columnsCount * 120) };
      model.scrollLeft = op.scrollLeft;
    } else if (action === 3) {
      const openable = model.rows.flatMap((row, index) => (row.cells[0].subItems ? [index] : []));
      if (!openable.length) {
        op = { type: "noop" };
      } else {
        const rowIndex = openable[int(openable.length)];
        const subItems = model.rows[rowIndex].cells[0].subItems;
        op = { type: "toggleTree", rowIndex, withSubTree: !!subItems[0].cells[0].subItems && random() < 0.5 };
        model.trees = { ...model.trees };
        if (model.trees[rowIndex]) delete model.trees[rowIndex];
        else
          model.trees[rowIndex] = {
            rowIndex,
            columnIndex: 0,
            ...(op.withSubTree ? { subTrees: { 0: { rowIndex: 0, columnIndex: 0 } } } : {}),
          };
      }
    } else if (action === 4) {
      op = { type: "goToRow", rowIndex: int(model.rows.length + 5) - 2 };
    } else if (action === 5) {
      op = { type: "goToColumn", columnIndex: int(columnsCount + 4) - 2 };
    } else {
      // one change, sometimes several in the same render
      const count = extended && random() < 0.25 ? 2 + int(2) : 1;
      const labels = Array.from(Array(count), () => allMutations[int(allMutations.length)]());
      op = { type: "props", label: labels.join(" + ") };
    }
    visit(op, model);
  }
}

/** What the table shows, in a form both versions can produce. */
function describeTable(container) {
  const scroller = container.querySelector("[data-testid='scroller-container']");
  if (!scroller) return { rows: ["no scroller"] };
  const elevation = (element) =>
    Array.from(element.classList)
      .filter((name) => name.startsWith("elevated-") && name !== "elevated-absolute-edge")
      .join("+");
  const rows = Array.from(container.querySelectorAll("tr.table-row:not(.table-groups-row)"));
  const describeRow = (row) => {
    const id = (row.getAttribute("data-testid") || "").replace(/^table-(row|header)-/, "");
    return `${id}${elevation(row) ? `|${elevation(row)}` : ""}${row.style.bottom ? `|b${row.style.bottom}` : ""}|h${row.style.height}`;
  };
  const describeCell = (cell) => {
    const column = (cell.textContent || "").split(":").pop();
    return `${column}${cell.colSpan > 1 ? `x${cell.colSpan}` : ""}${elevation(cell) ? `|${elevation(cell)}` : ""}|w${cell.style.width}${cell.style.right && cell.style.right !== "0px" ? `|r${cell.style.right}` : ""}${cell.style.paddingRight && cell.style.paddingRight !== "0px" ? `|p${cell.style.paddingRight}` : ""}`;
  };
  const cellsOf = (row) => Array.from(row.querySelectorAll(":scope > [data-testid='table-column']")).map(describeCell);
  const spacer = container.querySelector(".scroller-scrollbar");
  // rows with merged cells do not show the same cells as the others
  const merged = rows.filter((row) => row.querySelector(":scope > [colspan]:not([colspan='1'])"));
  const groups = Array.from(container.querySelectorAll("tr.table-groups-row")).map((row) =>
    Array.from(row.children)
      .map((cell) => `${cell.textContent}x${cell.colSpan}`)
      .join(" "),
  );
  return {
    range: `${spacer.style.minWidth} x ${spacer.style.minHeight}`,
    scroll: `${scroller.scrollTop},${scroller.scrollLeft}`,
    rows: rows.map(describeRow),
    cells: rows[0] ? cellsOf(rows[0]) : [],
    merged: merged.map((row) => `${row.getAttribute("data-testid")}: ${cellsOf(row).join(" ")}`),
    groups,
  };
}

module.exports = { runScenario, describeTable, makeRow, GROUPS };
