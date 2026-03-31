/**
 * Sky Dome - Procedural sky with sun tracking and atmospheric effects
 */

import { skyDomeShader } from './shaders/wgsl';

export class SkyDome {
  private sunPosition = { x: 0.5, y: 1.0, z: 0.5 };
  private sunIntensity = 1.0;
  private time = 0;
  private dayLength = 120; // seconds for full day cycle

  constructor() {
    this.updateSunPosition(0);
  }

  /**
   * Update sun position based on time of day
   */
  public updateSunPosition(deltaTime: number): void {
    this.time += deltaTime;

    // Normalize time to 0-1 range for day cycle
    const dayProgress = (this.time % this.dayLength) / this.dayLength;

    // Sun arc from east to west
    const sunAngle = dayProgress * Math.PI;
    const sunHeight = Math.sin(sunAngle);
    const sunAzimuth = Math.cos(sunAngle);

    this.sunPosition = {
      x: Math.sin(sunAzimuth) * 2,
      y: Math.max(0.1, sunHeight * 2),
      z: Math.cos(sunAzimuth) * 2,
    };

    // Intensity varies with sun height
    this.sunIntensity = Math.max(0.2, sunHeight);
  }

  /**
   * Get sun position (normalized)
   */
  public getSunPosition(): { x: number; y: number; z: number } {
    const length = Math.sqrt(
      this.sunPosition.x ** 2 + this.sunPosition.y ** 2 + this.sunPosition.z ** 2
    );
    return {
      x: this.sunPosition.x / length,
      y: this.sunPosition.y / length,
      z: this.sunPosition.z / length,
    };
  }

  /**
   * Get sun intensity (0-1)
   */
  public getSunIntensity(): number {
    return this.sunIntensity;
  }

  /**
   * Get sky color based on sun position
   */
  public getSkyColor(): { r: number; g: number; b: number } {
    const sunHeight = this.sunPosition.y;

    // Dawn/dusk colors
    if (sunHeight < 0.3) {
      const t = sunHeight / 0.3;
      return {
        r: 0.1 + t * 0.3,
        g: 0.05 + t * 0.2,
        b: 0.15 + t * 0.4,
      };
    }

    // Day colors
    const t = Math.min(1, (sunHeight - 0.3) / 0.7);
    return {
      r: 0.4 + t * 0.3,
      g: 0.6 + t * 0.3,
      b: 0.9 + t * 0.1,
    };
  }

  /**
   * Get horizon color
   */
  public getHorizonColor(): { r: number; g: number; b: number } {
    const sunHeight = this.sunPosition.y;

    if (sunHeight < 0.2) {
      return {
        r: 0.2,
        g: 0.1,
        b: 0.15,
      };
    }

    return {
      r: 0.6,
      g: 0.7,
      b: 0.9,
    };
  }

  /**
   * Get shader code for sky rendering
   */
  public getShaderCode(): string {
    return skyDomeShader;
  }

  public dispose(): void {
    // Cleanup if needed
  }
}
