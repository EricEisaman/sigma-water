export interface OrbitTarget {
  x: number;
  z: number;
}

export function orbitCameraPosition(
  target: OrbitTarget,
  angleDeg: number,
  distance: number,
  height: number
): { x: number; y: number; z: number } {
  const angleRad = (angleDeg * Math.PI) / 180;
  return {
    x: target.x + Math.cos(angleRad) * distance,
    y: height,
    z: target.z + Math.sin(angleRad) * distance,
  };
}

export function topDownCameraPosition(height: number): { x: number; y: number; z: number } {
  return {
    x: 0,
    y: Math.max(0, height),
    z: 0.001,
  };
}
