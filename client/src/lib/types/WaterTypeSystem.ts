/**
 * Water Type System
 * 
 * Defines the contract for all water shader implementations.
 * Each water type represents a distinct shader with its own characteristics,
 * uniforms, and visual parameters.
 */

/**
 * Base contract for all water types.
 * Ensures consistent interface across different shader implementations.
 */
export interface IWaterType {
  /** Unique identifier for this water type (matches shader name) */
  readonly id: string;
  
  /** Human-readable display name */
  readonly displayName: string;
  
  /** Brief description of this water type's characteristics */
  readonly description: string;
  
  /** Whether this water type supports foam rendering */
  readonly supportsFoam: boolean;
  
  /** Whether this water type supports caustics rendering */
  readonly supportsCaustics: boolean;
}

/**
 * Gerstner Waves implementation
 * High-performance procedural wave simulation with dynamic foam and caustics.
 */
export const GerstnerWaves: IWaterType = {
  id: 'gerstnerWaves',
  displayName: 'Gerstner Waves',
  description: 'High-performance procedural waves with dynamic foam and caustics',
  supportsFoam: true,
  supportsCaustics: true,
} as const;

/**
 * Ocean Waves implementation
 * Alternative shader with 5-octave procedural normals for varied wave patterns.
 */
export const OceanWaves: IWaterType = {
  id: 'oceanWaves',
  displayName: 'Ocean Waves',
  description: 'Procedural ocean shader with multi-octave normal generation',
  supportsFoam: false,
  supportsCaustics: false,
} as const;

/**
 * Registry of all available water types
 */
export const WATER_TYPES = [GerstnerWaves, OceanWaves] as const;

/**
 * Union type of all water type IDs
 */
export type WaterTypeId = typeof WATER_TYPES[number]['id'];

/**
 * Discriminated union type for water type state
 * Ensures type safety when working with different water types
 */
export type WaterType = 
  | { type: 'gerstnerWaves' }
  | { type: 'oceanWaves' };

/**
 * Get water type metadata by ID
 */
export function getWaterTypeById(id: WaterTypeId): IWaterType {
  const waterType = WATER_TYPES.find(wt => wt.id === id);
  if (!waterType) {
    throw new Error(`Unknown water type: ${id}`);
  }
  return waterType;
}

/**
 * Convert WaterType discriminated union to ID string
 */
export function waterTypeToId(waterType: WaterType): WaterTypeId {
  return waterType.type as WaterTypeId;
}

/**
 * Convert ID string to WaterType discriminated union
 */
export function idToWaterType(id: WaterTypeId): WaterType {
  if (id === 'oceanWaves') return { type: 'oceanWaves' };
  return { type: 'gerstnerWaves' };
}

/**
 * Parse water type from string (for URL params and localStorage)
 */
export function parseWaterType(value: string): WaterType {
  if (value === 'oceanWaves') return { type: 'oceanWaves' };
  return { type: 'gerstnerWaves' };
}

/**
 * Serialize water type to string (for URL params and localStorage)
 */
export function serializeWaterType(waterType: WaterType): string {
  return waterType.type;
}
