import { ShaderContext } from '../ShaderContext';
import { ShaderRegistryEntry } from '../ShaderRegistry';
import { waterVertexShader, glassyFragmentShader } from '../wgsl';

export const glassyWavesDefinition: ShaderRegistryEntry = {
  id: 'glassyWaves',
  displayName: 'Glassy Waves',
  description: 'Mirror-like calm waters with perfect reflections',
  
  features: {
    supportsFoam: false,
    supportsCaustics: false,
    supportsCollisions: false,
    supportsWake: false,
  },
  
  shader: {
    vertex: waterVertexShader,
    fragment: glassyFragmentShader,
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
    console.log('🎨 Setting up Glassy Waves shader');
  },
  
  update: (context: ShaderContext, deltaTime: number) => {
    // Update logic here
  },
  
  cleanup: () => {
    console.log('🧹 Cleaning up Glassy Waves shader');
  },
};
