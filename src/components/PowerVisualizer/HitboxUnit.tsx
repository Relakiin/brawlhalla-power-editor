interface HitboxUnitProps {
  rx: number;
  ry: number;
  cx: number;
  cy: number;
  fill: string;
  vx: string | undefined;
  vy: string | undefined;
}

const HitboxUnit: React.FC<HitboxUnitProps> = ({
  rx,
  ry,
  cx,
  cy,
  fill,
  vx,
  vy,
}) => {
  // check if power has interpolated vector over cast time
  const parseVector = (vector: string | undefined) => {
    return vector?.split("~").map((v) => parseFloat(v)) || [];
  };

  const vxValues = parseVector(vx);
  const vyValues = parseVector(vy);

  const maxLength = Math.max(vxValues.length, vyValues.length);

  const drawStar = (
    cx: number,
    cy: number,
    outerRadius: number,
    innerRadius: number
  ) => {
    const points = [];
    const numPoints = 5; // 5-pointed star
    for (let i = 0; i < numPoints * 2; i++) {
      const angle = (Math.PI / numPoints) * i;
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const x = cx + radius * Math.cos(angle);
      const y = cy + radius * Math.sin(angle);
      points.push(`${x},${y}`);
    }
    return points.join(" ");
  };

  const scaleToEllipseEdge = (x: number, y: number) => {
    const dx = x - cx;
    const dy = y - cy;

    // scale factor to bring the point to the ellipse's edge
    const scale = Math.sqrt((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry));

    return {
      x: cx + dx / scale,
      y: cy + dy / scale,
    };
  };

  return (
    <>
      {/* hitbox */}
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={fill} fillOpacity={0.2} />

      {/* direction line */}
      {Array.from({ length: maxLength }).map((_, index) => {
        let vxValue = vxValues[index];
        let vyValue = vyValues[index];

        console.log("PREPROCESS VECTOR VALUES - ", vxValue, vyValue)

        // some moves have angles that depend on the enemy's position, here's what i could find in common
        // draw a star if both vx and vy are 0
        if (vxValue === 0 && vyValue === 0) {
          return (
            <polygon
              key={index}
              points={drawStar(cx, cy, 10, 5)} 
              fill="none"
              stroke="white"
              strokeWidth="2"
            />
          );
        }

        // draw a star if vx is missing but vy is set (check if previous vxvalue is set in case of interpolating vector)
        if (!vxValue && vyValue && !vxValues[index - 1]) {
          return (
            <polygon
              key={index}
              points={drawStar(cx, cy, 10, 5)}
              fill="none"
              stroke="white"
              strokeWidth="2"
            />
          );
        }
        // some moves can spike but others don't...
        // TODO: figure out above

        // skip drawing the line if both values are missing (mostly happens on grabs)
        if (!vxValue && !vyValue) {
          return null;
        }
        
        vxValue = vxValue ?? vxValues[0] ?? cx;
        vyValue = vyValue ?? vyValues[0] ?? cy;
        
        console.log("POSTPROCESS VECTOR VALUES - ", vxValue, vyValue)
        
        const directionX = cx + vxValue;
        const directionY = cy + vyValue;

        // adjust the endpoint to lie on the ellipse's edge
        const { x: adjustedX, y: adjustedY } = scaleToEllipseEdge(
          directionX,
          directionY
        );

        return (
          <line
            key={index}
            x1={cx}
            y1={cy}
            x2={adjustedX}
            y2={adjustedY}
            stroke={index % 2 === 0 ? "white" : "blue"} // draw interpolated line in blue
            strokeWidth="3"
            strokeOpacity={0.5}
          />
        );
      })}
    </>
  );
};

export default HitboxUnit;
