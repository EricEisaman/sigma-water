import { getWaterTypeById, SHADER_CONTROL_KEYS, type WaterTypeId } from '../../water/WaterTypeRegistry';

export function isShaderControlKey(key: string): boolean {
  return (SHADER_CONTROL_KEYS as readonly string[]).includes(key);
}

export function filterParameterStateForShader(
  parameterState: Record<string, number>,
  shaderId: WaterTypeId
): Record<string, number> {
  const supported = new Set(getWaterTypeById(shaderId).shaderControlKeys as readonly string[]);
  const next: Record<string, number> = {};

  for (const [key, value] of Object.entries(parameterState)) {
    if (!isShaderControlKey(key) || supported.has(key)) {
      next[key] = value;
    }
  }

  return next;
}

export function isParameterSupportedForShader(key: string, shaderId: WaterTypeId): boolean {
  if (!isShaderControlKey(key)) {
    return true;
  }

  return getWaterTypeById(shaderId).shaderControlKeys.includes(key as any);
}
