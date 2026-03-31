import { Mesh, MeshBuilder, Scene } from '@babylonjs/core';
import { getWaterTypeById, type WaterMeshTypeId, type WaterTypeId } from '../../water/WaterTypeRegistry';

/**
 * Base contract for all water mesh configurations.
 * Any new mesh type must satisfy this interface.
 */
export interface IWaterMesh {
  meshType: WaterMeshTypeId;
  width: number;
  height: number;
  subdivisions: number;
}

/**
 * Backward-compatible alias.
 */
export type IWaterMeshConfig = IWaterMesh;

const WATER_MESH_CONFIGS: Record<WaterMeshTypeId, IWaterMesh> = {
  groundStandard: {
    meshType: 'groundStandard',
    width: 3000,
    height: 3000,
    subdivisions: 256,
  },
  groundDense: {
    meshType: 'groundDense',
    width: 3000,
    height: 3000,
    subdivisions: 320,
  },
};

function resolveMeshConfig(waterTypeId: WaterTypeId): IWaterMesh {
  return WATER_MESH_CONFIGS[getWaterTypeById(waterTypeId).meshType];
}

export class WaterMeshFactory {
  public static createWaterMesh(waterTypeId: WaterTypeId, scene: Scene): Mesh {
    const config = resolveMeshConfig(waterTypeId);
    const mesh = MeshBuilder.CreateGround('ocean', {
      width: config.width,
      height: config.height,
      subdivisions: config.subdivisions,
    }, scene);

    mesh.receiveShadows = true;
    mesh.isVisible = true;
    mesh.setEnabled(true);
    mesh.position.y = 0;
    mesh.metadata = {
      ...(mesh.metadata || {}),
      waterMeshType: config.meshType,
      waterShaderId: waterTypeId,
    };

    return mesh;
  }

  public static needsMeshRecreation(currentMesh: Mesh, nextWaterTypeId: WaterTypeId): boolean {
    const currentType = (currentMesh.metadata?.waterMeshType as WaterMeshTypeId | undefined) ?? 'groundStandard';
    const nextType = resolveMeshConfig(nextWaterTypeId).meshType;
    return currentType !== nextType;
  }

  public static replaceWaterMesh(currentMesh: Mesh, nextWaterTypeId: WaterTypeId, scene: Scene): Mesh {
    const currentMaterial = currentMesh.material;
    if (currentMaterial) {
      currentMaterial.dispose();
    }

    currentMesh.dispose();
    return WaterMeshFactory.createWaterMesh(nextWaterTypeId, scene);
  }
}
