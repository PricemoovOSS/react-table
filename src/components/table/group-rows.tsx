import { computeRowStyle } from "../utils";
import { GroupBranche } from "../utils/group";
import { IRowOptions } from "./row";

export interface GroupRowsProps {
  rowsOptions?: IRowOptions;
  rowsStyle?: Omit<React.CSSProperties, "height">;
  /** cell content replacing the display of the group */
  CustomGroupCell?: React.ComponentType<any>;
}

interface GroupRowProps extends GroupRowsProps {
  groups: GroupBranche[];
}

export interface GroupCellProps {
  group: GroupBranche;
  className?: string;
  index: number;
  groups?: GroupBranche[];
}

function GroupCell({ className, group }: GroupCellProps) {
  return (
    <th className={className} colSpan={group.size}>
      {group.label}
    </th>
  );
}

function GroupRows({ groups, ...customProps }: GroupRowProps) {
  const { CustomGroupCell = GroupCell, rowsOptions, rowsStyle } = customProps;
  return groups.length > 0 ? (
    <>
      <tr className="table-row table-groups-row head" style={computeRowStyle(rowsOptions, rowsStyle)}>
        {groups.map((group, index) => {
          return (
            <CustomGroupCell
              className="table-column table-group"
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
  ) : null;
}

export default GroupRows;
