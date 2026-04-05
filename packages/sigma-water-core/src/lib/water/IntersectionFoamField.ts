import {
  AbstractMesh,
  Constants,
  Mesh,
  RawTexture,
  Scene,
  Texture,
  Vector3,
  VertexBuffer,
} from '@babylonjs/core';

export interface IntersectionFoamField {
  texture: RawTexture;
  bounds: [number, number, number, number];
  maxDistance: number;
}

export interface BuildIntersectionFoamFieldOptions {
  scene: Scene;
  meshes: AbstractMesh[];
  resolution: number;
  textureName: string;
  marginScale?: number;
  marginMin?: number;
}

type ProjectedTriangle = {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  x2: number;
  z2: number;
};

type Bounds2D = {
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
};

const EPSILON = 1e-6;

function isRenderableMesh(mesh: AbstractMesh): mesh is Mesh {
  return mesh instanceof Mesh && !!mesh.getVerticesData(VertexBuffer.PositionKind) && !!mesh.getIndices();
}

function triangleArea2(
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  x2: number,
  z2: number
): number {
  return (x1 - x0) * (z2 - z0) - (z1 - z0) * (x2 - x0);
}

function pointInTriangle(
  px: number,
  pz: number,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  x2: number,
  z2: number
): boolean {
  const a = triangleArea2(x0, z0, x1, z1, px, pz);
  const b = triangleArea2(x1, z1, x2, z2, px, pz);
  const c = triangleArea2(x2, z2, x0, z0, px, pz);
  const hasNeg = a < 0 || b < 0 || c < 0;
  const hasPos = a > 0 || b > 0 || c > 0;
  return !(hasNeg && hasPos);
}

function collectProjectedTriangles(meshes: AbstractMesh[]): { triangles: ProjectedTriangle[]; bounds: Bounds2D | null } {
  const triangles: ProjectedTriangle[] = [];
  let minX = Number.POSITIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;

  const transformed = new Vector3();

  for (const mesh of meshes) {
    if (!mesh.isEnabled() || !isRenderableMesh(mesh)) {
      continue;
    }

    const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
    const indices = mesh.getIndices();
    if (!positions || !indices || positions.length < 9 || indices.length < 3) {
      continue;
    }

    const vertexCount = positions.length / 3;
    const projected = new Float32Array(vertexCount * 2);
    const world = mesh.getWorldMatrix();

    for (let i = 0; i < vertexCount; i += 1) {
      const base = i * 3;
      Vector3.TransformCoordinatesFromFloatsToRef(
        positions[base],
        positions[base + 1],
        positions[base + 2],
        world,
        transformed
      );
      projected[i * 2] = transformed.x;
      projected[i * 2 + 1] = transformed.z;
      minX = Math.min(minX, transformed.x);
      minZ = Math.min(minZ, transformed.z);
      maxX = Math.max(maxX, transformed.x);
      maxZ = Math.max(maxZ, transformed.z);
    }

    for (let i = 0; i < indices.length; i += 3) {
      const i0 = indices[i];
      const i1 = indices[i + 1];
      const i2 = indices[i + 2];
      if (i0 < 0 || i1 < 0 || i2 < 0 || i0 >= vertexCount || i1 >= vertexCount || i2 >= vertexCount) {
        continue;
      }

      const x0 = projected[i0 * 2];
      const z0 = projected[i0 * 2 + 1];
      const x1 = projected[i1 * 2];
      const z1 = projected[i1 * 2 + 1];
      const x2 = projected[i2 * 2];
      const z2 = projected[i2 * 2 + 1];

      if (Math.abs(triangleArea2(x0, z0, x1, z1, x2, z2)) <= EPSILON) {
        continue;
      }

      triangles.push({ x0, z0, x1, z1, x2, z2 });
    }
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minZ) || !Number.isFinite(maxX) || !Number.isFinite(maxZ)) {
    return { triangles, bounds: null };
  }

  return {
    triangles,
    bounds: { minX, minZ, maxX, maxZ },
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function buildMask(
  triangles: ProjectedTriangle[],
  width: number,
  height: number,
  minX: number,
  minZ: number,
  sizeX: number,
  sizeZ: number
): Uint8Array {
  const mask = new Uint8Array(width * height);

  for (const tri of triangles) {
    const triMinX = Math.min(tri.x0, tri.x1, tri.x2);
    const triMaxX = Math.max(tri.x0, tri.x1, tri.x2);
    const triMinZ = Math.min(tri.z0, tri.z1, tri.z2);
    const triMaxZ = Math.max(tri.z0, tri.z1, tri.z2);

    const pxMin = clamp(Math.floor(((triMinX - minX) / sizeX) * width), 0, width - 1);
    const pxMax = clamp(Math.ceil(((triMaxX - minX) / sizeX) * width), 0, width - 1);
    const pyMin = clamp(Math.floor(((triMinZ - minZ) / sizeZ) * height), 0, height - 1);
    const pyMax = clamp(Math.ceil(((triMaxZ - minZ) / sizeZ) * height), 0, height - 1);

    for (let py = pyMin; py <= pyMax; py += 1) {
      const pz = minZ + ((py + 0.5) / height) * sizeZ;
      for (let px = pxMin; px <= pxMax; px += 1) {
        const pxWorld = minX + ((px + 0.5) / width) * sizeX;
        if (pointInTriangle(pxWorld, pz, tri.x0, tri.z0, tri.x1, tri.z1, tri.x2, tri.z2)) {
          mask[py * width + px] = 1;
        }
      }
    }
  }

  return mask;
}

function runChamferDistanceTransform(distance: Float32Array, width: number, height: number): void {
  const wDiagonal = 1.4142135;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = y * width + x;
      let d = distance[idx];

      if (x > 0) {
        d = Math.min(d, distance[idx - 1] + 1);
      }
      if (y > 0) {
        d = Math.min(d, distance[idx - width] + 1);
        if (x > 0) {
          d = Math.min(d, distance[idx - width - 1] + wDiagonal);
        }
        if (x + 1 < width) {
          d = Math.min(d, distance[idx - width + 1] + wDiagonal);
        }
      }

      distance[idx] = d;
    }
  }

  for (let y = height - 1; y >= 0; y -= 1) {
    for (let x = width - 1; x >= 0; x -= 1) {
      const idx = y * width + x;
      let d = distance[idx];

      if (x + 1 < width) {
        d = Math.min(d, distance[idx + 1] + 1);
      }
      if (y + 1 < height) {
        d = Math.min(d, distance[idx + width] + 1);
        if (x > 0) {
          d = Math.min(d, distance[idx + width - 1] + wDiagonal);
        }
        if (x + 1 < width) {
          d = Math.min(d, distance[idx + width + 1] + wDiagonal);
        }
      }

      distance[idx] = d;
    }
  }
}

function computeSignedDistance(mask: Uint8Array, width: number, height: number): Float32Array {
  const pixelCount = width * height;
  const inf = 1e9;
  const distToInside = new Float32Array(pixelCount);
  const distToOutside = new Float32Array(pixelCount);
  const signed = new Float32Array(pixelCount);

  for (let i = 0; i < pixelCount; i += 1) {
    const inside = mask[i] === 1;
    distToInside[i] = inside ? 0 : inf;
    distToOutside[i] = inside ? inf : 0;
  }

  runChamferDistanceTransform(distToInside, width, height);
  runChamferDistanceTransform(distToOutside, width, height);

  for (let i = 0; i < pixelCount; i += 1) {
    if (mask[i] === 1) {
      signed[i] = -(distToOutside[i] - 0.5);
    } else {
      signed[i] = distToInside[i] - 0.5;
    }
  }

  return signed;
}

function encodeSignedDistanceTexture(
  signedDistancePixels: Float32Array,
  width: number,
  height: number,
  maxDistanceWorld: number,
  texelWorld: number
): Uint8Array {
  const data = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = y * width + x;

      const signedWorld = signedDistancePixels[idx] * texelWorld;
      const encoded = clamp(0.5 + signedWorld / (2 * maxDistanceWorld), 0, 1);
      const out = idx * 4;
      const value = Math.round(encoded * 255);
      data[out] = value;
      data[out + 1] = value;
      data[out + 2] = value;
      data[out + 3] = 255;
    }
  }

  return data;
}

export function buildIntersectionFoamField(options: BuildIntersectionFoamFieldOptions): IntersectionFoamField | null {
  const resolution = Math.max(32, Math.min(512, Math.floor(options.resolution)));
  const { triangles, bounds } = collectProjectedTriangles(options.meshes);
  if (!bounds || triangles.length === 0) {
    return null;
  }

  const marginScale = options.marginScale ?? 0.06;
  const marginMin = options.marginMin ?? 0.5;
  const baseSizeX = Math.max(bounds.maxX - bounds.minX, 0.2);
  const baseSizeZ = Math.max(bounds.maxZ - bounds.minZ, 0.2);
  const margin = Math.max(Math.max(baseSizeX, baseSizeZ) * marginScale, marginMin);

  const minX = bounds.minX - margin;
  const minZ = bounds.minZ - margin;
  const sizeX = baseSizeX + margin * 2;
  const sizeZ = baseSizeZ + margin * 2;

  const width = resolution;
  const height = resolution;
  const mask = buildMask(triangles, width, height, minX, minZ, sizeX, sizeZ);
  let insideCount = 0;
  for (let i = 0; i < mask.length; i += 1) {
    insideCount += mask[i];
  }
  if (insideCount === 0 || insideCount === mask.length) {
    return null;
  }

  const signedDistancePixels = computeSignedDistance(mask, width, height);
  const texelWorld = Math.max(sizeX / width, sizeZ / height);
  const maxDistanceWorld = Math.max(Math.max(sizeX, sizeZ) * 0.5, texelWorld * 4);
  const data = encodeSignedDistanceTexture(signedDistancePixels, width, height, maxDistanceWorld, texelWorld);

  const texture = new RawTexture(
    data,
    width,
    height,
    Constants.TEXTUREFORMAT_RGBA,
    options.scene,
    false,
    false,
    Texture.BILINEAR_SAMPLINGMODE,
    Constants.TEXTURETYPE_UNSIGNED_BYTE
  );
  texture.name = options.textureName;
  texture.wrapU = Texture.CLAMP_ADDRESSMODE;
  texture.wrapV = Texture.CLAMP_ADDRESSMODE;

  return {
    texture,
    bounds: [minX, minZ, sizeX, sizeZ],
    maxDistance: maxDistanceWorld,
  };
}
