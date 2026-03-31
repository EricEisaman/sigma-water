import { orbitCameraPosition, topDownCameraPosition } from './cameraOrbit';

describe('cameraOrbit', () => {
  test('orbitCameraPosition computes x/z around target', () => {
    const p0 = orbitCameraPosition({ x: 22, z: 10 }, 0, 100, 50);
    expect(p0).toEqual({ x: 122, y: 50, z: 10 });

    const p90 = orbitCameraPosition({ x: 22, z: 10 }, 90, 100, 50);
    expect(p90.x).toBeCloseTo(22, 6);
    expect(p90.y).toBe(50);
    expect(p90.z).toBeCloseTo(110, 6);
  });

  test('topDownCameraPosition clamps minimum height', () => {
    expect(topDownCameraPosition(5)).toEqual({ x: 0, y: 10, z: 0.001 });
    expect(topDownCameraPosition(260)).toEqual({ x: 0, y: 260, z: 0.001 });
  });
});
