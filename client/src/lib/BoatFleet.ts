/**
 * Boat Fleet Manager - Manages multiple boats with collision detection
 */

import { Boat } from './Boat';

export class BoatFleet {
  private boats: Boat[] = [];
  private maxBoats = 5;
  private boatSpacing = 40;

  constructor() {
    this.initializeFleet();
  }

  private initializeFleet(): void {
    // Create a small fleet of boats in formation
    for (let i = 0; i < this.maxBoats; i++) {
      const boat = new Boat();
      
      // Arrange boats in a line formation
      const offsetX = (i - this.maxBoats / 2) * this.boatSpacing;
      const offsetZ = -50 + (i % 2) * 30;
      
      boat.setPosition(offsetX, 0, offsetZ);
      this.boats.push(boat);
    }
  }

  /**
   * Update all boats in the fleet
   */
  public update(deltaTime: number, heightmapData: Float32Array): void {
    // Update each boat
    for (const boat of this.boats) {
      boat.setHeightmapData(heightmapData);
      boat.update(deltaTime);
    }

    // Simple collision avoidance
    this.updateCollisions();
  }

  /**
   * Simple collision detection and avoidance
   */
  private updateCollisions(): void {
    const collisionDistance = 25;

    for (let i = 0; i < this.boats.length; i++) {
      for (let j = i + 1; j < this.boats.length; j++) {
        const posA = this.boats[i].getPosition();
        const posB = this.boats[j].getPosition();

        const dx = posB.x - posA.x;
        const dz = posB.z - posA.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist < collisionDistance) {
          // Push boats apart
          const pushForce = (collisionDistance - dist) / 2;
          const angle = Math.atan2(dz, dx);

          this.boats[i].addForce(-Math.cos(angle) * pushForce, 0, -Math.sin(angle) * pushForce);
          this.boats[j].addForce(Math.cos(angle) * pushForce, 0, Math.sin(angle) * pushForce);
        }
      }
    }
  }

  /**
   * Get all boats for rendering
   */
  public getBoats(): Boat[] {
    return this.boats;
  }

  /**
   * Get boat count
   */
  public getBoatCount(): number {
    return this.boats.length;
  }

  public dispose(): void {
    this.boats = [];
  }
}
