import { ShaderContext } from '../ShaderContext';
import { ShaderRegistryEntry } from '../ShaderRegistry';
import { waterVertexShader, tropicalFragmentShader } from '../wgsl';

export const tropicalWavesDefinition: ShaderRegistryEntry = {
  id: 'tropicalWaves',
  displayName: 'Tropical Waves',
  description: 'Vibrant Caribbean waters with shallow beach colors',
  
  features: {
    supportsFoam: false,
    supportsCaustics: false,
    supportsCollisions: false,
    supportsWake: false,
  },
  
  shader: {
    vertex: waterVertexShader,
    fragment: tropicalFragmentShader,
  },
  
  babylon: {
    uniforms: ['time', 'waveAmplitude', 'waveFrequency', 'windDirection', 'windSpeed'],
    attributes: ['position', 'normal', 'uv'],
    uniformBuffers: ['Scene', 'Mesh'],
  },

  defaults: {
    time: 0,
    waveAmplitude: 1.8,
    waveFrequency: 1.2,
    windDirection: 45,
    windSpeed: 0.6,
  },
  
  setup: (context: ShaderContext) => {
    console.log('🎨 Setting up Tropical Waves shader');
  },
  
  update: (context: ShaderContext, deltaTime: number) => {
    // Update logic here
  },
  
  cleanup: () => {
    console.log('🧹 Cleaning up Tropical Waves shader');
  },
};
