import { ShaderContext } from '../ShaderContext';
import { ShaderRegistryEntry } from '../ShaderRegistry';
import { waterVertexShader, toonFragmentShader } from '../wgsl';

export const toonWaterDefinition: ShaderRegistryEntry = {
  id: 'toonWater',
  displayName: 'Toon Water',
  description: 'Stylized cell-shaded water with bold colors',
  
  features: {
    supportsFoam: true,
    supportsCaustics: false,
    supportsCollisions: true,
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
      'crestFoamEnabled',
      'crestFoamThreshold',
      'foamIntensity',
      'foamWidth',
      'foamNoiseFactor',
      'intersectionFoamEnabled',
      'intersectionFoamIntensity',
      'intersectionFoamWidth',
      'intersectionFoamFalloff',
      'intersectionFoamNoise',
      'intersectionFoamVerticalRange',
      'boatCollisionCenter',
      'islandCollisionCenter',
      'boatCollisionRadius',
      'islandCollisionRadius',
      'boatIntersectionFactor',
      'islandIntersectionFactor',
      'specularIntensity',
      'underwaterEnabled',
      'underwaterTransitionDepth',
      'underwaterFogDensity',
      'underwaterHorizonMix',
      'underwaterColorR',
      'underwaterColorG',
      'underwaterColorB',
      'underwaterFactor',
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
    crestFoamEnabled: 1,
    crestFoamThreshold: 0.45,
    foamIntensity: 0.55,
    foamWidth: 1.0,
    foamNoiseFactor: 0.4,
    intersectionFoamEnabled: 1,
    intersectionFoamIntensity: 1,
    intersectionFoamWidth: 1,
    intersectionFoamFalloff: 1,
    intersectionFoamNoise: 0.45,
    intersectionFoamVerticalRange: 1.8,
    boatCollisionCenter: [0, 0.4, -12],
    islandCollisionCenter: [22, 0, 10],
    boatCollisionRadius: 2.2,
    islandCollisionRadius: 4.0,
    boatIntersectionFactor: 0,
    islandIntersectionFactor: 0,
    specularIntensity: 1.0,
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
    console.log('🎨 Setting up Toon Water shader');
  },
  
  update: (context: ShaderContext, deltaTime: number) => {
    // Update logic here
  },
  
  cleanup: () => {
    console.log('🧹 Cleaning up Toon Water shader');
  },
};
