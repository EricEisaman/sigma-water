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

    expect(WaterMeshFactory.needsMeshRecreation(currentMesh, 'gerstnerWaves')).toBe(false);
    expect(WaterMeshFactory.needsMeshRecreation(currentMesh, 'oceanWaves')).toBe(true);
  });

  test('needsMeshRecreation defaults unknown metadata to groundStandard', () => {
    const currentMesh = { metadata: {} } as any;

    expect(WaterMeshFactory.needsMeshRecreation(currentMesh, 'gerstnerWaves')).toBe(false);
    expect(WaterMeshFactory.needsMeshRecreation(currentMesh, 'oceanWaves')).toBe(true);
  });
});
