# Uniform/Code Sweep Report
Date: 2026-03-31

## Uniform Path Audit
- gerstnerWaves: definition uniforms 42, WGSL uniforms 41, missing-in-WGSL 0
- glassyWaves: definition uniforms 47, WGSL uniforms 46, missing-in-WGSL 0
- oceanWaves: definition uniforms 34, WGSL uniforms 33, missing-in-WGSL 0
- stormyWaves: definition uniforms 47, WGSL uniforms 46, missing-in-WGSL 0
- toonWater: definition uniforms 32, WGSL uniforms 31, missing-in-WGSL 0
- tropicalWaves: definition uniforms 47, WGSL uniforms 46, missing-in-WGSL 0

### Runtime Setters Coverage
- Runtime setUniform keys: 17
- Keys: boatCollisionCenter, boatCollisionRadius, boatIntersectionFactor, cameraPosition, collisionFoamStrength, islandCollisionCenter, islandCollisionRadius, islandIntersectionFactor, time, underwaterColorB, underwaterColorG, underwaterColorR, underwaterEnabled, underwaterFactor, underwaterFogDensity, underwaterHorizonMix, underwaterTransitionDepth

### UI Controls Coverage
- ShaderControlKey count: 32
- Missing UI controls for ShaderControlKey: 0

## Dead Code / Duplication Sweep (Summary)
- Candidate: packages/sigma-water-core/src/lib/OceanSimulation.ts (quick-reference hits in core entry/runtime: 0)
- Candidate: packages/sigma-water-core/src/lib/OceanSimulationLOD.ts (quick-reference hits in core entry/runtime: 0)
- Candidate: packages/sigma-water-core/src/lib/CameraController.ts (quick-reference hits in core entry/runtime: 0)
- Candidate: packages/sigma-water-core/src/lib/PerformanceHUD.ts (quick-reference hits in core entry/runtime: 0)
- Candidate: packages/sigma-water-core/src/lib/FoamParticles.ts (quick-reference hits in core entry/runtime: 0)
- Candidate: packages/sigma-water-core/src/lib/Boat.ts (quick-reference hits in core entry/runtime: 4)
- Candidate: packages/sigma-water-core/src/lib/BoatFleet.ts (quick-reference hits in core entry/runtime: 0)
- Candidate: packages/sigma-water-core/src/lib/GodRays.ts (quick-reference hits in core entry/runtime: 0)
- Candidate: packages/sigma-water-core/src/lib/SkyDome.ts (quick-reference hits in core entry/runtime: 0)
- Candidate: packages/sigma-water-core/src/lib/ScreenSpaceReflection.ts (quick-reference hits in core entry/runtime: 0)
- Candidate: packages/sigma-water-core/src/lib/InstancedRenderer.ts (quick-reference hits in core entry/runtime: 0)
- Candidate: packages/sigma-water-core/src/lib/MeshLOD.ts (quick-reference hits in core entry/runtime: 0)
- Candidate: packages/sigma-water-core/src/lib/OceanLOD.ts (quick-reference hits in core entry/runtime: 0)

## Docs Staleness Sweep (Summary)
- PROJECT_SUMMARY.md: stale architecture paths and feature matrix; needs refresh to packages/sigma-water-core source of truth.
- DESIGN.md: references FFT/JONSWAP as implementation; current runtime is procedural Gerstner/Seascape-style.
- README.md: controls table outdated relative to current WaterControls and ShaderControlKey set.

## Fixes Applied In This Sweep
- Added missing UI control path for specularIntensity in WaterControls.
- Scoped collisionFoamStrength runtime uniform write to gerstnerWaves where implemented.

## Metrics
- Definition uniforms checked: 249
- Definition uniforms missing in WGSL (excluding Scene UBO cameraPosition): 0
- Shader control keys missing UI controls: 0