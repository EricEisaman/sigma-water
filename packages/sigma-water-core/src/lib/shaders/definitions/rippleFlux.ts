import { ShaderContext } from '../ShaderContext';
import { ShaderRegistryEntry } from '../ShaderRegistry';
import { rippleFluxVertexShader, rippleFluxFragmentShader } from '../wgsl';

export const rippleFluxDefinition: ShaderRegistryEntry = {
  id: 'rippleFlux',
  displayName: 'RippleFlux',
  description: 'Interactive height-field ripples with direct pointer impulses and floating-boat response',

  features: {
    supportsFoam: false,
    supportsCaustics: false,
    supportsCollisions: false,
    supportsWake: true,
  },

  shader: {
    vertex: rippleFluxVertexShader,
    fragment: rippleFluxFragmentShader,
  },

  babylon: {
    uniforms: [
      'time',
      'cameraPosition',
      'waveAmplitude',
      'rippleFieldBounds',
      'rippleTexelSize',
      'specularIntensity',
      'skyReflectionMix',
      'depthFadeDistance',
      'depthFadeExponent',
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
    samplers: ['rippleHeightTexture'],
    uniformBuffers: ['Scene', 'Mesh'],
  },

  defaults: {
    time: 0,
    cameraPosition: [0, 50, -100],
    waveAmplitude: 1.0,
    rippleFieldBounds: [-60, -60, 120, 120],
    rippleTexelSize: [1 / 128, 1 / 128],
    specularIntensity: 1.1,
    skyReflectionMix: 0.68,
    depthFadeDistance: 1.25,
    depthFadeExponent: 1.45,
    underwaterEnabled: 1,
    underwaterTransitionDepth: 8,
    underwaterFogDensity: 0.32,
    underwaterHorizonMix: 0.38,
    underwaterColorR: 0.03,
    underwaterColorG: 0.16,
    underwaterColorB: 0.24,
    underwaterFactor: 0,
  },

  setup: (_context: ShaderContext) => {
    console.log('🎨 Setting up RippleFlux shader');
  },

  update: (_context: ShaderContext, _deltaTime: number) => {
    // Runtime texture updates are pushed by VisualOcean.
  },

  cleanup: () => {
    console.log('🧹 Cleaning up RippleFlux shader');
  },
};
