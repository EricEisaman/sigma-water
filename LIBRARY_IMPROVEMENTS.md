# Sigma Water Library Improvements

## Executive Summary

This branch has solid intent but is currently a mixed app+library implementation with incomplete switching contracts. The highest-priority correction is to make the core water system a framework-agnostic library (no React dependency), with a strict WGSL-only shader pipeline, modular shader source files, and a WaterType-to-WaterMeshType registry that drives deterministic mesh/material lifecycle behavior.

## What I Found (Repo Analysis)

1. Water type switching path is inconsistent across modules.
- `client/src/lib/VisualOcean.ts` imports `./water/WaterMeshFactory`, but that module does not exist.
- `client/src/lib/VisualOcean.ts` awaits `shaderRegistry.switchTo(...)`, but `switchTo` is synchronous and returns `void`.
- `client/src/pages/Home.tsx` calls `updateParameter`, `updateCamera`, and `setTopDownView` on `VisualOcean`, but these methods are not present in `VisualOcean`.

2. Water type definitions are fragmented and out of sync.
- `client/src/lib/types/WaterTypeSystem.ts` only exposes two water types (`gerstnerWaves`, `oceanWaves`).
- `client/src/lib/shaders/definitions/index.ts` registers six shader definitions.
- Result: UI type list and registry type list can diverge.

3. "WGSL-only" and "no inline shader source" are not enforced.
- `client/src/lib/shaders/gerstnerWaves.wgsl.ts` contains GLSL source despite WGSL naming.
- `client/src/lib/shaders/definitions/*.ts` embed shader strings inline in TypeScript.
- `client/src/lib/shaders/ShaderLibrary.ts` uses `BABYLON.Effect.ShadersStore` registration pattern and global `BABYLON`, which is a separate legacy path from `ShaderContext`.
- `client/src/shaders/water.vertex.glsl` and `client/src/shaders/water.fragment.glsl` still exist in-repo.

4. Library boundaries are not clean.
- Engine/render logic and React app wiring are mixed conceptually in one package.
- Current workspace treats the renderer as app code under `client/src/lib`, not as a standalone distributable core package.

5. Mesh/material lifecycle requirements are not modeled at type-level.
- There is no canonical `WaterMeshType` enum or registry-level mapping.
- Shader switching deactivates contexts, but there is no guaranteed policy for disposal/recreation by mesh topology compatibility.

## Required Architecture Direction

### 1) Hard Separation: Core Library vs React UI

Create two explicit layers:

1. `packages/sigma-water-core` (no React)
- Babylon/WebGPU scene integration
- Water registry, mesh factory, switch engine, lifecycle manager
- WGSL loader + shader compiler adapter
- Public API for host app integration

2. `packages/sigma-water-react` (optional adapter)
- React hooks/components that call into `sigma-water-core`
- No core logic duplicated here

3. `client/` demo app
- Consumes `sigma-water-core` (and optionally `sigma-water-react`)
- Demo-only controls and UX

Rule: `sigma-water-core` must not import from `react`, `react-dom`, or any UI package.

### 2) Single Source of Truth Registry

Introduce one registry that contains both render and mesh requirements.

```ts
export type WaterTypeId =
  | 'gerstnerWaves'
  | 'oceanWaves'
  | 'oceanClassicPort'; // initial release: 3 types

export type WaterMeshTypeId =
  | 'groundDense'
  | 'projectedGrid'
  | 'radialPatch';

export interface WaterTypeDefinition {
  id: WaterTypeId;
  displayName: string;
  description: string;
  meshType: WaterMeshTypeId;
  shader: {
    vertexPath: string;   // .wgsl only
    fragmentPath: string; // .wgsl only
  };
  uniforms: UniformSchema;
  features: {
    foam: boolean;
    caustics: boolean;
    collisions: boolean;
    wake: boolean;
  };
}
```

All systems (controls, renderer, serialization, URL params, defaults) must consume this registry.

### 3) WaterMeshType Contract

Add explicit mesh metadata and topology requirements.

```ts
export interface WaterMeshTypeDefinition {
  id: WaterMeshTypeId;
  topology: 'grid' | 'projected-grid' | 'radial';
  vertexLayout: Array<'position' | 'normal' | 'uv' | 'tangent'>;
  defaults: {
    width: number;
    height: number;
    subdivisions: number;
  };
  canReuseWith: WaterMeshTypeId[];
  create(scene: Scene, opts?: Partial<MeshCreateOptions>): Mesh;
}
```

## Required Switch Lifecycle

When switching from `fromType` to `toType`:

1. Resolve `fromMeshType` and `toMeshType` from registry.
2. If mesh type changed:
- Dispose old material.
- Dispose old mesh.
- Create new mesh with target mesh type.
- Create and bind new material.

3. If mesh type unchanged:
- Dispose old material only.
- Reuse existing mesh.
- Create and bind new material.

4. Rebind shared uniforms and runtime services.
5. Update active handles in manager.

Pseudo-flow:

```ts
if (from.meshType !== to.meshType) {
  active.material?.dispose();
  active.mesh?.dispose();
  const nextMesh = meshFactory.create(to.meshType, scene);
  const nextMaterial = materialFactory.create(to.id, scene);
  nextMesh.material = nextMaterial;
  active = { mesh: nextMesh, material: nextMaterial, type: to.id };
} else {
  active.material?.dispose();
  const nextMaterial = materialFactory.create(to.id, scene);
  active.mesh.material = nextMaterial;
  active = { ...active, material: nextMaterial, type: to.id };
}
```

## WGSL-Only, Modular Shader Policy

### Mandatory Rules

1. All runtime shader code is WGSL.
2. No shader source inline in `.ts`/`.tsx` files.
3. Each water type has dedicated WGSL files.
4. Validation step fails CI if GLSL or inline shader literals are detected.

### Suggested File Layout

```text
packages/sigma-water-core/src/water-types/
  gerstnerWaves/
    vertex.wgsl
    fragment.wgsl
    uniforms.ts
    mesh.ts
    index.ts
  oceanWaves/
    vertex.wgsl
    fragment.wgsl
    uniforms.ts
    mesh.ts
    index.ts
  oceanClassicPort/
    vertex.wgsl
    fragment.wgsl
    uniforms.ts
    mesh.ts
    index.ts
```

### Shader Loading Strategy

Use static raw-file imports for bundlers that support it (Vite/Rollup):
- `import vertexWGSL from './vertex.wgsl?raw'`
- `import fragmentWGSL from './fragment.wgsl?raw'`

Alternative: build-time codegen that emits TypeScript constants from `.wgsl` files while preserving no-inline authoring.

## Ocean Classic Port (GLSL -> WGSL) Requirement

One release-1 water type must be a strict WGSL port of the provided ocean shader model:
- Geometry displacement: 3 octaves
- Fragment normal/detail: 5 octaves
- Fresnel/reflection/refraction blending
- Same high-subdivision mesh requirement

Recommended WaterType id: `oceanClassicPort`

Porting standards:
1. Preserve mathematical behavior first; optimize second.
2. Keep constants grouped in a WGSL constants section.
3. Build parity tests against known camera/time snapshots.
4. Keep code modular (`noise`, `seaOctave`, `height`, `normal`, `lighting`).

## API Design for Scale (3 -> 20 WaterTypes)

Provide stable public API:

```ts
export interface SigmaWaterEngine {
  initialize(canvasOrScene: HTMLCanvasElement | Scene): Promise<void>;
  getWaterTypes(): readonly WaterTypeDefinition[];
  getActiveWaterType(): WaterTypeId;
  switchWaterType(id: WaterTypeId, opts?: SwitchOptions): Promise<void>;
  setUniform(name: string, value: number | Vector2 | Vector3 | Vector4): void;
  setUniforms(values: Record<string, unknown>): void;
  update(dt: number): void;
  dispose(): void;
}
```

Do not expose React types in this API surface.

## Memory Management Requirements

1. Maintain ownership graph in one manager (`mesh`, `material`, GPU buffers, textures).
2. Dispose old resources on switch according to mesh-type compatibility.
3. Track resource generations to avoid stale references.
4. Add debug counters:
- materials created/disposed
- meshes created/disposed
- active GPU resources

5. Add leak tests that switch water type repeatedly (e.g., 1000 cycles).

## Immediate Repo Actions (Priority Ordered)

1. Remove app/library ambiguity.
- Create `packages/sigma-water-core` and move renderer/shader/registry/mesh logic there.
- Keep React controls in `client/` (or `packages/sigma-water-react`).

2. Replace dual shader systems with one.
- Consolidate `ShaderLibrary`, `ShaderRegistry`, and `ShaderManager` into a single core pipeline.
- Delete legacy/global `BABYLON.Effect.ShadersStore` path.

3. Implement missing mesh factory and typed mesh registry.
- Add WaterMeshType definitions and creation/reuse policy.

4. Normalize WaterType definitions.
- Replace `WaterTypeSystem.ts` + scattered arrays with one registry-driven source.

5. Enforce shader policy in CI.
- Fail on `.glsl` in active source paths.
- Fail on inline shader source literals.
- Fail if any water type lacks mesh type metadata.

6. Deliver release-1 set of exactly three production water types.
- `gerstnerWaves`
- `oceanWaves`
- `oceanClassicPort` (WGSL port of provided ocean shader)

## Acceptance Criteria

1. Core package builds and runs without React installed.
2. Water type switch works across all release-1 types.
3. Mesh recreation/disposal behavior follows mesh-type change rules exactly.
4. Shader sources are only `.wgsl` files (no GLSL, no inline shader strings).
5. 100+ sequential switches show stable memory/resource counters.
6. Registry additions for new water types are additive and do not require switch-engine edits.

## Risks and Mitigations

1. Risk: WGSL port behavior mismatch.
- Mitigation: snapshot-based visual regression tests with fixed seed/time/camera.

2. Risk: Runtime stutter during switch.
- Mitigation: precompile materials for release-1 types during init and cache pipelines.

3. Risk: API churn while splitting packages.
- Mitigation: freeze public core API and version it before moving demo UI.

## Recommended Migration Phases

1. Phase 1: Extract core package + compile cleanly without React imports.
2. Phase 2: Introduce unified registry with WaterType<->WaterMeshType mapping.
3. Phase 3: Convert all active shaders to external `.wgsl` files; remove GLSL/inline usage.
4. Phase 4: Implement and validate switch lifecycle disposal rules.
5. Phase 5: Add `oceanClassicPort` WGSL type and complete release-1 trio.
6. Phase 6: Add leak/stress tests and CI policy enforcement for scale to 20 types.

## Bottom Line

The repo is close to a workable foundation, but it needs a hard separation between app UI and library core, a single typed registry, strict WGSL modular shader files, and deterministic mesh/material lifecycle switching. Implementing these changes now will make the first 3 water types production-ready and keep the architecture scalable to 20+ types without memory or maintenance collapse.
