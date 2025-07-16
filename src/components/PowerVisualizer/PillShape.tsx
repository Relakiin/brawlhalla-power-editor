import React from "react";

interface PillShapeProps {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  fill?: string;
  fillOpacity?: number;
  stroke?: string;
  strokeWidth?: number;
  outlineOnly?: boolean;
}

const PillShape: React.FC<PillShapeProps> = ({
  cx,
  cy,
  rx,
  ry,
  fill,
  fillOpacity = 0.2,
  stroke,
  strokeWidth,
  outlineOnly = false,
}) => {
  return (
    <path
      d={
        rx >= ry
          ? // Horizontal pill
            `M ${cx - rx + ry},${cy - ry} ` + // Start at top-left of rectangle
            `h ${(rx - ry) * 2} ` + // Draw top edge of rectangle
            `a ${ry},${ry} 0 0 1 0,${ry * 2} ` + // Draw right semicircle
            `h ${-(rx - ry) * 2} ` + // Draw bottom edge of rectangle
            `a ${ry},${ry} 0 0 1 0,${-ry * 2}` // Draw left semicircle
          : // Vertical pill
            `M ${cx - rx},${cy - ry + rx} ` + // Start at left-top of rectangle
            `a ${rx},${rx} 0 0 1 ${rx * 2},0 ` + // Draw top semicircle
            `v ${(ry - rx) * 2} ` + // Draw right edge of rectangle
            `a ${rx},${rx} 0 0 1 ${-rx * 2},0 ` + // Draw bottom semicircle
            `v ${-(ry - rx) * 2}` // Draw left edge of rectangle
      }
      fill={outlineOnly ? 'none' : fill}
      fillOpacity={outlineOnly ? 0 : fillOpacity}
      stroke={outlineOnly ? (fill || stroke) : stroke}
      strokeWidth={outlineOnly ? (strokeWidth || 2) : strokeWidth}
    />
  );
};

export default PillShape;
