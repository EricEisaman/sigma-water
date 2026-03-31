/**
 * Mesh LOD System - Distance-based level-of-detail for ocean mesh
 */

export interface LODLevel {
  gridSize: number;
  maxDistance: number;
  vertexCount: number;
  indexCount: number;
}

export class MeshLOD {
  private lodLevels: LODLevel[] = [];
  private currentLOD: number = 0;
  private cameraDistance: number = 0;

  constructor() {
    this.initializeLODLevels();
  }

  /**
   * Initialize LOD levels
   */
  private initializeLODLevels(): void {
    // LOD 0: High detail (close)
    this.lodLevels.push({
      gridSize: 64,
      maxDistance: 50,
      vertexCount: 64 * 64,
      indexCount: (64 - 1) * (64 - 1) * 6,
    });

    // LOD 1: Medium detail
    this.lodLevels.push({
      gridSize: 32,
      maxDistance: 150,
      vertexCount: 32 * 32,
      indexCount: (32 - 1) * (32 - 1) * 6,
    });

    // LOD 2: Low detail
    this.lodLevels.push({
      gridSize: 16,
      maxDistance: 300,
      vertexCount: 16 * 16,
      indexCount: (16 - 1) * (16 - 1) * 6,
    });

    // LOD 3: Ultra low detail (far)
    this.lodLevels.push({
      gridSize: 8,
      maxDistance: 1000,
      vertexCount: 8 * 8,
      indexCount: (8 - 1) * (8 - 1) * 6,
    });
  }

  /**
   * Update LOD based on camera distance
   */
  public updateLOD(cameraPos: { x: number; y: number; z: number }): number {
    // Calculate distance from camera to ocean center
    this.cameraDistance = Math.sqrt(cameraPos.x ** 2 + cameraPos.z ** 2);

    // Find appropriate LOD level
    let newLOD = this.lodLevels.length - 1;
    for (let i = 0; i < this.lodLevels.length; i++) {
      if (this.cameraDistance < this.lodLevels[i].maxDistance) {
        newLOD = i;
        break;
      }
    }

    this.currentLOD = newLOD;
    return newLOD;
  }

  /**
   * Get current LOD level
   */
  public getCurrentLOD(): LODLevel {
    return this.lodLevels[this.currentLOD];
  }

  /**
   * Get current LOD index
   */
  public getCurrentLODIndex(): number {
    return this.currentLOD;
  }

  /**
   * Get all LOD levels
   */
  public getLODLevels(): LODLevel[] {
    return this.lodLevels;
  }

  /**
   * Generate mesh data for a specific LOD level
   */
  public generateMeshData(
    lodIndex: number
  ): { vertices: Float32Array; indices: Uint32Array } {
    const lod = this.lodLevels[lodIndex];
    const gridSize = lod.gridSize;
    const spacing = 400 / gridSize;

    // Generate vertices
    const vertices = new Float32Array(gridSize * gridSize * 4); // x, y, z, padding per vertex
    let vertexIdx = 0;

    for (let z = 0; z < gridSize; z++) {
      for (let x = 0; x < gridSize; x++) {
        const worldX = (x - gridSize / 2) * spacing;
        const worldZ = (z - gridSize / 2) * spacing;

        vertices[vertexIdx++] = worldX;
        vertices[vertexIdx++] = 0; // y (will be updated by compute shader)
        vertices[vertexIdx++] = worldZ;
        vertices[vertexIdx++] = 0; // padding
      }
    }

    // Generate indices
    const indices = new Uint32Array((gridSize - 1) * (gridSize - 1) * 6);
    let indexIdx = 0;

    for (let z = 0; z < gridSize - 1; z++) {
      for (let x = 0; x < gridSize - 1; x++) {
        const a = z * gridSize + x;
        const b = a + 1;
        const c = a + gridSize;
        const d = c + 1;

        // First triangle
        indices[indexIdx++] = a;
        indices[indexIdx++] = c;
        indices[indexIdx++] = b;

        // Second triangle
        indices[indexIdx++] = b;
        indices[indexIdx++] = c;
        indices[indexIdx++] = d;
      }
    }

    return { vertices, indices };
  }

  /**
   * Get camera distance to ocean
   */
  public getCameraDistance(): number {
    return this.cameraDistance;
  }

  /**
   * Get LOD transition info for debugging
   */
  public getLODInfo(): string {
    const lod = this.getCurrentLOD();
    return `LOD ${this.currentLOD}: ${lod.gridSize}x${lod.gridSize} grid (${lod.vertexCount} vertices)`;
  }

  public dispose(): void {
    this.lodLevels = [];
  }
}
