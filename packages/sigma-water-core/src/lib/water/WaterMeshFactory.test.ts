import { WaterMeshFactory, type IWaterMesh } from './WaterMeshFactory';

describe('WaterMeshFactory contracts', () => {
  test('IWaterMesh base contract shape is stable', () => {
    const meshConfig: IWaterMesh = {
      meshType: 'groundStandard',
      width: 3000,
      height: 3000,
      subdivisions: 256,
    };

    expect(meshConfig.width).toBeGreaterThan(0);
    expect(meshConfig.height).toBeGreaterThan(0);
    expect(meshConfig.subdivisions).toBeGreaterThan(0);
  });

  test('needsMeshRecreation compares metadata mesh types', () => {
    const currentMesh = {
      metadata: {
        waterMeshType: 'groundStandard',
      },
    } as any;

    expect(WaterMeshFactory.needsMeshRecreation(currentMesh, 'gerstnerWaves')).toBe(true);
    expect(WaterMeshFactory.needsMeshRecreation(currentMesh, 'oceanWaves')).toBe(true);
  });

  test('needsMeshRecreation defaults unknown metadata to groundStandard', () => {
    const currentMesh = { metadata: {} } as any;

    expect(WaterMeshFactory.needsMeshRecreation(currentMesh, 'gerstnerWaves')).toBe(true);
    expect(WaterMeshFactory.needsMeshRecreation(currentMesh, 'oceanWaves')).toBe(true);
  });

  test('needsAdaptiveRetier reacts to camera distance bands for adaptive types', () => {
    const currentMesh = {
      metadata: {
        waterMeshType: 'groundAdaptive',
        waterAdaptiveTier: 'mid',
      },
    } as any;

    expect(
      WaterMeshFactory.needsAdaptiveRetier(currentMesh, 'oceanWaves', { x: 0, y: 40, z: 0 })
    ).toBe(true);

    expect(
      WaterMeshFactory.needsAdaptiveRetier(currentMesh, 'oceanWaves', { x: 320, y: 80, z: 260 })
    ).toBe(false);
  });
});
