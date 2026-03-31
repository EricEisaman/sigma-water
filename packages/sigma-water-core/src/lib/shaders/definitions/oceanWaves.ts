import { ShaderContext } from '../ShaderContext';
import { ShaderRegistryEntry } from '../ShaderRegistry';
import { waterVertexShader, oceanFragmentShader } from '../wgsl';

export const oceanWavesDefinition: ShaderRegistryEntry = {
  id: 'oceanWaves',
  displayName: 'Ocean Waves',
  description: 'Multi-octave procedural ocean with advanced normal calculation',
  
  features: {
    supportsFoam: false,
    supportsCaustics: false,
    supportsCollisions: false,
    supportsWake: false,
  },
  
  shader: {
    vertex: waterVertexShader,
    fragment: oceanFragmentShader,
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
      'depthFadeDistance',
      'depthFadeExponent',
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
    depthFadeDistance: 1.15,
    depthFadeExponent: 1.65,
  },
  
  setup: (context: ShaderContext) => {
    console.log('🎨 Setting up Ocean Waves shader');
  },
  
  update: (context: ShaderContext, deltaTime: number) => {
    // Update logic here
  },
  
  cleanup: () => {
    console.log('🧹 Cleaning up Ocean Waves shader');
  },
};
