import * as React from "react";

import { ITree, ITrees } from "../components/table/elementary-table";
import { IRow } from "../components/table/row";
import { syncOpenedTreesWithRows } from "../components/utils/table";

export interface IOpenedTreesController {
  openedTrees: ITrees;
  openRow: (openedTree: ITree) => void;
  closeRow: (closedTree: ITree) => void;
  openTrees: (trees: ITrees) => void;
  closeTrees: (trees: ITrees) => void;
  getOpenedTrees: () => ITrees;
}

/**
 * Opened rows of a table. The trees are kept in sync with the rows: a tree is dropped as
 * soon as its row has no more sub-rows. `onUpdate` is called after the render is committed,
 * once per requested change, never for a tree dropped by a change of rows.
 */
export function useOpenedTrees(initialTrees: ITrees, rows: IRow[], onUpdate?: (trees: ITrees) => void): IOpenedTreesController {
  const [openedTrees, setOpenedTrees] = React.useState<ITrees>(() => syncOpenedTreesWithRows(initialTrees, rows));
  // Rows appended to the same array are seen by their number
  const [synced, setSynced] = React.useState({ rows, length: rows.length });
  if (synced.rows !== rows || synced.length !== rows.length) {
    setSynced({ rows, length: rows.length });
    setOpenedTrees((trees) => syncOpenedTreesWithRows(trees, rows));
  }

  // Last committed values, plus the trees requested since then: two changes requested in
  // the same tick must build on each other.
  const latest = React.useRef({ trees: openedTrees, rows, onUpdate });
  const requested = React.useRef<ITrees[]>([]);

  React.useLayoutEffect(() => {
    latest.current = { trees: openedTrees, rows, onUpdate };
  });

  React.useEffect(() => {
    if (requested.current.length === 0) return;
    const changes = requested.current;
    requested.current = [];
    changes.forEach((trees) => latest.current.onUpdate?.(trees));
  });

  const change = React.useCallback((getNextTrees: (trees: ITrees) => ITrees | null) => {
    const nextTrees = getNextTrees(latest.current.trees);
    if (!nextTrees) return;
    const syncedTrees = syncOpenedTreesWithRows(nextTrees, latest.current.rows);
    latest.current.trees = syncedTrees;
    requested.current.push(nextTrees);
    setOpenedTrees(syncedTrees);
  }, []);

  const actions = React.useMemo(
    () => ({
      openRow: (openedTree: ITree) => change((trees) => ({ ...trees, [openedTree.rowIndex]: openedTree })),
      closeRow: (closedTree: ITree) =>
        change((trees) => (closedTree.rowIndex in trees ? withoutTrees(trees, [closedTree.rowIndex]) : null)),
      openTrees: (trees: ITrees) => change((current) => ({ ...current, ...trees })),
      closeTrees: (trees: ITrees) => change((current) => withoutTrees(current, Object.keys(trees).map(Number))),
      getOpenedTrees: () => latest.current.trees,
    }),
    [change],
  );

  return { openedTrees, ...actions };
}

function withoutTrees(trees: ITrees, rowIndexes: number[]): ITrees {
  const nextTrees = { ...trees };
  rowIndexes.forEach((rowIndex) => delete nextTrees[rowIndex]);
  return nextTrees;
}
