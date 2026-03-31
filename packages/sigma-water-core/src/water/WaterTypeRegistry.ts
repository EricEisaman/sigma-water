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

export type WaterMeshTypeId = 'groundStandard' | 'groundDense';

export type ShaderControlKey =
  | 'waveAmplitude'
  | 'waveFrequency'
  | 'windDirection'
  | 'windSpeed'
  | 'foamIntensity'
  | 'foamWidth'
  | 'foamNoiseFactor'
  | 'foamCellScale'
  | 'foamShredSlope'
  | 'foamFizzWeight'
  | 'causticIntensity'
  | 'specularIntensity'
  | 'depthFadeDistance'
  | 'depthFadeExponent';

export const SHADER_CONTROL_KEYS: readonly ShaderControlKey[] = [
  'waveAmplitude',
  'waveFrequency',
  'windDirection',
  'windSpeed',
  'foamIntensity',
  'foamWidth',
  'foamNoiseFactor',
  'foamCellScale',
  'foamShredSlope',
  'foamFizzWeight',
  'causticIntensity',
  'specularIntensity',
  'depthFadeDistance',
  'depthFadeExponent',
] as const;

export const GerstnerWaves: IWater = {
  id: 'gerstnerWaves',
  meshType: 'groundStandard',
  displayName: 'Gerstner Waves',
  description: 'High-performance procedural waves with dynamic foam and caustics',
  supportsFoam: true,
  supportsCaustics: true,
  shaderControlKeys: [
    'waveAmplitude',
    'waveFrequency',
    'windDirection',
    'windSpeed',
    'foamIntensity',
    'foamWidth',
    'foamNoiseFactor',
    'foamCellScale',
    'foamShredSlope',
    'foamFizzWeight',
    'causticIntensity',
    'specularIntensity',
    'depthFadeDistance',
    'depthFadeExponent',
  ],
} as const;

export const OceanWaves: IWater = {
  id: 'oceanWaves',
  meshType: 'groundDense',
  displayName: 'Ocean Waves',
  description: 'Procedural ocean shader with multi-octave normal generation',
  supportsFoam: false,
  supportsCaustics: false,
  shaderControlKeys: [
    'waveAmplitude',
    'waveFrequency',
    'windDirection',
    'windSpeed',
    'specularIntensity',
    'depthFadeDistance',
    'depthFadeExponent',
  ],
} as const;

export const ToonWater: IWater = {
  id: 'toonWater',
  meshType: 'groundStandard',
  displayName: 'Toon Water',
  description: 'Stylized cell-shaded water with bold color bands',
  supportsFoam: false,
  supportsCaustics: false,
  shaderControlKeys: [
    'waveAmplitude',
    'waveFrequency',
    'windDirection',
    'windSpeed',
    'specularIntensity',
  ],
} as const;

export const WATER_TYPES = [GerstnerWaves, OceanWaves, ToonWater] as const;

export type WaterTypeId = typeof WATER_TYPES[number]['id'];

export type WaterType =
  | { type: 'gerstnerWaves' }
  | { type: 'oceanWaves' }
  | { type: 'toonWater' };

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
  return { type: 'gerstnerWaves' };
}

export function parseWaterType(value: string): WaterType {
  if (value === 'oceanWaves') return { type: 'oceanWaves' };
  if (value === 'toonWater') return { type: 'toonWater' };
  return { type: 'gerstnerWaves' };
}

export function serializeWaterType(waterType: WaterType): string {
  return waterType.type;
}

export function parseWaterTypeId(value: string): WaterTypeId {
  if (value === 'oceanWaves') return 'oceanWaves';
  if (value === 'toonWater') return 'toonWater';
  return 'gerstnerWaves';
}

export function serializeWaterTypeId(waterTypeId: WaterTypeId): string {
  return waterTypeId;
}
