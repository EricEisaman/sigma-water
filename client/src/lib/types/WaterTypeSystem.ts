/**
 * Backward-compatible app shim.
 *
 * Source of truth now lives in the framework-agnostic monorepo package:
 * @sigma-water/core
 */
export {
  WATER_TYPES,
  GerstnerWaves,
  OceanWaves,
  TropicalWaves,
  StormyWaves,
  GlassyWaves,
  getWaterTypeById,
  waterTypeToId,
  idToWaterType,
  parseWaterType,
  serializeWaterType,
  parseWaterTypeId,
  serializeWaterTypeId,
  type IWaterType,
  type WaterType,
  type WaterTypeId,
} from '@sigma-water/core';
