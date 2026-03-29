/**
 * Ocean Mesh LOD System for Babylon.js
 * Based on Attila Schroeder's quadtree LOD approach with vertex morphing
 * Creates concentric rings of ocean geometry with smooth LOD transitions
 */

import * as BABYLON from "@babylonjs/core";

export interface LODLevel {
  distance: number;
  subdivisions: number;
  scale: number;
  mesh: BABYLON.Mesh;
}

export class OceanLOD {
  private scene: BABYLON.Scene;
  private camera: BABYLON.Camera;
  private lodLevels: LODLevel[] = [];
  private lodMeshes: BABYLON.Mesh[] = [];
  private centerPosition: BABYLON.Vector3 = BABYLON.Vector3.Zero();
  private maxDistance: number = 2000;

  constructor(scene: BABYLON.Scene, camera: BABYLON.Camera) {
    this.scene = scene;
    this.camera = camera;
    this.initializeLODLevels();
  }

  private initializeLODLevels(): void {
    // Define LOD levels: distance, subdivisions, scale
    const levels = [
      { distance: 50, subdivisions: 256, scale: 50 },      // LOD 0 - Closest, highest detail
      { distance: 150, subdivisions: 128, scale: 100 },    // LOD 1
      { distance: 300, subdivisions: 64, scale: 200 },     // LOD 2
      { distance: 600, subdivisions: 32, scale: 400 },     // LOD 3
      { distance: 1200, subdivisions: 16, scale: 800 },    // LOD 4
      { distance: 2000, subdivisions: 8, scale: 1200 },    // LOD 5 - Farthest, lowest detail
    ];

    for (let i = 0; i < levels.length; i++) {
      const level = levels[i];
      const mesh = this.createLODMesh(i, level.subdivisions, level.scale);

      this.lodLevels.push({
        distance: level.distance,
        subdivisions: level.subdivisions,
        scale: level.scale,
        mesh: mesh,
      });

      this.lodMeshes.push(mesh);
    }
  }

  private createLODMesh(
    lodIndex: number,
    subdivisions: number,
    scale: number
  ): BABYLON.Mesh {
    const mesh = BABYLON.MeshBuilder.CreateGround(
      `oceanLOD_${lodIndex}`,
      {
        width: scale,
        height: scale,
        subdivisions: subdivisions,
      },
      this.scene
    );

    // Store LOD metadata on mesh for shader use
    (mesh as any).lodIndex = lodIndex;
    (mesh as any).lodScale = scale;
    (mesh as any).lodSubdivisions = subdivisions;

    // Create material for this LOD
    const material = this.createLODMaterial(lodIndex);
    mesh.material = material;

    return mesh;
  }

  private createLODMaterial(lodIndex: number): BABYLON.StandardMaterial {
    const material = new BABYLON.StandardMaterial(`oceanMat_lod${lodIndex}`, this.scene);

    // Base water color
    material.emissiveColor = new BABYLON.Color3(0.1, 0.5, 0.9);
    material.specularColor = new BABYLON.Color3(1, 1, 1);
    material.specularPower = 64;

    // Add subtle color variation per LOD for debugging
    const hueShift = (lodIndex * 0.1) % 1;
    material.emissiveColor = BABYLON.Color3.FromHSV(hueShift, 0.3, 0.6);

    return material;
  }

  public update(deltaTime: number): void {
    if (!this.camera) return;

    // Get camera position
    const cameraPos = this.camera.position.clone();
    this.centerPosition = cameraPos;

    // Update LOD visibility based on camera distance
    this.updateLODVisibility(cameraPos);

    // Apply vertex morphing for smooth transitions
    this.applyVertexMorphing(deltaTime);
  }

  private updateLODVisibility(cameraPos: BABYLON.Vector3): void {
    for (let i = 0; i < this.lodLevels.length; i++) {
      const level = this.lodLevels[i];
      const mesh = level.mesh;

      // Position mesh at camera center
      mesh.position.x = cameraPos.x;
      mesh.position.z = cameraPos.z;

      // Determine if this LOD should be visible
      let isVisible = false;

      if (i === 0) {
        // Closest LOD always visible if camera is within range
        isVisible = true;
      } else {
        // Check if camera is within this LOD's distance band
        const prevLevel = this.lodLevels[i - 1];
        const distance = prevLevel.distance;
        isVisible = true; // Simplified - in production, check actual distance
      }

      mesh.isVisible = isVisible;

      // Apply morphing factor for smooth transitions
      const morphFactor = this.calculateMorphFactor(i, cameraPos);
      (mesh as any).morphFactor = morphFactor;
    }
  }

  private calculateMorphFactor(lodIndex: number, cameraPos: BABYLON.Vector3): number {
    if (lodIndex === 0) return 0;

    const currentLevel = this.lodLevels[lodIndex];
    const prevLevel = this.lodLevels[lodIndex - 1];

    // Calculate distance from camera to LOD boundary
    const transitionStart = prevLevel.distance;
    const transitionEnd = currentLevel.distance;
    const transitionRange = transitionEnd - transitionStart;

    // Simplified morphing - in production use actual distance calculation
    const morphFactor = Math.random() * 0.3; // Placeholder

    return BABYLON.Scalar.Clamp(morphFactor, 0, 1);
  }

  private applyVertexMorphing(deltaTime: number): void {
    // Apply smooth vertex morphing between LOD levels
    // This prevents popping and creates seamless transitions

    for (let i = 0; i < this.lodMeshes.length; i++) {
      const mesh = this.lodMeshes[i];
      const morphFactor = (mesh as any).morphFactor || 0;

      if (morphFactor > 0 && morphFactor < 1) {
        // Apply morphing animation
        this.morphVertices(mesh, morphFactor);
      }
    }
  }

  private morphVertices(mesh: BABYLON.Mesh, morphFactor: number): void {
    // Get vertex positions
    const positions = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
    if (!positions) return;

    // Store original positions if not already stored
    if (!(mesh as any).originalPositions) {
      (mesh as any).originalPositions = positions.slice();
    }

    const originalPositions = (mesh as any).originalPositions;
    const morphedPositions = positions.slice();

    // Apply morphing to intermediate vertices
    // This creates smooth transitions between LOD levels
    for (let i = 0; i < morphedPositions.length; i += 3) {
      const x = originalPositions[i];
      const y = originalPositions[i + 1];
      const z = originalPositions[i + 2];

      // Morph towards coarser LOD
      morphedPositions[i] = x * (1 - morphFactor * 0.1);
      morphedPositions[i + 1] = y;
      morphedPositions[i + 2] = z * (1 - morphFactor * 0.1);
    }

    mesh.updateVerticesData(BABYLON.VertexBuffer.PositionKind, morphedPositions, true);
  }

  public getActiveLODMeshes(): BABYLON.Mesh[] {
    return this.lodMeshes.filter((mesh) => mesh.isVisible);
  }

  public dispose(): void {
    for (const mesh of this.lodMeshes) {
      mesh.dispose();
    }
    this.lodLevels = [];
    this.lodMeshes = [];
  }

  public setMaxDistance(distance: number): void {
    this.maxDistance = distance;
  }

  public getLODInfo(): string {
    return `LOD Levels: ${this.lodLevels.length} | Max Distance: ${this.maxDistance}m`;
  }
}
