export {
  WATER_TYPES,
  SHADER_CONTROL_KEYS,
  GerstnerWaves,
  OceanWaves,
  ToonWater,
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
  type IWater,
  type IWaterType,
  type ShaderControlKey,
  type WaterMeshTypeId,
  type WaterType,
  type WaterTypeId,
} from './water/WaterTypeRegistry';

export { VisualOcean } from './lib/VisualOcean';
export { type IWaterMesh, type IWaterMeshConfig } from './lib/water/WaterMeshFactory';
