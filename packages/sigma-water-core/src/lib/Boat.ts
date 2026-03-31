/**
 * Floating Boat with Buoyancy Physics
 */

export class Boat {
  private position = { x: 0, y: 0, z: 0 };
  private rotation = { x: 0, y: 0, z: 0 };
  private velocity = { x: 0, y: 0, z: 0 };

  private meshSize = 64;
  private gridSpacing = 400 / this.meshSize;
  private heightmapData: Float32Array | null = null;

  constructor() {
    this.position = { x: 0, y: 0, z: 0 };
  }

  /**
   * Set heightmap data for wave sampling
   */
  public setHeightmapData(data: Float32Array): void {
    this.heightmapData = data;
  }

  /**
   * Sample wave height at a given world position
   */
  private sampleWaveHeight(x: number, z: number): number {
    if (!this.heightmapData) return 0;

    // Convert world position to grid coordinates
    const gridX = Math.floor((x / 400 + 0.5) * this.meshSize);
    const gridZ = Math.floor((z / 400 + 0.5) * this.meshSize);

    // Clamp to grid bounds
    const clampedX = Math.max(0, Math.min(this.meshSize - 1, gridX));
    const clampedZ = Math.max(0, Math.min(this.meshSize - 1, gridZ));

    const idx = (clampedZ * this.meshSize + clampedX) * 4; // 4 floats per vec4
    return this.heightmapData[idx + 1]; // Y component
  }

  /**
   * Update boat position and rotation based on wave surface
   */
  public update(deltaTime: number): void {
    // Sample wave heights at boat corners for pitch/roll calculation
    const boatLength = 20;
    const boatWidth = 8;

    const frontHeight = this.sampleWaveHeight(
      this.position.x,
      this.position.z + boatLength / 2
    );
    const backHeight = this.sampleWaveHeight(
      this.position.x,
      this.position.z - boatLength / 2
    );
    const leftHeight = this.sampleWaveHeight(
      this.position.x - boatWidth / 2,
      this.position.z
    );
    const rightHeight = this.sampleWaveHeight(
      this.position.x + boatWidth / 2,
      this.position.z
    );
    const centerHeight = this.sampleWaveHeight(
      this.position.x,
      this.position.z
    );

    // Average height for boat Y position (buoyancy)
    const avgHeight = (frontHeight + backHeight + leftHeight + rightHeight + centerHeight) / 5;
    this.position.y = avgHeight + 2; // Offset for boat draft

    // Calculate pitch (front-back tilt)
    this.rotation.x = Math.atan2(frontHeight - backHeight, boatLength) * 0.5;

    // Calculate roll (left-right tilt)
    this.rotation.z = Math.atan2(rightHeight - leftHeight, boatWidth) * 0.5;

    // Gentle yaw rotation for visual interest
    this.rotation.y += deltaTime * 0.1;

    // Damping
    this.velocity.x *= 0.95;
    this.velocity.y *= 0.95;
    this.velocity.z *= 0.95;
  }

  /**
   * Get boat transformation matrix for rendering
   */
  public getTransformMatrix(): Float32Array {
    // Create 4x4 transformation matrix
    const matrix = new Float32Array(16);

    // Identity matrix
    matrix[0] = 1;
    matrix[5] = 1;
    matrix[10] = 1;
    matrix[15] = 1;

    // Apply rotations (simplified - Euler angles)
    const cosX = Math.cos(this.rotation.x);
    const sinX = Math.sin(this.rotation.x);
    const cosY = Math.cos(this.rotation.y);
    const sinY = Math.sin(this.rotation.y);
    const cosZ = Math.cos(this.rotation.z);
    const sinZ = Math.sin(this.rotation.z);

    // Rotation matrix (YXZ order)
    const m = [
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

      this.position.x,
      this.position.y,
      this.position.z,
      1,
    ];

    return new Float32Array(m);
  }

  /**
   * Get boat geometry (simple box for now)
   */
  public getGeometry(): { vertices: number[]; indices: number[] } {
    const length = 20;
    const width = 8;
    const height = 6;

    const vertices = [
      // Front face
      -width / 2, 0, length / 2,
      width / 2, 0, length / 2,
      width / 2, height, length / 2,
      -width / 2, height, length / 2,

      // Back face
      -width / 2, 0, -length / 2,
      width / 2, 0, -length / 2,
      width / 2, height, -length / 2,
      -width / 2, height, -length / 2,

      // Top face
      -width / 2, height, length / 2,
      width / 2, height, length / 2,
      width / 2, height, -length / 2,
      -width / 2, height, -length / 2,

      // Bottom face
      -width / 2, 0, length / 2,
      width / 2, 0, length / 2,
      width / 2, 0, -length / 2,
      -width / 2, 0, -length / 2,

      // Left face
      -width / 2, 0, length / 2,
      -width / 2, 0, -length / 2,
      -width / 2, height, -length / 2,
      -width / 2, height, length / 2,

      // Right face
      width / 2, 0, length / 2,
      width / 2, 0, -length / 2,
      width / 2, height, -length / 2,
      width / 2, height, length / 2,
    ];

    const indices = [
      0, 1, 2, 0, 2, 3, // Front
      4, 6, 5, 4, 7, 6, // Back
      8, 9, 10, 8, 10, 11, // Top
      12, 14, 13, 12, 15, 14, // Bottom
      16, 18, 17, 16, 19, 18, // Left
      20, 21, 22, 20, 22, 23, // Right
    ];

    return { vertices, indices };
  }

  public getPosition() {
    return { ...this.position };
  }

  public getRotation() {
    return { ...this.rotation };
  }

  public setPosition(x: number, y: number, z: number): void {
    this.position = { x, y, z };
  }

  public addForce(fx: number, fy: number, fz: number): void {
    this.velocity.x += fx;
    this.velocity.y += fy;
    this.velocity.z += fz;
  }
}
