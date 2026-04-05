import { boostedCameraSpeed, topDownCameraPosition } from './camera';

describe('camera helpers', () => {
  test('topDownCameraPosition clamps minimum height', () => {
    expect(topDownCameraPosition(5)).toEqual({ x: 0, y: 10, z: 0.001 });
    expect(topDownCameraPosition(42)).toEqual({ x: 0, y: 42, z: 0.001 });
  });

  test('boostedCameraSpeed applies exact 4x multiplier when active', () => {
    expect(boostedCameraSpeed(0.5, false, 4)).toBe(0.5);
    expect(boostedCameraSpeed(0.5, true, 4)).toBe(2.0);
  });

  test('boostedCameraSpeed handles invalid values safely', () => {
    expect(boostedCameraSpeed(-1, true, 4)).toBe(0);
    expect(boostedCameraSpeed(Number.NaN, true, 4)).toBe(0);
    expect(boostedCameraSpeed(0.5, true, 0)).toBe(0.5);
  });
});
