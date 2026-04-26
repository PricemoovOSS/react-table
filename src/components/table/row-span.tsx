import * as React from "react";
import IconButton from "@mui/material/IconButton";
import Icon from "@mui/material/Icon";

import { ROW_SPAN_WIDTH } from "../constants";

export interface IRowSpan {
  /** Title rendered in the span column when opened */
  title?: string;
  /** Width of the span cell */
  width?: number;
  /** Height of the span cell */
  height?: number;
  /** Background color of the colored left border */
  color?: string;
}

export interface IRowSpanProps extends IRowSpan {
  toggle: () => void;
  opened: boolean;
  /** Number of rows the span covers */
  length: number;
}

const RowSpan: React.FC<IRowSpanProps> = ({
  toggle,
  opened,
  length,
  title,
  width = ROW_SPAN_WIDTH,
  height,
  color = "initial",
}) => (
  <td
    className="table-column row-span-column"
    rowSpan={length}
    style={{ minWidth: width, maxWidth: width, width, borderLeft: `solid 15px ${color}` }}
  >
    <div style={height ? { height } : undefined} className="row-span-container">
      <div className="row-span-text">{title}</div>
      <IconButton data-testid="table-toggle-row-btn" onClick={toggle} size="large">
        <Icon>{opened ? "keyboard_arrow_down" : "keyboard_arrow_right"}</Icon>
      </IconButton>
    </div>
  </td>
);

export default RowSpan;
