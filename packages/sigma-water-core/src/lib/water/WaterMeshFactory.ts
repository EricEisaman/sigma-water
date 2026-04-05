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
  groundAdaptive: {
    meshType: 'groundAdaptive',
    width: 3000,
    height: 3000,
    subdivisions: 256,
  },
};

type AdaptiveTier = 'near' | 'mid' | 'far';

const ADAPTIVE_TIER_CONFIGS: Record<AdaptiveTier, IWaterMesh> = {
  near: {
    meshType: 'groundAdaptive',
    width: 2200,
    height: 2200,
    subdivisions: 384,
  },
  mid: {
    meshType: 'groundAdaptive',
    width: 3000,
    height: 3000,
    subdivisions: 256,
  },
  far: {
    meshType: 'groundAdaptive',
    width: 3600,
    height: 3600,
    subdivisions: 224,
  },
};

function resolveMeshConfig(waterTypeId: WaterTypeId): IWaterMesh {
  return WATER_MESH_CONFIGS[getWaterTypeById(waterTypeId).meshType];
}

function resolveAdaptiveTier(cameraPosition?: { x: number; y: number; z: number }): AdaptiveTier {
  if (!cameraPosition) return 'mid';

  const horizontalDist = Math.sqrt(cameraPosition.x ** 2 + cameraPosition.z ** 2);
  const heightFactor = Math.max(cameraPosition.y, 0) * 0.35;
  const score = horizontalDist + heightFactor;

  if (score < 220) return 'near';
  if (score < 680) return 'mid';
  return 'far';
}

function resolveMeshConfigForContext(
  waterTypeId: WaterTypeId,
  cameraPosition?: { x: number; y: number; z: number }
): { config: IWaterMesh; adaptiveTier?: AdaptiveTier } {
  const meshType = getWaterTypeById(waterTypeId).meshType;
  if (meshType !== 'groundAdaptive') {
    return { config: WATER_MESH_CONFIGS[meshType] };
  }

  const tier = resolveAdaptiveTier(cameraPosition);
  return {
    config: ADAPTIVE_TIER_CONFIGS[tier],
    adaptiveTier: tier,
  };
}

export class WaterMeshFactory {
  public static createWaterMesh(
    waterTypeId: WaterTypeId,
    scene: Scene,
    cameraPosition?: { x: number; y: number; z: number }
  ): Mesh {
    const { config, adaptiveTier } = resolveMeshConfigForContext(waterTypeId, cameraPosition);
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
      waterAdaptiveTier: adaptiveTier,
    };

    return mesh;
  }

  public static needsMeshRecreation(currentMesh: Mesh, nextWaterTypeId: WaterTypeId): boolean {
    const currentType = (currentMesh.metadata?.waterMeshType as WaterMeshTypeId | undefined) ?? 'groundStandard';
    const nextType = resolveMeshConfig(nextWaterTypeId).meshType;
    return currentType !== nextType;
  }

  public static needsAdaptiveRetier(
    currentMesh: Mesh,
    currentWaterTypeId: WaterTypeId,
    cameraPosition: { x: number; y: number; z: number }
  ): boolean {
    const meshType = getWaterTypeById(currentWaterTypeId).meshType;
    if (meshType !== 'groundAdaptive') {
      return false;
    }

    const currentTier = (currentMesh.metadata?.waterAdaptiveTier as AdaptiveTier | undefined) ?? 'mid';
    const nextTier = resolveAdaptiveTier(cameraPosition);
    return currentTier !== nextTier;
  }

  public static replaceWaterMesh(
    currentMesh: Mesh,
    nextWaterTypeId: WaterTypeId,
    scene: Scene,
    cameraPosition?: { x: number; y: number; z: number }
  ): Mesh {
    const currentMaterial = currentMesh.material;
    if (currentMaterial) {
      currentMaterial.dispose();
    }

    currentMesh.dispose();
    return WaterMeshFactory.createWaterMesh(nextWaterTypeId, scene, cameraPosition);
  }
}
