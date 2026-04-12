import {
  Constants,
  RawTexture,
  Scene,
  Texture,
  Vector3,
} from '@babylonjs/core';

export interface RippleFluxSample {
  height: number;
  normal: Vector3;
}

export interface RippleFluxParameters {
  damping: number;
  propagation: number;
}

export interface RippleFluxConfig {
  resolution?: number;
  domainSize?: number;
  domainWidth?: number;
  domainHeight?: number;
  centerX?: number;
  centerZ?: number;
  fixedTimeStep?: number;
}

const DEFAULT_RESOLUTION = 128;
const DEFAULT_DOMAIN_SIZE = 120;
const DEFAULT_FIXED_TIME_STEP = 1 / 60;

export class RippleFluxSimulation {
  private readonly resolution: number;
  private minX: number;
  private minZ: number;
  private domainWidth: number;
  private domainHeight: number;
  private damping = 0.965;
  private propagation = 0.9;
  private readonly fixedTimeStep: number;
  private readonly current: Float32Array;
  private readonly previous: Float32Array;
  private readonly next: Float32Array;
  private readonly textureData: Float32Array;
  private readonly texture: RawTexture | null;
  private accumulator = 0;

  constructor(scene?: Scene | null, config: RippleFluxConfig = {}) {
    this.resolution = config.resolution ?? DEFAULT_RESOLUTION;
    const defaultDomain = config.domainSize ?? DEFAULT_DOMAIN_SIZE;
    this.domainWidth = Math.max(config.domainWidth ?? defaultDomain, 1);
    this.domainHeight = Math.max(config.domainHeight ?? defaultDomain, 1);
    const centerX = config.centerX ?? 0;
    const centerZ = config.centerZ ?? 0;
    this.minX = centerX - this.domainWidth * 0.5;
    this.minZ = centerZ - this.domainHeight * 0.5;
    this.fixedTimeStep = config.fixedTimeStep ?? DEFAULT_FIXED_TIME_STEP;

    const sampleCount = this.resolution * this.resolution;
    this.current = new Float32Array(sampleCount);
    this.previous = new Float32Array(sampleCount);
    this.next = new Float32Array(sampleCount);
    this.textureData = new Float32Array(sampleCount * 4);

    if (scene) {
      this.texture = new RawTexture(
        this.textureData,
        this.resolution,
        this.resolution,
        Constants.TEXTUREFORMAT_RGBA,
        scene,
        false,
        false,
        Texture.BILINEAR_SAMPLINGMODE,
        Constants.TEXTURETYPE_FLOAT,
      );
      this.texture.name = 'rippleFluxHeightmap';
      this.texture.wrapU = Texture.CLAMP_ADDRESSMODE;
      this.texture.wrapV = Texture.CLAMP_ADDRESSMODE;
    } else {
      this.texture = null;
    }

    this.syncTextureData();
  }

  public setCenter(x: number, z: number): void {
    this.minX = x - this.domainWidth * 0.5;
    this.minZ = z - this.domainHeight * 0.5;
  }

  public setFieldBounds(minX: number, minZ: number, width: number, height: number): void {
    this.minX = minX;
    this.minZ = minZ;
    this.domainWidth = Math.max(width, 1);
    this.domainHeight = Math.max(height, 1);
  }

  public setParameters(params: Partial<RippleFluxParameters>): void {
    if (typeof params.damping === 'number') {
      this.damping = Math.min(Math.max(params.damping, 0.8), 0.9995);
    }
    if (typeof params.propagation === 'number') {
      this.propagation = Math.min(Math.max(params.propagation, 0.05), 1.35);
    }
  }

  public getTexture(): RawTexture | null {
    return this.texture;
  }

  public getResolution(): number {
    return this.resolution;
  }

  public getTexelSize(): [number, number] {
    const value = 1 / this.resolution;
    return [value, value];
  }

  public getFieldBounds(): [number, number, number, number] {
    return [this.minX, this.minZ, this.domainWidth, this.domainHeight];
  }

  public getCellWorldSize(): number {
    return Math.min(this.getCellWorldSizeX(), this.getCellWorldSizeZ());
  }

  public update(deltaTime: number): void {
    this.accumulator = Math.min(this.accumulator + Math.max(deltaTime, 0), this.fixedTimeStep * 4);
    let stepped = false;

    while (this.accumulator >= this.fixedTimeStep) {
      this.step();
      this.accumulator -= this.fixedTimeStep;
      stepped = true;
    }

    if (stepped) {
      this.refreshTexture();
    }
  }

  public refreshTexture(): void {
    this.syncTextureData();
    this.texture?.update(this.textureData);
  }

  public disturbWorld(x: number, z: number, radius: number, strength: number): void {
    const mapped = this.worldToGrid(x, z);
    if (!mapped) {
      return;
    }

    const worldRadius = Math.max(radius, this.getCellWorldSize());
    const radiusCellsX = Math.max(1, Math.ceil(worldRadius / this.getCellWorldSizeX()));
    const radiusCellsZ = Math.max(1, Math.ceil(worldRadius / this.getCellWorldSizeZ()));
    const centerI = Math.round(mapped.x);
    const centerJ = Math.round(mapped.y);

    for (let j = centerJ - radiusCellsZ; j <= centerJ + radiusCellsZ; j += 1) {
      if (j <= 0 || j >= this.resolution - 1) {
        continue;
      }
      for (let i = centerI - radiusCellsX; i <= centerI + radiusCellsX; i += 1) {
        if (i <= 0 || i >= this.resolution - 1) {
          continue;
        }

        const dx = (i - mapped.x) * this.getCellWorldSizeX();
        const dz = (j - mapped.y) * this.getCellWorldSizeZ();
        const distance = Math.sqrt(dx * dx + dz * dz);
        if (distance > worldRadius) {
          continue;
        }

        const falloff = 0.5 * (Math.cos((distance / worldRadius) * Math.PI) + 1);
        const index = this.index(i, j);
        this.current[index] += strength * falloff;
      }
    }
  }

  public sampleWorld(x: number, z: number, amplitude = 1): RippleFluxSample {
    const height = this.sampleHeightWorld(x, z) * amplitude;
    const cellSizeX = this.getCellWorldSizeX();
    const cellSizeZ = this.getCellWorldSizeZ();
    const left = this.sampleHeightWorld(x - cellSizeX, z) * amplitude;
    const right = this.sampleHeightWorld(x + cellSizeX, z) * amplitude;
    const down = this.sampleHeightWorld(x, z - cellSizeZ) * amplitude;
    const up = this.sampleHeightWorld(x, z + cellSizeZ) * amplitude;
    const normal = new Vector3(
      -(right - left) / Math.max(cellSizeX * 2, 0.0001),
      1,
      -(up - down) / Math.max(cellSizeZ * 2, 0.0001),
    ).normalize();

    return { height, normal };
  }

  public dispose(): void {
    this.texture?.dispose();
  }

  private step(): void {
    for (let j = 1; j < this.resolution - 1; j += 1) {
      for (let i = 1; i < this.resolution - 1; i += 1) {
        const index = this.index(i, j);
        const north = this.current[this.index(i, j + 1)];
        const south = this.current[this.index(i, j - 1)];
        const east = this.current[this.index(i + 1, j)];
        const west = this.current[this.index(i - 1, j)];
        const currentHeight = this.current[index];
        const previousHeight = this.previous[index];
        const average = (north + south + east + west) * 0.25;
        const velocity = (currentHeight - previousHeight) + (average - currentHeight) * this.propagation;
        this.next[index] = (currentHeight + velocity) * this.damping;
      }
    }

    for (let i = 0; i < this.resolution; i += 1) {
      this.next[this.index(i, 0)] = 0;
      this.next[this.index(i, this.resolution - 1)] = 0;
      this.next[this.index(0, i)] = 0;
      this.next[this.index(this.resolution - 1, i)] = 0;
    }

    this.previous.set(this.current);
    this.current.set(this.next);
    this.next.fill(0);
  }

  private syncTextureData(): void {
    let offset = 0;
    for (let index = 0; index < this.current.length; index += 1) {
      this.textureData[offset] = this.current[index];
      this.textureData[offset + 1] = 0;
      this.textureData[offset + 2] = 0;
      this.textureData[offset + 3] = 1;
      offset += 4;
    }
  }

  private sampleHeightWorld(x: number, z: number): number {
    const mapped = this.worldToGrid(x, z);
    if (!mapped) {
      return 0;
    }

    const x0 = Math.floor(mapped.x);
    const y0 = Math.floor(mapped.y);
    const x1 = Math.min(x0 + 1, this.resolution - 1);
    const y1 = Math.min(y0 + 1, this.resolution - 1);
    const tx = mapped.x - x0;
    const ty = mapped.y - y0;

    const h00 = this.current[this.index(x0, y0)];
    const h10 = this.current[this.index(x1, y0)];
    const h01 = this.current[this.index(x0, y1)];
    const h11 = this.current[this.index(x1, y1)];

    const hx0 = h00 + (h10 - h00) * tx;
    const hx1 = h01 + (h11 - h01) * tx;
    return hx0 + (hx1 - hx0) * ty;
  }

  private worldToGrid(x: number, z: number): { x: number; y: number } | null {
    const normalizedX = (x - this.minX) / this.domainWidth;
    const normalizedY = (z - this.minZ) / this.domainHeight;

    if (normalizedX < 0 || normalizedX > 1 || normalizedY < 0 || normalizedY > 1) {
      return null;
    }

    return {
      x: normalizedX * (this.resolution - 1),
      y: normalizedY * (this.resolution - 1),
    };
  }

  private index(i: number, j: number): number {
    return j * this.resolution + i;
  }

  private getCellWorldSizeX(): number {
    return this.domainWidth / Math.max(this.resolution - 1, 1);
  }

  private getCellWorldSizeZ(): number {
    return this.domainHeight / Math.max(this.resolution - 1, 1);
  }
}
