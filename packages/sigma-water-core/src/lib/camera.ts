export function topDownCameraPosition(height: number): { x: number; y: number; z: number } {
  return {
    x: 0,
    y: Math.max(10, height),
    z: 0.001,
  };
}

export function boostedCameraSpeed(baseSpeed: number, isBoostActive: boolean, boostMultiplier = 4): number {
  if (!Number.isFinite(baseSpeed) || baseSpeed <= 0) {
    return 0;
  }

  if (!Number.isFinite(boostMultiplier) || boostMultiplier <= 0) {
    return baseSpeed;
  }

  return isBoostActive ? baseSpeed * boostMultiplier : baseSpeed;
}
