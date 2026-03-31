/**
 * Screen-Space Reflection - Water surface reflections based on view angle
 */

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
    return `
      struct SSRParams {
        maxSteps: u32,
        stride: u32,
        thickness: f32,
        reflectionIntensity: f32,
      }

      @group(0) @binding(5) var<uniform> ssrParams: SSRParams;
      @group(0) @binding(6) var depthTexture: texture_2d<f32>;
      @group(0) @binding(7) var colorTexture: texture_2d<f32>;
      @group(0) @binding(8) var texSampler: sampler;

      fn screenSpaceReflection(
        fragPos: vec3<f32>,
        normal: vec3<f32>,
        viewDir: vec3<f32>,
        uv: vec2<f32>,
      ) -> vec3<f32> {
        // Reflect view direction across normal
        let reflectDir = reflect(-viewDir, normal);

        // Ray march in screen space
        var rayPos = fragPos;
        var rayDir = reflectDir;
        var reflection = vec3<f32>(0.0);
        var hitMask = 0.0;

        for (var i: u32 = 0u; i < ssrParams.maxSteps; i = i + 1u) {
          rayPos += rayDir * f32(ssrParams.stride) * 0.1;

          // Project to screen space
          let screenPos = rayPos.xy / rayPos.z;
          let screenUV = screenPos * 0.5 + 0.5;

          // Check bounds
          if (screenUV.x < 0.0 || screenUV.x > 1.0 || screenUV.y < 0.0 || screenUV.y > 1.0) {
            break;
          }

          // Sample depth
          let sampleDepth = textureSample(depthTexture, texSampler, screenUV).r;

          // Check for hit
          if (rayPos.z > sampleDepth - ssrParams.thickness) {
            reflection = textureSample(colorTexture, texSampler, screenUV).rgb;
            hitMask = 1.0 - f32(i) / f32(ssrParams.maxSteps);
            break;
          }
        }

        return reflection * hitMask * ssrParams.reflectionIntensity;
      }

      fn applyWaterReflection(
        baseColor: vec3<f32>,
        fragPos: vec3<f32>,
        normal: vec3<f32>,
        viewDir: vec3<f32>,
        uv: vec2<f32>,
        fresnel: f32,
      ) -> vec3<f32> {
        let reflection = screenSpaceReflection(fragPos, normal, viewDir, uv);
        return mix(baseColor, reflection, fresnel * 0.5);
      }
    `;
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
