import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { useTableInteractionsManager } from "../../src/components/table-interactions-manager/table-interactions-manager";
import { Application, columnId, COLUMNS_COUNT, PAGE_SIZE } from "../stories-components/application-table";

const meta: Meta<typeof Application> = {
  title: "Recipes/Application table",
  component: Application,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: `
A table wired the way a data application does it:

- a \`TableInteractionsManager\` around the table: pinned and hidden columns, hidden rows, columns cursor;
- custom group cells (\`groupsProps.CustomGroupCell\`) that read the visible window with \`useVirtualizerManager\`;
- a custom sub-rows toggle (\`SubRowsToggleButtonComponent\`);
- the next page loaded when the scroll reaches the bottom (\`onVerticallyScroll\`);
- the size given by the container.

The source is \`stories/stories-components/application-table.tsx\`.
        `,
      },
    },
  },
};

export default meta;

const LAST_COLUMN = COLUMNS_COUNT - 1;
const MAX_PAGES = 5;

/** What a toolbar of the application does, through the manager. */
function Toolbar({ pages, isLoadingMore }: { pages: number; isLoadingMore: boolean }) {
  const {
    columnsCursor,
    fixedColumnsIds,
    hiddenColumnsIds,
    updateFixedColumnsIds,
    updateHiddenIds,
    goToColumnId,
    openTrees,
    closeTrees,
  } = useTableInteractionsManager();
  const lastColumnId = columnId(LAST_COLUMN);
  const isLastPinned = fixedColumnsIds.includes(lastColumnId);
  const openableRows = Array.from({ length: pages * PAGE_SIZE }, (_, index) => index).filter((index) => index % 5 === 0);
  // a tree is keyed by the index of its row in the table: the header is the first row
  const trees = Object.fromEntries(openableRows.map((index) => [index + 1, { rowIndex: index + 1, columnIndex: 1 }]));
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8, font: "13px sans-serif" }}>
      <button
        type="button"
        data-testid="pin-last-column"
        onClick={() =>
          updateFixedColumnsIds(
            isLastPinned ? fixedColumnsIds.filter((id) => id !== lastColumnId) : [...fixedColumnsIds, lastColumnId],
          )
        }
      >
        {isLastPinned ? "Unpin" : "Pin"} the last column
      </button>
      <button type="button" data-testid="pin-identity" onClick={() => updateFixedColumnsIds([columnId(1), ...fixedColumnsIds])}>
        Pin “Column 1”
      </button>
      <button
        type="button"
        data-testid="show-all-columns"
        onClick={() => updateHiddenIds([])}
        disabled={hiddenColumnsIds.length === 0}
      >
        Show hidden columns ({hiddenColumnsIds.length})
      </button>
      <button type="button" data-testid="go-to-column" onClick={() => goToColumnId(columnId(15))}>
        Go to “Column 15”
      </button>
      <button type="button" data-testid="expand-all" onClick={() => openTrees(trees)}>
        Expand all
      </button>
      <button type="button" data-testid="collapse-all" onClick={() => closeTrees(trees)}>
        Collapse all
      </button>
      <span data-testid="status">
        cursor: {columnsCursor ? columnsCursor.id : "—"} · pages: {pages}
        {isLoadingMore ? " · loading…" : ""}
      </span>
    </div>
  );
}

function PagedApplication() {
  const [pages, setPages] = React.useState(1);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const loadMore = React.useCallback(() => {
    if (pages >= MAX_PAGES) return;
    setIsLoadingMore(true);
    window.setTimeout(() => {
      setPages((current) => current + 1);
      setIsLoadingMore(false);
    }, 400);
  }, [pages]);

  return (
    <div id="table-container" style={{ height: "calc(100vh - 100px)", minHeight: 320, width: "100%" }}>
      <Application pages={pages} isLoadingMore={isLoadingMore} onLoadMore={loadMore}>
        <Toolbar pages={pages} isLoadingMore={isLoadingMore} />
      </Application>
    </div>
  );
}

export const Default: StoryObj = {
  name: "Manager, groups, pinned columns, paging",
  render: () => <PagedApplication />,
};
