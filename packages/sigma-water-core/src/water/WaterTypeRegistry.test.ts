import {
  SHADER_CONTROL_KEYS,
  WATER_TYPES,
  getWaterTypeById,
  parseWaterTypeId,
  serializeWaterTypeId,
  type IWater,
} from './WaterTypeRegistry';

describe('WaterTypeRegistry', () => {
  test('all water types satisfy base contract', () => {
    for (const water of WATER_TYPES) {
      const candidate: IWater = water;
      expect(candidate.id.length).toBeGreaterThan(0);
      expect(candidate.displayName.length).toBeGreaterThan(0);
      expect(typeof candidate.supportsFoam).toBe('boolean');
      expect(typeof candidate.supportsCaustics).toBe('boolean');
      expect(Array.isArray(candidate.shaderControlKeys)).toBe(true);
      expect(candidate.shaderControlKeys.length).toBeGreaterThan(0);
      for (const key of candidate.shaderControlKeys) {
        expect(SHADER_CONTROL_KEYS.includes(key)).toBe(true);
      }

      // Every water type must expose at least one wave-related control.
      expect(
        candidate.shaderControlKeys.some((key) => key === 'waveAmplitude' || key === 'waveFrequency')
      ).toBe(true);
    }
  });

  test('getWaterTypeById returns matching type', () => {
    for (const water of WATER_TYPES) {
      expect(getWaterTypeById(water.id).id).toBe(water.id);
    }
  });

  test('parse/serialize water type id roundtrip', () => {
    for (const water of WATER_TYPES) {
      const encoded = serializeWaterTypeId(water.id as any);
      const parsed = parseWaterTypeId(encoded);
      expect(parsed).toBe(water.id);
    }
  });

  test('parseWaterTypeId falls back safely', () => {
    expect(parseWaterTypeId('unknown')).toBe('gerstnerWaves');
  });
});
