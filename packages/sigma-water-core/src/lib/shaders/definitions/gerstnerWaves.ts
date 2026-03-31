import { ShaderContext } from '../ShaderContext';
import { ShaderRegistryEntry } from '../ShaderRegistry';
import { waterVertexShader, gerstnerFragmentShader } from '../wgsl';

export const gerstnerWavesDefinition: ShaderRegistryEntry = {
  id: 'gerstnerWaves',
  displayName: 'Gerstner Waves',
  description: 'High-performance wave simulation with dynamic foam and caustics',
  
  features: {
    supportsFoam: true,
    supportsCaustics: true,
    supportsCollisions: true,
    supportsWake: true,
  },
  
  shader: {
    vertex: waterVertexShader,
    fragment: gerstnerFragmentShader,
  },
  
  babylon: {
    uniforms: [
      'time',
      'cameraPosition',
      'waveAmplitude',
      'waveFrequency',
      'windDirection',
      'windSpeed',
      'foamIntensity',
      'foamWidth',
      'foamNoiseFactor',
      'foamCellScale',
      'foamShredSlope',
      'foamFizzWeight',
      'causticIntensity',
      'specularIntensity',
      'depthFadeDistance',
      'depthFadeExponent',
      'boatCollisionCenter',
      'islandCollisionCenter',
      'boatCollisionRadius',
      'islandCollisionRadius',
      'collisionFoamStrength',
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
    foamIntensity: 0.7,
    foamWidth: 1.0,
    foamNoiseFactor: 0.45,
    foamCellScale: 0.115,
    foamShredSlope: 0.56,
    foamFizzWeight: 0.28,
    causticIntensity: 0.85,
    specularIntensity: 1.0,
    depthFadeDistance: 1.15,
    depthFadeExponent: 1.65,
    boatCollisionCenter: [0, 0.4, -12],
    islandCollisionCenter: [22, 0, 10],
    boatCollisionRadius: 2.2,
    islandCollisionRadius: 4.0,
    collisionFoamStrength: 1.0,
  },
  
  setup: (context: ShaderContext) => {
    console.log('🎨 Setting up Gerstner Waves shader');
  },
  
  update: (context: ShaderContext, deltaTime: number) => {
    // Update logic here
  },
  
  cleanup: () => {
    console.log('🧹 Cleaning up Gerstner Waves shader');
  },
};
