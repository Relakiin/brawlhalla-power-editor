
export const degreesToVector = (degrees: number): { x: number; y: number } => {
  const radians = degrees * (Math.PI / 180);
  return {
    x: Math.cos(radians),
    y: Math.sin(radians),
  };
};

export const vectorToDegrees = (x: number, y: number): number => {
  const angleRad = Math.atan2(y, x);
  return angleRad * (180 / Math.PI);
};
