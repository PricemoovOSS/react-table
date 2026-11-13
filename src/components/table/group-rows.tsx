import classNames from "classnames";

import { computeRowStyle } from "../utils";
import { GroupBranch } from "../utils/group";
import { IRowOptions } from "./row";

export interface GroupCellProps {
  group: GroupBranch;
  className?: string;
  index: number;
  groups?: GroupBranch[];
  /**
   * Place of the cell when its columns are fixed at the end of the table (`right`, `width`,
   * `height`): to spread on the `<th>` of a custom cell.
   */
  style?: React.CSSProperties;
}

export interface GroupRowsProps {
  rowsOptions?: IRowOptions;
  rowsStyle?: Omit<React.CSSProperties, "height">;
  /** cell content replacing the display of the group */
  CustomGroupCell?: React.ComponentType<GroupCellProps>;
}

interface GroupRowProps extends GroupRowsProps {
  groups: GroupBranch[];
}

function GroupCell({ className, group, style }: GroupCellProps) {
  return (
    <th className={className} colSpan={group.size} style={style}>
      {group.label}
    </th>
  );
}

/** A group of columns fixed at the end leaves the flow with them: it needs explicit sizes. */
function getFixedEndStyle(group: GroupBranch, rowHeight: React.CSSProperties["height"]): React.CSSProperties | undefined {
  return group.fixedEnd ? { right: group.fixedEnd.right, width: group.fixedEnd.width, height: rowHeight } : undefined;
}

/** The first of the groups fixed at the end: it draws their relief. */
const isFixedEndEdge = (groups: GroupBranch[], index: number) =>
  !!groups[index].fixedEnd && index > 0 && !groups[index - 1].fixedEnd;

function GroupRows({ groups, ...customProps }: GroupRowProps) {
  const { CustomGroupCell = GroupCell, rowsOptions, rowsStyle } = customProps;
  if (groups.length === 0) return null;
  const rowStyle = computeRowStyle(rowsOptions, rowsStyle);
  return (
    <>
      <tr className="table-row table-groups-row head" style={rowStyle}>
        {groups.map((group, index) => {
          return (
            <CustomGroupCell
              className={classNames("table-column table-group", {
                "elevated-absolute": !!group.fixedEnd,
                "elevated-absolute-edge": isFixedEndEdge(groups, index),
                // not `elevated-start`: style sheets written for 4.x target that class on cells, next to
                // which a group cell would start matching their rules
                "elevated-start-edge": group.isFixedStartEdge,
              })}
              style={getFixedEndStyle(group, rowStyle.height)}
              key={`${group.id}-${index}`}
              group={group}
              groups={groups}
              index={index}
            />
          );
        })}
      </tr>
      <GroupRows {...customProps} groups={groups.map((group) => group.subGroups || []).flat()} />
    </>
  );
}

export default GroupRows;
