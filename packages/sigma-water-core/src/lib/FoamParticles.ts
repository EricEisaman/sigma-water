/**
 * Foam Particle System - Wind-driven foam spray effects
 */

interface Particle {
  position: { x: number; y: number; z: number };
  velocity: { x: number; y: number; z: number };
  lifetime: number;
  maxLifetime: number;
  size: number;
}

export class FoamParticles {
  private particles: Particle[] = [];
  private maxParticles = 1000;
  private windDirection = 0;
  private windSpeed = 1;
  private emissionRate = 50; // particles per second
  private emissionAccumulator = 0;

  constructor() {
    // Initialize empty particle list
  }

  /**
   * Update particles and emit new ones
   */
  public update(deltaTime: number, windDir: number, windSpd: number, heightmapData: Float32Array): void {
    this.windDirection = windDir;
    this.windSpeed = windSpd;

    // Update existing particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      
      // Apply wind force
      const windForce = Math.sin(this.windDirection) * this.windSpeed;
      const windForceZ = Math.cos(this.windDirection) * this.windSpeed;
      
      p.velocity.x += windForce * deltaTime * 0.5;
      p.velocity.z += windForceZ * deltaTime * 0.5;
      p.velocity.y -= 9.81 * deltaTime * 0.3; // Gravity

      // Update position
      p.position.x += p.velocity.x * deltaTime;
      p.position.y += p.velocity.y * deltaTime;
      p.position.z += p.velocity.z * deltaTime;

      // Update lifetime
      p.lifetime -= deltaTime;

      // Remove dead particles
      if (p.lifetime <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // Emit new particles (only if heightmapData is available)
    if (heightmapData) {
      this.emissionAccumulator += this.emissionRate * deltaTime;
      while (this.emissionAccumulator >= 1 && this.particles.length < this.maxParticles) {
        this.emitParticle(heightmapData);
        this.emissionAccumulator -= 1;
      }
    }
  }

  /**
   * Emit a new foam particle at wave crests
   */
  private emitParticle(heightmapData: Float32Array | null): void {
    if (!heightmapData) return; // Safety check

    // Random position on ocean surface
    const x = (Math.random() - 0.5) * 400;
    const z = (Math.random() - 0.5) * 400;

    // Sample height from heightmap
    const gridX = Math.floor((x / 400 + 0.5) * 64);
    const gridZ = Math.floor((z / 400 + 0.5) * 64);
    const clampedX = Math.max(0, Math.min(63, gridX));
    const clampedZ = Math.max(0, Math.min(63, gridZ));
    const idx = (clampedZ * 64 + clampedX) * 4;
    const y = (heightmapData[idx + 1] ?? 0) + 2; // Offset above surface, default to 0

    // Random initial velocity (upward and outward)
    const angle = Math.random() * Math.PI * 2;
    const speed = 5 + Math.random() * 10;

    const particle: Particle = {
      position: { x, y, z },
      velocity: {
        x: Math.cos(angle) * speed,
        y: 8 + Math.random() * 5,
        z: Math.sin(angle) * speed,
      },
      lifetime: 2 + Math.random() * 2,
      maxLifetime: 2 + Math.random() * 2,
      size: 0.3 + Math.random() * 0.5,
    };

    this.particles.push(particle);
  }

  /**
   * Get particles for rendering
   */
  public getParticles(): Particle[] {
    return this.particles;
  }

  /**
   * Get particle count
   */
  public getParticleCount(): number {
    return this.particles.length;
  }

  /**
   * Set wind parameters
   */
  public setWind(direction: number, speed: number): void {
    this.windDirection = direction;
    this.windSpeed = speed;
  }

  public dispose(): void {
    this.particles = [];
  }
}
