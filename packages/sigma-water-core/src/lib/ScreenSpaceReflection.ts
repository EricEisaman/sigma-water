/**
 * Screen-Space Reflection - Water surface reflections based on view angle
 */

import { screenSpaceReflectionShader } from './shaders/wgsl';

export class ScreenSpaceReflection {
  private maxSteps = 64;
  private stride = 2;
  private thickness = 0.5;
  private reflectionIntensity = 0.6;

  constructor() {}

  /**
   * Get SSR shader code
   */
  public getShaderCode(): string {
    return screenSpaceReflectionShader;
  }

  /**
   * Set SSR parameters
   */
  public setParameters(maxSteps: number, stride: number, thickness: number, intensity: number): void {
    this.maxSteps = maxSteps;
    this.stride = stride;
    this.thickness = thickness;
    this.reflectionIntensity = intensity;
  }

  /**
   * Get parameters as buffer data
   */
  public getParametersBuffer(): Uint32Array {
    return new Uint32Array([this.maxSteps, this.stride, 0, 0]);
  }

  /**
   * Get float parameters
   */
  public getFloatParameters(): Float32Array {
    return new Float32Array([this.thickness, this.reflectionIntensity, 0, 0]);
  }

  public dispose(): void {
    // Cleanup if needed
  }
}
