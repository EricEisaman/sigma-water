# Sigma Water Bot Guide

This guide is for bots making safe, production-ready changes.

Primary host target: Render.
Primary deployment model: Static Site.

## 1) Source Of Truth

- Frontend build system: Vite.
- Build output directory: dist/public.
- Active renderer runtime: client/src/lib/VisualOcean.ts.
- Active page entry that creates renderer: client/src/pages/Home.tsx.
- Controls UI: client/src/components/WaterControls.tsx.
- WebGPU + WGSL is the active rendering path.
- Babylon import convention: named imports from @babylonjs/core only. Keep @babylonjs/loaders as side-effect import for GLB loading.
- Active GLB assets:
   - client/public/assets/models/diving-boat.glb
   - client/public/assets/models/island.glb

## 2) Removed Legacy Paths (Do Not Reintroduce)

The following were intentionally removed and should not be referenced by new fixes:

- client/src/lib/WaterScene.ts
- client/src/lib/OceanShaders.ts
- client/public/shaders/*
- public/shaders/*

## 3) Render Deployment Settings

Use these exact Static Site settings:

- Build command: pnpm install && pnpm build
- Publish directory: dist/public
- SPA rewrite:
   - Source: /*
   - Destination: /index.html
   - Action: Rewrite 200

Only use Render Web Service when explicitly requested.

## 4) Operational Priorities

1. Availability: app responds and boots.
2. Asset integrity: no 404 for chunks or GLBs.
3. Visual correctness: sky, ocean, boat, island visible.
4. Interaction correctness: controls update runtime behavior.
5. Performance tuning.

## 5) Current Renderer Architecture Notes

- Ocean uses custom WGSL ShaderMaterial in VisualOcean.
- There is a fallback StandardMaterial path for ocean when shader setup or render-time shader execution fails.
- Boat and island load from GLB and are parented under explicit container TransformNodes.
- Collision debug proxies exist as sibling spheres:
   - boatCollisionSphere
   - islandCollisionSphere
- Collision source mode can switch between GLB geometry and sibling spheres.
- Sphere-water foam ring cross-section radius is now computed CPU-side and passed as uniforms each frame.

## 6) Controls Contract

WaterControls persists state to localStorage and URL query params.

If adding controls:

1. Add key to ControlValues.
2. Add default in DEFAULT_VALUES.
3. Add short param key in PARAM_KEYS.
4. Add state variable and handler.
5. Apply in initial mount effect.
6. Include in persistence effect.
7. Wire in reset handler.
8. Handle in VisualOcean updateParameter key map.
9. Push into shader uniforms if needed at init and per-frame updates.

## 7) Render Incident Playbook

If UI shows but scene is blank:

1. Check browser console for initialization exceptions.
2. Confirm WebGPU support at runtime.
3. Confirm ocean mesh exists and is enabled.
4. Confirm ocean material assignment logs.
5. Confirm render loop is running.
6. If custom shader fails, verify fallback material path activates.
7. Confirm camera is above near plane and pointed toward scene center.

If foam behavior seems wrong:

1. Verify collision mode in controls.
2. Verify proxy sphere visibility state and actual Y values.
3. Verify boat physics bypass in sphere mode is active.
4. Verify sphere center and cross-radius uniforms update per frame.

## 8) Safe Edit Zones

Common safe files for hotfixes:

- client/src/lib/VisualOcean.ts
- client/src/components/WaterControls.tsx
- client/src/pages/Home.tsx
- client/index.html
- vite.config.ts

Use caution with broad refactors that affect startup flow, shader construction, or camera input stack.

## 9) Release Checklist

Before finishing production work:

1. Run pnpm check.
2. Run pnpm build when deployment behavior changed.
3. Confirm dist/public/index.html exists.
4. Confirm Render settings still match this guide.
5. Smoke test:
    - app loads
    - sky and ocean visible
    - boat and island visible
    - controls update values live
    - no GLB 404s

## 10) Known Deferred Investigation

- GLB visual rendering can still appear offset relative to sibling proxy spheres in some scenarios despite small logged center offsets.
- Defer deep transform-chain investigation unless explicitly prioritized over current feature/incident work.

---

Last updated: 2026-03-29
Intent: reliability and fast incident recovery.
