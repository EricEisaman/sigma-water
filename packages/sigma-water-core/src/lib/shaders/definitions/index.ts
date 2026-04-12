/**
 * Shader Definitions - Declarative Registry of All Water Types
 * 
 * This is where all 20+ water type shaders are defined.
 * Each definition is self-contained and can be added/modified independently.
 */

import { ShaderRegistryEntry } from '../ShaderRegistry';
import { gerstnerWavesDefinition } from './gerstnerWaves';
import { oceanWavesDefinition } from './oceanWaves';
import { tropicalWavesDefinition } from './tropicalWaves';
import { stormyWavesDefinition } from './stormyWaves';
import { glassyWavesDefinition } from './glassyWaves';
import { rippleFluxDefinition } from './rippleFlux';
import { toonWaterDefinition } from './toonWater';

/**
 * All available water type shaders
 * Add new shaders here as they're implemented
 */
export const SHADER_DEFINITIONS: ShaderRegistryEntry[] = [
  gerstnerWavesDefinition,
  oceanWavesDefinition,
  tropicalWavesDefinition,
  stormyWavesDefinition,
  glassyWavesDefinition,
  rippleFluxDefinition,
  toonWaterDefinition,
  // Future shaders:
  // foamyWavesDefinition,
  // glowingWavesDefinition,
  // crystallineWavesDefinition,
  // ... (up to 20+)
];

export { 
  gerstnerWavesDefinition, 
  oceanWavesDefinition,
  tropicalWavesDefinition,
  stormyWavesDefinition,
  glassyWavesDefinition,
  rippleFluxDefinition,
  toonWaterDefinition,
};
