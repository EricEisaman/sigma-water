/**
 * God Rays - Volumetric light rays with proper sun position tracking
 */

import { godRaysShader } from './shaders/wgsl';

export class GodRays {
  private sunPosition = { x: 0, y: 1, z: 0 };
  private sunIntensity = 1.0;
  private rayDensity = 0.5;
  private rayDecay = 0.95;
  private rayExposure = 0.3;
  private numSamples = 32;

  constructor() {}

  /**
   * Update sun position from SkyDome
   */
  public setSunPosition(x: number, y: number, z: number, intensity: number): void {
    this.sunPosition = { x, y, z };
    this.sunIntensity = intensity;
  }

  /**
   * Get God rays shader code
   */
  public getShaderCode(): string {
    return godRaysShader;
  }

  /**
   * Convert 3D sun position to screen space
   */
  public getSunScreenPosition(
    sunWorldPos: { x: number; y: number; z: number },
    viewMatrix: Float32Array,
    projMatrix: Float32Array
  ): { x: number; y: number } {
    // Transform sun position to clip space
    const sunView = this.multiplyVec3ByMatrix(sunWorldPos, viewMatrix);
    const sunClip = this.multiplyVec3ByMatrix(sunView, projMatrix);

    // Convert to screen space (0-1)
    const screenX = (sunClip.x / sunClip.z + 1) * 0.5;
    const screenY = (1 - sunClip.y / sunClip.z) * 0.5;

    return { x: screenX, y: screenY };
  }

  /**
   * Helper: multiply vec3 by 4x4 matrix
   */
  private multiplyVec3ByMatrix(
    vec: { x: number; y: number; z: number },
    matrix: Float32Array
  ): { x: number; y: number; z: number } {
    const x = vec.x * matrix[0] + vec.y * matrix[4] + vec.z * matrix[8] + matrix[12];
    const y = vec.x * matrix[1] + vec.y * matrix[5] + vec.z * matrix[9] + matrix[13];
    const z = vec.x * matrix[2] + vec.y * matrix[6] + vec.z * matrix[10] + matrix[14];
    const w = vec.x * matrix[3] + vec.y * matrix[7] + vec.z * matrix[11] + matrix[15];

    return {
      x: x / w,
      y: y / w,
      z: z / w,
    };
  }

  /**
   * Set ray parameters
   */
  public setRayParameters(
    density: number,
    decay: number,
    exposure: number,
    samples: number
  ): void {
    this.rayDensity = density;
    this.rayDecay = decay;
    this.rayExposure = exposure;
    this.numSamples = samples;
  }

  /**
   * Get ray parameters as buffer data
   */
  public getRayParametersBuffer(sunScreenX: number, sunScreenY: number): Float32Array {
    return new Float32Array([
      sunScreenX,
      sunScreenY,
      this.sunIntensity,
      this.rayDensity,
      this.rayDecay,
      this.rayExposure,
      this.numSamples,
      0, // padding
    ]);
  }

  public dispose(): void {
    // Cleanup if needed
  }
}
