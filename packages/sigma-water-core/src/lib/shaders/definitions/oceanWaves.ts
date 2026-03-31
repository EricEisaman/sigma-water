import { ShaderContext } from '../ShaderContext';
import { ShaderRegistryEntry } from '../ShaderRegistry';
import { oceanVertexShader, oceanFragmentShader } from '../wgsl';

export const oceanWavesDefinition: ShaderRegistryEntry = {
  id: 'oceanWaves',
  displayName: 'Ocean Waves',
  description: 'Reference ocean shader with Seascape-style WGSL wave model',
  
  features: {
    supportsFoam: true,
    supportsCaustics: false,
    supportsCollisions: true,
    supportsWake: false,
  },
  
  shader: {
    vertex: oceanVertexShader,
    fragment: oceanFragmentShader,
  },
  
  babylon: {
    uniforms: [
      'time',
      'cameraPosition',
      'waveAmplitude',
      'boatCollisionCenter',
      'islandCollisionCenter',
      'boatCollisionRadius',
      'islandCollisionRadius',
      'boatIntersectionFactor',
      'islandIntersectionFactor',
      'underwaterEnabled',
      'underwaterTransitionDepth',
      'underwaterFogDensity',
      'underwaterHorizonMix',
      'underwaterColorR',
      'underwaterColorG',
      'underwaterColorB',
      'underwaterFactor',
    ],
    attributes: ['position'],
    uniformBuffers: ['Scene', 'Mesh'],
  },

  defaults: {
    time: 0,
    cameraPosition: [0, 50, -100],
    waveAmplitude: 1.0,
    boatCollisionCenter: [0, 0.4, -12],
    islandCollisionCenter: [22, 0, 10],
    boatCollisionRadius: 2.2,
    islandCollisionRadius: 4.0,
    boatIntersectionFactor: 0,
    islandIntersectionFactor: 0,
    underwaterEnabled: 1,
    underwaterTransitionDepth: 8,
    underwaterFogDensity: 0.32,
    underwaterHorizonMix: 0.38,
    underwaterColorR: 0.03,
    underwaterColorG: 0.16,
    underwaterColorB: 0.24,
    underwaterFactor: 0,
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
