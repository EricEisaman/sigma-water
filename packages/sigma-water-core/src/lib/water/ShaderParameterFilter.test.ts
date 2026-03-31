import {
  filterParameterStateForShader,
  isParameterSupportedForShader,
  isShaderControlKey,
} from './ShaderParameterFilter';
import { SHADER_CONTROL_KEYS, WATER_TYPES } from '../../water/WaterTypeRegistry';

describe('ShaderParameterFilter', () => {
  test('isShaderControlKey identifies shader control keys', () => {
    expect(isShaderControlKey('waveAmplitude')).toBe(true);
    expect(isShaderControlKey('cameraHeight')).toBe(false);
  });

  test('filterParameterStateForShader drops unsupported shader controls', () => {
    const input = {
      waveAmplitude: 1.7,
      foamIntensity: 0.9,
      depthFadeDistance: 1.2,
      cameraHeight: 55,
    };

    const filteredToToon = filterParameterStateForShader(input, 'toonWater');

    expect(filteredToToon).toEqual({
      waveAmplitude: 1.7,
      foamIntensity: 0.9,
      cameraHeight: 55,
    });
  });

  test('isParameterSupportedForShader allows generic params and blocks unsupported controls', () => {
    expect(isParameterSupportedForShader('cameraHeight', 'toonWater')).toBe(true);
    expect(isParameterSupportedForShader('waveAmplitude', 'toonWater')).toBe(true);
    expect(isParameterSupportedForShader('foamIntensity', 'toonWater')).toBe(true);
    expect(isParameterSupportedForShader('depthFadeDistance', 'toonWater')).toBe(false);
  });

  test('filtering keeps only supported shader controls for each water type', () => {
    const genericParam = { cameraHeight: 50 };

    for (const water of WATER_TYPES) {
      const input: Record<string, number> = { ...genericParam };
      for (const key of SHADER_CONTROL_KEYS) {
        input[key] = 1;
      }

      const filtered = filterParameterStateForShader(input, water.id);

      // Generic params should always survive filtering.
      expect(filtered.cameraHeight).toBe(50);

      for (const key of SHADER_CONTROL_KEYS) {
        const isSupported = water.shaderControlKeys.includes(key);
        expect(Object.prototype.hasOwnProperty.call(filtered, key)).toBe(isSupported);
      }
    }
  });

  test('support checks align with contract across all water types', () => {
    for (const water of WATER_TYPES) {
      for (const key of SHADER_CONTROL_KEYS) {
        expect(isParameterSupportedForShader(key, water.id)).toBe(water.shaderControlKeys.includes(key));
      }
      expect(isParameterSupportedForShader('cameraHeight', water.id)).toBe(true);
    }
  });
});
