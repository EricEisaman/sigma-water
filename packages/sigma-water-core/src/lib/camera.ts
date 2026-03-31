export function topDownCameraPosition(height: number): { x: number; y: number; z: number } {
  return {
    x: 0,
    y: Math.max(10, height),
    z: 0.001,
  };
}
