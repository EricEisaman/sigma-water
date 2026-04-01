# @sigma-water/core

Framework-agnostic Sigma Water runtime library for Babylon.js water scenes.

This package has no React dependency. It is designed to be consumed by any browser application that can provide a canvas element and Babylon.js-compatible runtime environment.

## Runtime Requirements

- Browser environment with DOM canvas support
- Babylon.js 9 runtime support via `@babylonjs/core` and `@babylonjs/loaders`
- WebGPU-capable browser for the current runtime path

## Installation

```bash
pnpm add @sigma-water/core @babylonjs/core @babylonjs/loaders
```

## Public API

### Main runtime

- `VisualOcean`
- `VisualOceanConfig`

`VisualOcean` is the primary runtime class exported by the library.

```ts
import { VisualOcean } from '@sigma-water/core';

const ocean = new VisualOcean(canvas, {
  assetBaseUrl: '/assets',
  enableGlobalListeners: true,
});

await ocean.initialize();
```

### VisualOceanConfig

```ts
type VisualOceanConfig = {
  assetBaseUrl?: string;
  environmentMapPath?: string;
  modelsBasePath?: string;
  enableGlobalListeners?: boolean;
};
```

- `assetBaseUrl`: base path for packaged runtime assets. Defaults to `/assets`.
- `environmentMapPath`: explicit environment EXR path. Defaults to `${assetBaseUrl}/images/citrus_orchard_road_puresky_1k.exr`.
- `modelsBasePath`: explicit GLB directory. Defaults to `${assetBaseUrl}/models/`.
- `enableGlobalListeners`: whether the runtime attaches resize and keyboard listeners. Defaults to `true`.

### VisualOcean methods

- `initialize(): Promise<void>`
- `dispose(): void`
- `switchShader(shaderName: string): Promise<void>`
- `switchWaterType(waterTypeId: WaterTypeId): Promise<void>`
- `updateParameter(key: string, value: number): void`
- `updateCamera(x: number, y: number, z: number): void`
- `setTopDownView(height: number): void`
- `setBoatModel(modelId: BoatModelId): Promise<void>`
- `setIslandModel(modelId: IslandModelId): Promise<void>`
- `getCurrentShader(): string`

### Water type exports

- `WATER_TYPES`
- `SHADER_CONTROL_KEYS`
- `GerstnerWaves`
- `OceanWaves`
- `ToonWater`
- `TropicalWaves`
- `StormyWaves`
- `GlassyWaves`
- `getWaterTypeById()`
- `waterTypeToId()`
- `idToWaterType()`
- `parseWaterType()`
- `serializeWaterType()`
- `parseWaterTypeId()`
- `serializeWaterTypeId()`

### Types

- `IWater`
- `IWaterType`
- `ShaderControlKey`
- `WaterMeshTypeId`
- `WaterType`
- `WaterTypeId`
- `IWaterMesh`
- `IWaterMeshConfig`
- `BoatModelId`
- `IslandModelId`
- `ObjectModelOption`

### Object model metadata

- `BOAT_MODEL_OPTIONS`
- `ISLAND_MODEL_OPTIONS`
- `isBoatModelId()`
- `isIslandModelId()`

These constants are the public source of truth for selectable built-in object models.

## Usage Example

```ts
import {
  VisualOcean,
  WATER_TYPES,
  BOAT_MODEL_OPTIONS,
  ISLAND_MODEL_OPTIONS,
} from '@sigma-water/core';

const ocean = new VisualOcean(canvas, {
  assetBaseUrl: '/assets',
});

await ocean.initialize();
await ocean.switchWaterType(WATER_TYPES[1].id);
await ocean.setBoatModel(BOAT_MODEL_OPTIONS[1].id);
await ocean.setIslandModel(ISLAND_MODEL_OPTIONS[1].id);
ocean.updateParameter('waveAmplitude', 2.2);
```

## Boundary Notes

- This package has no React imports and no React runtime dependency.
- The package is browser-oriented today because `VisualOcean` requires an `HTMLCanvasElement` and uses browser timing/input primitives.
- Internal shader registry, shader definitions, and WGSL implementation files are not part of the stable public API unless exported from `src/index.ts`.

## Consumer Guidance

- Import only from `@sigma-water/core`.
- Do not rely on deep imports into `src/lib/shaders/**` or other internal implementation folders.
- Treat the exports from `src/index.ts` as the supported public contract.
