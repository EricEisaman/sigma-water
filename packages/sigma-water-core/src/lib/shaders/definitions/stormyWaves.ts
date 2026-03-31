import { ShaderContext } from '../ShaderContext';
import { ShaderRegistryEntry } from '../ShaderRegistry';
import { waterVertexShader, stormyFragmentShader } from '../wgsl';

export const stormyWavesDefinition: ShaderRegistryEntry = {
  id: 'stormyWaves',
  displayName: 'Stormy Waves',
  description: 'Dark, turbulent waters with dramatic lighting',
  
  features: {
    supportsFoam: false,
    supportsCaustics: false,
    supportsCollisions: false,
    supportsWake: false,
  },
  
  shader: {
    vertex: waterVertexShader,
    fragment: stormyFragmentShader,
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
    console.log('🎨 Setting up Stormy Waves shader');
  },
  
  update: (context: ShaderContext, deltaTime: number) => {
    // Update logic here
  },
  
  cleanup: () => {
    console.log('🧹 Cleaning up Stormy Waves shader');
  },
};
