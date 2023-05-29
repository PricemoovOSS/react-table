/// <reference path="../typings/tests-entry.d.ts" />

import { IColumns } from "../../src/components";
import { GroupBranch, getColumnBranches, getGroupBranches, getMergedBranches } from "../../src/components/utils";

const groups = [
  { id: "group1", label: "Group 1", subGroups: [{ id: "subgroup-1", label: "Sub-Group 1.1" }] },
  {
    id: "group2",
    label: "Group 2",
    subGroups: [
      { id: "subgroup-2", label: "Sub-Group 2.1" },
      {
        id: "subgroup-3",
        label: "Sub-Group 2.2",
        subGroups: [
          { id: "subgroup-4", label: "Sub-Group 2.2.1" },
          { id: "subgroup-5", label: "Sub-Group 2.2.2" },
        ],
      },
    ],
  },
];

const columns: IColumns = {
  0: { groupId: "subgroup-1" },
  1: { groupId: "subgroup-1" },
  3: { groupId: "subgroup-2" },
  4: { groupId: "subgroup-5" },
  5: { groupId: "subgroup-5" },
};

describe("Grou utils", () => {
  test("should return not empty branches list", () => {
    const { depth, groupBranches } = getGroupBranches(groups);
    expect(depth).toEqual(3);
    expect(groupBranches).toMatchSnapshot();
  });

  test("should return empty branches", () => {
    const { depth, groupBranches } = getGroupBranches();
    expect(depth).toEqual(0);
    expect(groupBranches).toBeUndefined();

    const { depth: emptyDepth, groupBranches: emptyBranches } = getGroupBranches([]);
    expect(emptyDepth).toEqual(0);
    expect(emptyBranches).toBeUndefined();
  });

  test("should return visible column branches", () => {
    const { groupBranches } = getGroupBranches(groups);
    const result = getColumnBranches(groupBranches as Record<string, GroupBranch>, columns, [0, 1, 2, 3, 4, 5, 6]);
    expect(result).toMatchSnapshot();
  });

  test("should return empty column branches list", () => {
    const { groupBranches } = getGroupBranches(groups);
    const result = getColumnBranches(groupBranches as Record<string, GroupBranch>, columns, []);
    expect(result).toEqual([]);
  });

  test("should return column branches (only default branche)", () => {
    const { groupBranches } = getGroupBranches(groups);
    let result = getColumnBranches(groupBranches as Record<string, GroupBranch>, columns, [10, 11, 12]);
    expect(result).toMatchSnapshot();
    result = getColumnBranches(groupBranches as Record<string, GroupBranch>, {}, [1, 2, 3, 4]);
    expect(result).toMatchSnapshot();
  });

  test("should return visible merged column branches", () => {
    const { groupBranches } = getGroupBranches(groups);
    const result = getColumnBranches(groupBranches as Record<string, GroupBranch>, columns, [0, 1, 2, 3, 4, 5, 6]);
    const mergedBranches = getMergedBranches(result);
    expect(mergedBranches).toMatchSnapshot();
  });
});
