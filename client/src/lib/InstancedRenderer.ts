/**
 * Instanced Renderer - GPU instancing for efficient rendering of multiple boats
 */

export interface InstanceData {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scale: { x: number; y: number; z: number };
}

export class InstancedRenderer {
  private instances: InstanceData[] = [];
  private instanceBuffer: GPUBuffer | null = null;
  private maxInstances = 256;

  constructor(private device: GPUDevice) {}

  /**
   * Add instance data
   */
  public addInstance(data: InstanceData): void {
    if (this.instances.length < this.maxInstances) {
      this.instances.push(data);
    }
  }

  /**
   * Clear all instances
   */
  public clearInstances(): void {
    this.instances = [];
  }

  /**
   * Update instance buffer on GPU
   */
  public updateBuffer(queue: GPUQueue): void {
    if (this.instances.length === 0) return;

    // Create instance data array (4x4 matrix per instance)
    const instanceData = new Float32Array(this.instances.length * 16);

    for (let i = 0; i < this.instances.length; i++) {
      const inst = this.instances[i];
      const matrix = this.createTransformMatrix(inst);
      instanceData.set(matrix, i * 16);
    }

    // Create or update buffer
    // WebGPU buffer usage flags: COPY_SRC=1, COPY_DST=2, UNIFORM=4, STORAGE=8
    const STORAGE = 8;
    const COPY_DST = 2;
    if (!this.instanceBuffer) {
      this.instanceBuffer = this.device.createBuffer({
        size: instanceData.byteLength,
        usage: STORAGE | COPY_DST, // STORAGE | COPY_DST = 8 | 2 = 10
        mappedAtCreation: false,
      });
    }
    queue.writeBuffer(this.instanceBuffer, 0, instanceData);
  }

  /**
   * Create 4x4 transformation matrix
   */
  private createTransformMatrix(inst: InstanceData): Float32Array {
    const matrix = new Float32Array(16);

    // Identity
    matrix[0] = 1;
    matrix[5] = 1;
    matrix[10] = 1;
    matrix[15] = 1;

    // Apply scale
    matrix[0] *= inst.scale.x;
    matrix[5] *= inst.scale.y;
    matrix[10] *= inst.scale.z;

    // Apply rotations (simplified Euler)
    const cosX = Math.cos(inst.rotation.x);
    const sinX = Math.sin(inst.rotation.x);
    const cosY = Math.cos(inst.rotation.y);
    const sinY = Math.sin(inst.rotation.y);
    const cosZ = Math.cos(inst.rotation.z);
    const sinZ = Math.sin(inst.rotation.z);

    // Rotation matrix (YXZ order)
    const rotMatrix = [
      cosY * cosZ - sinY * sinX * sinZ,
      -cosX * sinZ,
      sinY * cosZ + cosY * sinX * sinZ,
      0,
      cosY * sinZ + sinY * sinX * cosZ,
      cosX * cosZ,
      sinY * sinZ - cosY * sinX * cosZ,
      0,
      -sinY * cosX,
      sinX,
      cosY * cosX,
      0,
      inst.position.x,
      inst.position.y,
      inst.position.z,
      1,
    ];

    return new Float32Array(rotMatrix);
  }

  /**
   * Get instance buffer
   */
  public getBuffer(): GPUBuffer | null {
    return this.instanceBuffer;
  }

  /**
   * Get instance count
   */
  public getInstanceCount(): number {
    return this.instances.length;
  }

  /**
   * Get instancing shader code
   */
  public getShaderCode(): string {
    return `
      struct Instance {
        transform: mat4x4<f32>,
      }

      @group(0) @binding(1) var<storage> instances: array<Instance>;

      fn getInstanceTransform(instanceIndex: u32) -> mat4x4<f32> {
        return instances[instanceIndex].transform;
      }
    `;
  }

  public dispose(): void {
    if (this.instanceBuffer) {
      this.instanceBuffer.destroy();
      this.instanceBuffer = null;
    }
    this.instances = [];
  }
}
