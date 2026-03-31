import { ShaderContext } from '../ShaderContext';
import { ShaderRegistryEntry } from '../ShaderRegistry';
import { waterVertexShader, toonFragmentShader } from '../wgsl';

export const toonWaterDefinition: ShaderRegistryEntry = {
  id: 'toonWater',
  displayName: 'Toon Water',
  description: 'Stylized cell-shaded water with bold colors',
  
  features: {
    supportsFoam: false,
    supportsCaustics: false,
    supportsCollisions: false,
    supportsWake: false,
  },
  
  shader: {
    vertex: waterVertexShader,
    fragment: toonFragmentShader,
  },
  
  babylon: {
    uniforms: [
      'time',
      'cameraPosition',
      'waveAmplitude',
      'waveFrequency',
      'windDirection',
      'windSpeed',
      'specularIntensity',
    ],
    attributes: ['position', 'normal', 'uv'],
    uniformBuffers: ['Scene', 'Mesh'],
  },

  defaults: {
    time: 0,
    cameraPosition: [0, 50, -100],
    waveAmplitude: 1.8,
    waveFrequency: 1.2,
    windDirection: 45,
    windSpeed: 0.6,
    specularIntensity: 1.0,
  },
  
  setup: (context: ShaderContext) => {
    console.log('🎨 Setting up Toon Water shader');
  },
  
  update: (context: ShaderContext, deltaTime: number) => {
    // Update logic here
  },
  
  cleanup: () => {
    console.log('🧹 Cleaning up Toon Water shader');
  },
};
