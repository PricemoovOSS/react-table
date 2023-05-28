import { clone, cloneDeep } from "lodash";
import { IColumns } from "../table";

export interface Group {
  id: string;
  label?: string;
  subGroups?: Group[];
}

export interface GroupBranche extends Group {
  size: number;
  subGroups?: GroupBranche[];
}

const DEFAULT_GROUP_ID = "default-group-id";

/**
 *
 * @param groups the list of raw groups
 * @returns the max depth of the groups, and all the branches of the groups
 */
export function getGroupBranches(groups: Group[] = []): {
  depth: number;
  groupBranches: Record<string, GroupBranche> | undefined;
} {
  if (groups.length === 0) {
    return { depth: 0, groupBranches: undefined };
  }

  const clonedGroups = cloneDeep(groups);
  // add the default group for columns without group
  clonedGroups.push({ id: DEFAULT_GROUP_ID, label: "" });
  const depth = equalizeGroupDepths(clonedGroups);

  const branches = groupsToBranches(clonedGroups);
  const groupBranches = branches.reduce((acc, branche) => {
    const leaves = getLeaves(branche);
    acc[leaves[0].id] = branche;
    return acc;
  }, {});
  return { depth, groupBranches };
}

/**
 * Each column is associated with a given branch.
 * Branches must be merged to reconstitute groups consistent with the visible columns.
 * @param branches the list of alll branches
 * @returns Groups with their sizes
 */
export function getMergedBranches(branches: GroupBranche[]): GroupBranche[] {
  let currentBranche: GroupBranche;
  const result: GroupBranche[] = [];
  branches.forEach((branche, index) => {
    if (!currentBranche || currentBranche.id !== branche.id) {
      if (currentBranche) {
        result.push(currentBranche);
      }
      currentBranche = branche;
    } else if (currentBranche) {
      currentBranche = mergeBranches(branche, currentBranche);
      currentBranche.size += branche.size;
    }
    if (index === branches.length - 1) {
      result.push(currentBranche);
    }
  });

  return result;
}

/**
 *
 * @param groupBranches raw branches
 * @param columns columns options
 * @param visibleColumnIndexes the current visible cell indexes
 * @returns the list of branches associated with each specified column
 */
export function getColumnBranches(
  groupBranches: Record<string, GroupBranche>,
  columns: IColumns = {},
  visibleColumnIndexes: number[] = []
): GroupBranche[] {
  return visibleColumnIndexes.reduce<GroupBranche[]>((acc, cellIndex) => {
    const column = columns[cellIndex];
    const groupId = column?.groupId || DEFAULT_GROUP_ID;
    const branche = groupBranches[groupId];
    if (branche) {
      acc.push(cloneDeep(branche));
    }
    return acc;
  }, []);
}

function equalizeGroupDepths(groups: Group[], depth = 0): number {
  const hasSubGroup = groups.some((group) => group.subGroups && group.subGroups.length > 0);
  if (hasSubGroup) {
    const subGroups: Group[] = [];
    groups.forEach((group) => {
      if (!group.subGroups || group.subGroups.length === 0) {
        group.subGroups = [{ id: group.id, label: "" }];
        group.id = `${group.id}-root-${depth}`;
      }
      subGroups.push(...(group.subGroups as Group[]));
    });
    return equalizeGroupDepths(subGroups, depth + 1);
  }
  return depth + 1;
}

function groupsToBranches(groups: Group[]): GroupBranche[] {
  return groups.reduce<GroupBranche[]>((acc, group) => {
    const subBranches = groupsToBranches(group.subGroups || []);
    if (subBranches.length > 0) {
      subBranches.forEach((subBranche) => {
        const newGroup = clone(group) as GroupBranche;
        newGroup.size = 1;
        newGroup.subGroups = [subBranche];
        acc.push(newGroup);
      });
    } else {
      const newGroup = clone(group) as GroupBranche;
      newGroup.size = 1;
      acc.push(newGroup);
    }

    return acc;
  }, []);
}

function getLeaves(group: GroupBranche): GroupBranche[] {
  if (!group.subGroups || group.subGroups.length === 0) {
    return [group];
  }
  return group.subGroups.reduce<GroupBranche[]>((acc, subGroup) => {
    acc.push(...getLeaves(subGroup));
    return acc;
  }, []);
}

function mergeBranches(source: GroupBranche, target: GroupBranche): GroupBranche {
  if (source.subGroups && source.subGroups.length > 0) {
    const sourceSubBranche = source.subGroups.shift() as GroupBranche;
    const targetSubBranche = target.subGroups?.pop() as GroupBranche;
    if (sourceSubBranche.id === targetSubBranche.id) {
      const mergedBranche = mergeBranches(sourceSubBranche, targetSubBranche);
      mergedBranche.size = sourceSubBranche.size + targetSubBranche.size;
      target.subGroups?.push(mergedBranche, ...source.subGroups);
    } else {
      target.subGroups?.push(targetSubBranche, sourceSubBranche, ...source.subGroups);
    }
  }
  return target;
}
