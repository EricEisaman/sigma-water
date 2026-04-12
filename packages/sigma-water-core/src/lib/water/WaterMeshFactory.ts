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
    width: 300,
    height: 300,
    subdivisions: 256,
  },
  groundDense: {
    meshType: 'groundDense',
    width: 300,
    height: 300,
    subdivisions: 320,
  },
  groundAdaptive: {
    meshType: 'groundAdaptive',
    width: 300,
    height: 300,
    subdivisions: 256,
  },
};

interface WaterMeshProfile {
  base: IWaterMesh;
  adaptive?: Partial<Record<AdaptiveTier, IWaterMesh>>;
}

function clampMeshScale(meshScale = 1): number {
  return Math.min(Math.max(meshScale, 0.1), 2.0);
}

function withMeshScale(config: IWaterMesh, meshScale = 1): IWaterMesh {
  const scale = clampMeshScale(meshScale);
  return {
    ...config,
    width: config.width * scale,
    height: config.height * scale,
  };
}

const WATER_TYPE_MESH_PROFILES: Record<WaterTypeId, WaterMeshProfile> = {
  gerstnerWaves: {
    base: { meshType: 'groundAdaptive', width: 300, height: 300, subdivisions: 256 },
  },
  oceanWaves: {
    base: { meshType: 'groundAdaptive', width: 300, height: 300, subdivisions: 256 },
  },
  toonWater: {
    base: { meshType: 'groundAdaptive', width: 300, height: 300, subdivisions: 256 },
  },
  tropicalWaves: {
    base: { meshType: 'groundAdaptive', width: 300, height: 300, subdivisions: 256 },
  },
  stormyWaves: {
    base: { meshType: 'groundAdaptive', width: 300, height: 300, subdivisions: 256 },
  },
  glassyWaves: {
    base: { meshType: 'groundAdaptive', width: 300, height: 300, subdivisions: 256 },
  },
  rippleFlux: {
    base: { meshType: 'groundDense', width: 300, height: 300, subdivisions: 320 },
  },
};

type AdaptiveTier = 'near' | 'mid' | 'far';

const ADAPTIVE_TIER_CONFIGS: Record<AdaptiveTier, IWaterMesh> = {
  near: {
    meshType: 'groundAdaptive',
    width: 220,
    height: 220,
    subdivisions: 384,
  },
  mid: {
    meshType: 'groundAdaptive',
    width: 300,
    height: 300,
    subdivisions: 256,
  },
  far: {
    meshType: 'groundAdaptive',
    width: 360,
    height: 360,
    subdivisions: 224,
  },
};

function resolveMeshConfig(waterTypeId: WaterTypeId): IWaterMesh {
  const profile = WATER_TYPE_MESH_PROFILES[waterTypeId];
  if (profile) {
    return profile.base;
  }
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
  cameraPosition?: { x: number; y: number; z: number },
  meshScale = 1,
): { config: IWaterMesh; adaptiveTier?: AdaptiveTier } {
  const profile = WATER_TYPE_MESH_PROFILES[waterTypeId];
  const baseConfig = profile?.base ?? WATER_MESH_CONFIGS[getWaterTypeById(waterTypeId).meshType];
  if (baseConfig.meshType !== 'groundAdaptive') {
    return { config: withMeshScale(baseConfig, meshScale) };
  }

  const tier = resolveAdaptiveTier(cameraPosition);
  const adaptiveConfig = profile?.adaptive?.[tier];
  return {
    config: withMeshScale(adaptiveConfig ?? ADAPTIVE_TIER_CONFIGS[tier], meshScale),
    adaptiveTier: tier,
  };
}

export class WaterMeshFactory {
  public static createWaterMesh(
    waterTypeId: WaterTypeId,
    scene: Scene,
    cameraPosition?: { x: number; y: number; z: number },
    meshScale = 1,
  ): Mesh {
    const normalizedMeshScale = clampMeshScale(meshScale);
    const { config, adaptiveTier } = resolveMeshConfigForContext(waterTypeId, cameraPosition, normalizedMeshScale);
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
      waterMeshWidth: config.width,
      waterMeshHeight: config.height,
      waterMeshSubdivisions: config.subdivisions,
      waterMeshScale: normalizedMeshScale,
    };

    return mesh;
  }

  public static needsMeshRecreation(currentMesh: Mesh, nextWaterTypeId: WaterTypeId, meshScale = 1): boolean {
    const currentType = (currentMesh.metadata?.waterMeshType as WaterMeshTypeId | undefined) ?? 'groundStandard';
    const currentWidth = Number(currentMesh.metadata?.waterMeshWidth ?? 300);
    const currentHeight = Number(currentMesh.metadata?.waterMeshHeight ?? 300);
    const currentSubdivisions = Number(currentMesh.metadata?.waterMeshSubdivisions ?? 256);
    const currentScale = Number(currentMesh.metadata?.waterMeshScale ?? 1);
    const normalizedMeshScale = clampMeshScale(meshScale);
    const nextConfig = withMeshScale(resolveMeshConfig(nextWaterTypeId), normalizedMeshScale);

    return (
      currentType !== nextConfig.meshType ||
      currentWidth !== nextConfig.width ||
      currentHeight !== nextConfig.height ||
      currentSubdivisions !== nextConfig.subdivisions ||
      currentScale !== normalizedMeshScale
    );
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
    cameraPosition?: { x: number; y: number; z: number },
    meshScale = 1,
  ): Mesh {
    const currentMaterial = currentMesh.material;
    if (currentMaterial) {
      currentMaterial.dispose();
    }

    currentMesh.dispose();
    return WaterMeshFactory.createWaterMesh(nextWaterTypeId, scene, cameraPosition, meshScale);
  }
}
