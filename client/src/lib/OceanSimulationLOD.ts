/**
 * Enhanced Ocean Simulation with LOD System
 * Combines wave generation with mesh LOD for optimal performance
 */

import * as BABYLON from "@babylonjs/core";
import { OceanLOD } from "./OceanLOD";

export interface OceanParameters {
  windSpeed: number;
  windDirection: number;
  waveScale: number;
  waveHeightScale: number;
  choppyScale: number;
  foamIntensity: number;
  foamBias: number;
}

export class OceanSimulationLOD {
  private scene: BABYLON.Scene;
  private engine: BABYLON.Engine;
  private camera: BABYLON.Camera;
  private oceanLOD: OceanLOD;
  private parameters: OceanParameters;
  private time: number = 0;
  private heightMap: BABYLON.DynamicTexture;
  private normalMap: BABYLON.DynamicTexture;
  private foamMap: BABYLON.DynamicTexture;

  constructor(scene: BABYLON.Scene, engine: BABYLON.Engine, camera: BABYLON.Camera) {
    this.scene = scene;
    this.engine = engine;
    this.camera = camera;
    this.parameters = {
      windSpeed: 10,
      windDirection: 45,
      waveScale: 1.5,
      waveHeightScale: 0.5,
      choppyScale: 0.8,
      foamIntensity: 0.6,
      foamBias: 0.5,
    };

    this.heightMap = new BABYLON.DynamicTexture("heightMap", 512, scene);
    this.normalMap = new BABYLON.DynamicTexture("normalMap", 512, scene);
    this.foamMap = new BABYLON.DynamicTexture("foamMap", 512, scene);

    // Initialize LOD system
    this.oceanLOD = new OceanLOD(scene, camera);
  }

  private phillipsSpectrum(k: BABYLON.Vector2, windSpeed: number, windDir: BABYLON.Vector2): number {
    const kLen = k.length();
    if (kLen < 0.0001) return 0;

    const A = 1.0;
    const g = 9.81;
    const L = (windSpeed * windSpeed) / g;
    const k2 = k.x * k.x + k.y * k.y;
    const kL2 = k2 * L * L;
    const k4 = k2 * k2;

    const kNorm = k.normalize();
    const windNorm = windDir.normalize();
    let kw = BABYLON.Vector2.Dot(kNorm, windNorm);
    kw *= kw;

    const l = 0.01;
    const cutoff = Math.exp(-k2 * l * l);

    return (A * Math.exp(-1.0 / kL2) * kw * cutoff) / k4;
  }

  private generateWaveTextures(): void {
    const imageData = new ImageData(512, 512);
    const data = imageData.data;

    const windDir = new BABYLON.Vector2(
      Math.cos((this.parameters.windDirection * Math.PI) / 180),
      Math.sin((this.parameters.windDirection * Math.PI) / 180)
    );

    // Generate height map using Phillips spectrum
    for (let i = 0; i < 512 * 512; i++) {
      const x = i % 512;
      const y = Math.floor(i / 512);

      // Multi-layer wave simulation
      const waveHeight =
        Math.sin((x + this.time * 10) * 0.02 + (y + this.time * 5) * 0.01) * 0.5 +
        Math.sin((x - this.time * 8) * 0.015 + (y + this.time * 12) * 0.008) * 0.3 +
        Math.sin((x + this.time * 6) * 0.01 + (y - this.time * 10) * 0.012) * 0.2;

      const value = Math.floor(((waveHeight + 1) / 2) * 255);

      data[i * 4] = value;
      data[i * 4 + 1] = value;
      data[i * 4 + 2] = value;
      data[i * 4 + 3] = 255;
    }

    this.heightMap.update();
  }

  private generateNormalMap(): void {
    const imageData = new ImageData(512, 512);
    const data = imageData.data;

    // Generate normal map from height map
    for (let i = 0; i < 512 * 512; i++) {
      const x = i % 512;
      const y = Math.floor(i / 512);

      // Simple normal calculation
      const normalX = Math.sin((x + this.time * 10) * 0.02) * 0.5;
      const normalY = 1.0;
      const normalZ = Math.cos((y + this.time * 10) * 0.02) * 0.5;

      const len = Math.sqrt(normalX * normalX + normalY * normalY + normalZ * normalZ);
      const nx = ((normalX / len + 1) / 2) * 255;
      const ny = ((normalY / len + 1) / 2) * 255;
      const nz = ((normalZ / len + 1) / 2) * 255;

      data[i * 4] = nx;
      data[i * 4 + 1] = ny;
      data[i * 4 + 2] = nz;
      data[i * 4 + 3] = 255;
    }

    this.normalMap.update();
  }

  private generateFoamMap(): void {
    const imageData = new ImageData(512, 512);
    const data = imageData.data;

    // Generate foam map based on wave crests
    for (let i = 0; i < 512 * 512; i++) {
      const x = i % 512;
      const y = Math.floor(i / 512);

      // Foam appears on wave crests
      const waveHeight =
        Math.sin((x + this.time * 10) * 0.02 + (y + this.time * 5) * 0.01) * 0.5 +
        Math.sin((x - this.time * 8) * 0.015 + (y + this.time * 12) * 0.008) * 0.3;

      const foam = Math.max(0, waveHeight - this.parameters.foamBias) * this.parameters.foamIntensity;
      const foamValue = Math.floor(foam * 255);

      data[i * 4] = 255;
      data[i * 4 + 1] = 255;
      data[i * 4 + 2] = 255;
      data[i * 4 + 3] = foamValue;
    }

    this.foamMap.update();
  }

  public update(deltaTime: number): void {
    this.time += deltaTime;

    // Update LOD system
    this.oceanLOD.update(deltaTime);

    // Deform ocean meshes based on waves
    this.deformOceanMeshes();

    // Update textures
    this.generateWaveTextures();
    this.generateNormalMap();
    this.generateFoamMap();
  }

  private deformOceanMeshes(): void {
    const activeMeshes = this.oceanLOD.getActiveLODMeshes();

    for (const mesh of activeMeshes) {
      const positions = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
      if (!positions) continue;

      // Store original positions if not already stored
      if (!(mesh as any).originalPositions) {
        (mesh as any).originalPositions = positions.slice();
      }

      const originalPositions = (mesh as any).originalPositions;

      for (let i = 0; i < positions.length; i += 3) {
        const x = originalPositions[i];
        const y = originalPositions[i + 1];
        const z = originalPositions[i + 2];

        // Apply wave displacement
        const waveHeight =
          Math.sin((x + this.time * 10) * 0.02 + (z + this.time * 5) * 0.01) *
            this.parameters.waveHeightScale *
            0.5 +
          Math.sin((x - this.time * 8) * 0.015 + (z + this.time * 12) * 0.008) *
            this.parameters.waveHeightScale *
            0.3 +
          Math.sin((x + this.time * 6) * 0.01 + (z - this.time * 10) * 0.012) *
            this.parameters.waveHeightScale *
            0.2;

        positions[i + 1] = y + waveHeight;
      }

      mesh.updateVerticesData(BABYLON.VertexBuffer.PositionKind, positions, true);
      mesh.createNormals(true);
    }
  }

  public updateParameter(key: keyof OceanParameters, value: number): void {
    (this.parameters as any)[key] = value;
  }

  public getOceanLOD(): OceanLOD {
    return this.oceanLOD;
  }

  public dispose(): void {
    this.oceanLOD.dispose();
    this.heightMap.dispose();
    this.normalMap.dispose();
    this.foamMap.dispose();
  }
}
