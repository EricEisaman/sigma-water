/**
 * Performance HUD - Real-time statistics overlay
 */

export interface PerformanceStats {
  fps: number;
  frameTime: number;
  gpuMemory: number;
  particleCount: number;
  boatCount: number;
  meshVertices: number;
  meshTriangles: number;
  lodLevel: number;
  cameraDistance: number;
  sunIntensity: number;
  underwaterDepth: number;
}

export class PerformanceHUD {
  private stats: PerformanceStats = {
    fps: 0,
    frameTime: 0,
    gpuMemory: 0,
    particleCount: 0,
    boatCount: 0,
    meshVertices: 0,
    meshTriangles: 0,
    lodLevel: 0,
    cameraDistance: 0,
    sunIntensity: 1.0,
    underwaterDepth: 0,
  };

  private frameCount: number = 0;
  private frameTimeAccum: number = 0;
  private updateInterval: number = 0.5; // Update HUD every 0.5 seconds
  private updateTimer: number = 0;
  private enabled: boolean = true;

  constructor() {}

  /**
   * Update HUD statistics
   */
  public update(deltaTime: number, newStats: Partial<PerformanceStats>): void {
    this.frameCount++;
    this.frameTimeAccum += deltaTime;
    this.updateTimer += deltaTime;

    // Update provided stats
    Object.assign(this.stats, newStats);

    // Update FPS every interval
    if (this.updateTimer >= this.updateInterval) {
      this.stats.fps = Math.round(this.frameCount / this.updateTimer);
      this.stats.frameTime = (1000 / this.stats.fps).toFixed(2) as any;

      this.frameCount = 0;
      this.updateTimer = 0;
    }
  }

  /**
   * Get formatted HUD text
   */
  public getHUDText(): string {
    if (!this.enabled) return "";

    const lines = [
      "=== PERFORMANCE HUD ===",
      `FPS: ${this.stats.fps} (${this.stats.frameTime}ms)`,
      `GPU Memory: ${(this.stats.gpuMemory / 1024 / 1024).toFixed(2)}MB`,
      `Particles: ${this.stats.particleCount}`,
      `Boats: ${this.stats.boatCount}`,
      `Mesh: ${this.stats.meshVertices} vertices, ${this.stats.meshTriangles} triangles`,
      `LOD Level: ${this.stats.lodLevel}`,
      `Camera Distance: ${this.stats.cameraDistance.toFixed(1)}m`,
      `Sun Intensity: ${this.stats.sunIntensity.toFixed(2)}`,
      `Underwater Depth: ${this.stats.underwaterDepth.toFixed(1)}m`,
    ];

    return lines.join("\n");
  }

  /**
   * Get stats as JSON
   */
  public getStats(): PerformanceStats {
    return { ...this.stats };
  }

  /**
   * Toggle HUD visibility
   */
  public toggle(): void {
    this.enabled = !this.enabled;
  }

  /**
   * Set HUD visibility
   */
  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Get HUD visibility
   */
  public isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get HTML element for rendering HUD
   */
  public getHUDElement(): HTMLElement {
    const div = document.createElement("div");
    div.id = "performance-hud";
    div.style.cssText = `
      position: fixed;
      top: 10px;
      left: 10px;
      background: rgba(0, 0, 0, 0.8);
      color: #00ff00;
      font-family: monospace;
      font-size: 12px;
      padding: 10px;
      border: 1px solid #00ff00;
      border-radius: 4px;
      z-index: 1000;
      white-space: pre;
      max-width: 300px;
      display: ${this.enabled ? "block" : "none"};
    `;
    div.textContent = this.getHUDText();
    return div;
  }

  /**
   * Update HUD element
   */
  public updateHUDElement(element: HTMLElement): void {
    element.textContent = this.getHUDText();
    element.style.display = this.enabled ? "block" : "none";
  }

  public dispose(): void {
    // Cleanup if needed
  }
}
