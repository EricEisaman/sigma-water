/**
 * Sigma Water Core - Water Type Registry
 *
 * Framework-agnostic runtime definitions. This module must remain React-free.
 */

/**
 * Base contract for all water types in the system.
 * Any new water type must satisfy this interface.
 */
export interface IWater {
  readonly id: string;
  readonly meshType: WaterMeshTypeId;
  readonly displayName: string;
  readonly description: string;
  readonly supportsFoam: boolean;
  readonly supportsCaustics: boolean;
  readonly shaderControlKeys: readonly ShaderControlKey[];
}

/**
 * Backward-compatible alias.
 */
export type IWaterType = IWater;

export type WaterMeshTypeId = 'groundStandard' | 'groundDense' | 'groundAdaptive';

export type ShaderControlKey =
  | 'waveAmplitude'
  | 'waveFrequency'
  | 'windDirection'
  | 'windSpeed'
  | 'crestFoamEnabled'
  | 'crestFoamThreshold'
  | 'foamIntensity'
  | 'foamWidth'
  | 'foamNoiseFactor'
  | 'foamCellScale'
  | 'foamShredSlope'
  | 'foamFizzWeight'
  | 'intersectionFoamEnabled'
  | 'intersectionFoamIntensity'
  | 'intersectionFoamWidth'
  | 'intersectionFoamFalloff'
  | 'intersectionFoamNoise'
  | 'intersectionFoamVerticalRange'
  | 'underwaterEnabled'
  | 'underwaterTransitionDepth'
  | 'underwaterFogDensity'
  | 'underwaterHorizonMix'
  | 'underwaterColorR'
  | 'underwaterColorG'
  | 'underwaterColorB'
  | 'toonShadowColorR'
  | 'toonShadowColorG'
  | 'toonShadowColorB'
  | 'toonMidColorR'
  | 'toonMidColorG'
  | 'toonMidColorB'
  | 'toonLightColorR'
  | 'toonLightColorG'
  | 'toonLightColorB'
  | 'causticIntensity'
  | 'specularIntensity'
  | 'skyReflectionMix'
  | 'normalDetailStrength'
  | 'normalDistanceFalloff'
  | 'depthFadeDistance'
  | 'depthFadeExponent';

export const SHADER_CONTROL_KEYS: readonly ShaderControlKey[] = [
  'waveAmplitude',
  'waveFrequency',
  'windDirection',
  'windSpeed',
  'crestFoamEnabled',
  'crestFoamThreshold',
  'foamIntensity',
  'foamWidth',
  'foamNoiseFactor',
  'foamCellScale',
  'foamShredSlope',
  'foamFizzWeight',
  'intersectionFoamEnabled',
  'intersectionFoamIntensity',
  'intersectionFoamWidth',
  'intersectionFoamFalloff',
  'intersectionFoamNoise',
  'intersectionFoamVerticalRange',
  'underwaterEnabled',
  'underwaterTransitionDepth',
  'underwaterFogDensity',
  'underwaterHorizonMix',
  'underwaterColorR',
  'underwaterColorG',
  'underwaterColorB',
  'toonShadowColorR',
  'toonShadowColorG',
  'toonShadowColorB',
  'toonMidColorR',
  'toonMidColorG',
  'toonMidColorB',
  'toonLightColorR',
  'toonLightColorG',
  'toonLightColorB',
  'causticIntensity',
  'specularIntensity',
  'skyReflectionMix',
  'normalDetailStrength',
  'normalDistanceFalloff',
  'depthFadeDistance',
  'depthFadeExponent',
] as const;

export const GerstnerWaves: IWater = {
  id: 'gerstnerWaves',
  meshType: 'groundAdaptive',
  displayName: 'Gerstner Waves',
  description: 'High-performance procedural waves with dynamic foam and caustics',
  supportsFoam: true,
  supportsCaustics: true,
  shaderControlKeys: [
    'waveAmplitude',
    'waveFrequency',
    'windDirection',
    'windSpeed',
    'crestFoamEnabled',
    'crestFoamThreshold',
    'foamIntensity',
    'foamWidth',
    'foamNoiseFactor',
    'foamCellScale',
    'foamShredSlope',
    'foamFizzWeight',
    'intersectionFoamEnabled',
    'intersectionFoamIntensity',
    'intersectionFoamWidth',
    'intersectionFoamFalloff',
    'intersectionFoamNoise',
    'intersectionFoamVerticalRange',
    'underwaterEnabled',
    'underwaterTransitionDepth',
    'underwaterFogDensity',
    'underwaterHorizonMix',
    'underwaterColorR',
    'underwaterColorG',
    'underwaterColorB',
    'causticIntensity',
    'specularIntensity',
    'skyReflectionMix',
    'normalDetailStrength',
    'normalDistanceFalloff',
    'depthFadeDistance',
    'depthFadeExponent',
  ],
} as const;

export const OceanWaves: IWater = {
  id: 'oceanWaves',
  meshType: 'groundAdaptive',
  displayName: 'Ocean Waves',
  description: 'Reference ocean profile using Seascape-style wave model',
  supportsFoam: true,
  supportsCaustics: false,
  shaderControlKeys: ['waveAmplitude'],
} as const;

export const ToonWater: IWater = {
  id: 'toonWater',
  meshType: 'groundAdaptive',
  displayName: 'Toon Water',
  description: 'Stylized cell-shaded water with bold color bands',
  supportsFoam: true,
  supportsCaustics: false,
  shaderControlKeys: [
    'waveAmplitude',
    'waveFrequency',
    'windDirection',
    'windSpeed',
    'crestFoamEnabled',
    'crestFoamThreshold',
    'foamIntensity',
    'foamWidth',
    'foamNoiseFactor',
    'intersectionFoamEnabled',
    'intersectionFoamIntensity',
    'intersectionFoamWidth',
    'intersectionFoamFalloff',
    'intersectionFoamNoise',
    'intersectionFoamVerticalRange',
    'underwaterEnabled',
    'underwaterTransitionDepth',
    'underwaterFogDensity',
    'underwaterHorizonMix',
    'underwaterColorR',
    'underwaterColorG',
    'underwaterColorB',
    'toonShadowColorR',
    'toonShadowColorG',
    'toonShadowColorB',
    'toonMidColorR',
    'toonMidColorG',
    'toonMidColorB',
    'toonLightColorR',
    'toonLightColorG',
    'toonLightColorB',
    'specularIntensity',
  ],
} as const;

export const TropicalWaves: IWater = {
  id: 'tropicalWaves',
  meshType: 'groundAdaptive',
  displayName: 'Tropical Waves',
  description: 'Photoreal tropical waters with shallow reef coloration',
  supportsFoam: true,
  supportsCaustics: false,
  shaderControlKeys: [
    'waveAmplitude',
    'waveFrequency',
    'windDirection',
    'windSpeed',
    'crestFoamEnabled',
    'crestFoamThreshold',
    'foamIntensity',
    'foamWidth',
    'foamNoiseFactor',
    'intersectionFoamEnabled',
    'intersectionFoamIntensity',
    'intersectionFoamWidth',
    'intersectionFoamFalloff',
    'intersectionFoamNoise',
    'intersectionFoamVerticalRange',
    'underwaterEnabled',
    'underwaterTransitionDepth',
    'underwaterFogDensity',
    'underwaterHorizonMix',
    'underwaterColorR',
    'underwaterColorG',
    'underwaterColorB',
    'specularIntensity',
    'depthFadeDistance',
    'depthFadeExponent',
  ],
} as const;

export const StormyWaves: IWater = {
  id: 'stormyWaves',
  meshType: 'groundAdaptive',
  displayName: 'Stormy Waves',
  description: 'Photoreal storm-water profile with dark trough energy',
  supportsFoam: true,
  supportsCaustics: false,
  shaderControlKeys: [
    'waveAmplitude',
    'waveFrequency',
    'windDirection',
    'windSpeed',
    'crestFoamEnabled',
    'crestFoamThreshold',
    'foamIntensity',
    'foamWidth',
    'foamNoiseFactor',
    'intersectionFoamEnabled',
    'intersectionFoamIntensity',
    'intersectionFoamWidth',
    'intersectionFoamFalloff',
    'intersectionFoamNoise',
    'intersectionFoamVerticalRange',
    'underwaterEnabled',
    'underwaterTransitionDepth',
    'underwaterFogDensity',
    'underwaterHorizonMix',
    'underwaterColorR',
    'underwaterColorG',
    'underwaterColorB',
    'specularIntensity',
    'depthFadeDistance',
    'depthFadeExponent',
  ],
} as const;

export const GlassyWaves: IWater = {
  id: 'glassyWaves',
  meshType: 'groundAdaptive',
  displayName: 'Glassy Waves',
  description: 'Low-chop reflective water with subtle crest breakup',
  supportsFoam: true,
  supportsCaustics: false,
  shaderControlKeys: [
    'waveAmplitude',
    'waveFrequency',
    'windDirection',
    'windSpeed',
    'crestFoamEnabled',
    'crestFoamThreshold',
    'foamIntensity',
    'foamWidth',
    'foamNoiseFactor',
    'intersectionFoamEnabled',
    'intersectionFoamIntensity',
    'intersectionFoamWidth',
    'intersectionFoamFalloff',
    'intersectionFoamNoise',
    'intersectionFoamVerticalRange',
    'underwaterEnabled',
    'underwaterTransitionDepth',
    'underwaterFogDensity',
    'underwaterHorizonMix',
    'underwaterColorR',
    'underwaterColorG',
    'underwaterColorB',
    'specularIntensity',
    'depthFadeDistance',
    'depthFadeExponent',
  ],
} as const;

export const WATER_TYPES = [GerstnerWaves, OceanWaves, ToonWater, TropicalWaves, StormyWaves, GlassyWaves] as const;

export type WaterTypeId = typeof WATER_TYPES[number]['id'];

export type WaterType =
  | { type: 'gerstnerWaves' }
  | { type: 'oceanWaves' }
  | { type: 'toonWater' }
  | { type: 'tropicalWaves' }
  | { type: 'stormyWaves' }
  | { type: 'glassyWaves' };

export function getWaterTypeById(id: WaterTypeId): IWater {
  const waterType = WATER_TYPES.find((wt) => wt.id === id);
  if (!waterType) {
    throw new Error(`Unknown water type: ${id}`);
  }
  return waterType;
}

export function waterTypeToId(waterType: WaterType): WaterTypeId {
  return waterType.type as WaterTypeId;
}

export function idToWaterType(id: WaterTypeId): WaterType {
  if (id === 'oceanWaves') return { type: 'oceanWaves' };
  if (id === 'toonWater') return { type: 'toonWater' };
  if (id === 'tropicalWaves') return { type: 'tropicalWaves' };
  if (id === 'stormyWaves') return { type: 'stormyWaves' };
  if (id === 'glassyWaves') return { type: 'glassyWaves' };
  return { type: 'gerstnerWaves' };
}

export function parseWaterType(value: string): WaterType {
  if (value === 'oceanWaves') return { type: 'oceanWaves' };
  if (value === 'toonWater') return { type: 'toonWater' };
  if (value === 'tropicalWaves') return { type: 'tropicalWaves' };
  if (value === 'stormyWaves') return { type: 'stormyWaves' };
  if (value === 'glassyWaves') return { type: 'glassyWaves' };
  return { type: 'gerstnerWaves' };
}

export function serializeWaterType(waterType: WaterType): string {
  return waterType.type;
}

export function parseWaterTypeId(value: string): WaterTypeId {
  if (value === 'oceanWaves') return 'oceanWaves';
  if (value === 'toonWater') return 'toonWater';
  if (value === 'tropicalWaves') return 'tropicalWaves';
  if (value === 'stormyWaves') return 'stormyWaves';
  if (value === 'glassyWaves') return 'glassyWaves';
  return 'gerstnerWaves';
}

export function serializeWaterTypeId(waterTypeId: WaterTypeId): string {
  return waterTypeId;
}
