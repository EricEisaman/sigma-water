/**
 * Shader Initializer
 * Registers all available shaders with the library
 */

import { Scene } from '@babylonjs/core';
import { ShaderLibrary } from './ShaderLibrary';
import { gerstnerWavesVertexShader, gerstnerWavesFragmentShader } from './gerstnerWaves.wgsl';
import { oceanWavesVertexShader, oceanWavesFragmentShader } from './oceanWaves.wgsl';

export function initializeShaderLibrary(scene: Scene): ShaderLibrary {
  const library = new ShaderLibrary(scene);

  // Register Gerstner Waves Shader (Original)
  library.registerShader(
    'gerstnerWaves',
    {
      name: 'gerstnerWaves',
      displayName: 'Gerstner Waves',
      description: 'High-performance wave simulation with dynamic foam',
      uniforms: [
        'world',
        'worldViewProjection',
        'time',
        'waveAmplitude',
        'waveFrequency',
        'windDirection',
        'windSpeed',
        'foamIntensity',
        'cameraPosition',
        'causticIntensity',
        'depthFadeDistance',
        'depthFadeExponent',
      ],
      attributes: ['position', 'normal', 'uv'],
      uniqueParams: {
        waveAmplitude: { min: 0.5, max: 5.0, default: 2.6 },
        waveFrequency: { min: 0.5, max: 3.0, default: 1.35 },
        causticIntensity: { min: 0.0, max: 1.0, default: 0.85 },
        depthFadeDistance: { min: 0.5, max: 5.0, default: 1.15 },
        depthFadeExponent: { min: 0.5, max: 3.0, default: 1.65 },
      },
    },
    gerstnerWavesVertexShader,
    gerstnerWavesFragmentShader,
    {
      time: 0,
      waveAmplitude: 2.6,
      waveFrequency: 1.35,
      windDirection: 38,
      windSpeed: 0.72,
      foamIntensity: 0.7,
      cameraPosition: [0, 10, 0],
      causticIntensity: 0.85,
      depthFadeDistance: 1.15,
      depthFadeExponent: 1.65,
    }
  );

  // Register Ocean Waves Shader (Ported from GLSL)
  library.registerShader(
    'oceanWaves',
    {
      name: 'oceanWaves',
      displayName: 'Ocean Waves',
      description: 'Multi-octave procedural ocean with advanced normal calculation',
      uniforms: [
        'world',
        'worldViewProjection',
        'time',
        'cameraPosition',
      ],
      attributes: ['position'],
      uniqueParams: {
        // Ocean waves shader uses fixed parameters from GLSL
      },
    },
    oceanWavesVertexShader,
    oceanWavesFragmentShader,
    {
      time: 0,
      cameraPosition: [0, 10, 0],
    }
  );

  return library;
}
