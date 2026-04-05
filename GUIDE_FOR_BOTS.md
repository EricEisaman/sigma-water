# Sigma Water Bot Guide

This guide is for bots making safe, production-ready changes.

Primary host target: Render.
Primary deployment model: Static Site.

## Mission And Spirit

This project exists to build excellent, dependable real-time water rendering that serves people well.

The work should reflect a spirit of stewardship, humility, honesty, and care for quality. In practical terms:

- Build with integrity: no hidden shortcuts, no silent regressions.
- Protect users: prioritize reliability, safety, and clear behavior.
- Honor the craft: keep code understandable, testable, and maintainable.
- Serve the mission: performance and visual quality should support real usefulness, not vanity.

When making tradeoffs, choose what best preserves trust, clarity, and long-term stability.

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
   - client/public/assets/models/zodiac-boat.glb
   - client/public/assets/models/island.glb
   - client/public/assets/models/lighthouse-island.glb

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

## 4.1) Event-Driven Runtime Rule (Required)

- Do not introduce timeout- or interval-based control flow in runtime logic.
- Prefer engine/UI events and observables (for example, scene render observables, input/composition events, and explicit lifecycle callbacks).
- If a recovery path currently uses delayed polling, replace it with event-driven checks on real render/input/state transitions.
- Keep behavior deterministic: state transitions should happen because an event fired, not because an arbitrary delay elapsed.
- For IME composition and dialog key handling, use one-shot event flags consumed on the next key event instead of delay windows.

## 5) Current Renderer Architecture Notes

- Ocean uses custom WGSL ShaderMaterial in VisualOcean.
- There is a fallback StandardMaterial path for ocean when shader setup or render-time shader execution fails.
- Boat and island load from GLB and are parented under explicit container TransformNodes.
- Parent physics proxies are collision and animation sources:
   - boatCollisionSphere (parent proxy)
   - islandCollisionSphere (parent proxy)
- GLB meshes are children of parent proxies and transform with them.
- Collision source mode can switch between GLB geometry and parent physics proxies.
- Collision cross-section radius is computed CPU-side based on active mode and passed as uniforms each frame.
- Mesh-water intersection foam is driven by runtime intersection factors (boat/island) and can be disabled independently in controls.
- Crest foam controls are shared across active water shaders and must stay parameter-compatible.
- Underwater transition is camera-height driven with smooth uniform blending plus scene clear-color interpolation.
- Island/boat model switching is coalesced: latest requested model should win after async load completes.
- Toon water supports configurable band colors via uniforms:
   - toonShadowColorR/G/B
   - toonMidColorR/G/B
   - toonLightColorR/G/B

## 6) Controls Contract

WaterControls persists state to localStorage and URL query params.

Startup conflict behavior:

- If URL params differ from saved localStorage values on load, show a user confirmation modal.
- User must choose source explicitly:
   - Keep saved settings (saved values stay authoritative and URL is rewritten to match)
   - Use link settings (URL values become active and are persisted to localStorage)
- Do not silently override saved settings when a conflicting link is opened.

Runtime authority:

- localStorage-backed control state is the primary source of truth.
- URL params are a derived mirror and must be rewritten when authoritative state changes.
- Cross-tab storage events must update runtime state and URL mirror in an event-driven way.

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

Notes for persistence compatibility:

- `waterType` in localStorage may be stored as an object (`{ type: ... }`); parse object shape first before string fallback.

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

1. Verify collision mode in controls (GLB Geometry vs Parent Physics Proxies).
2. Verify parent physics proxy visibility state and actual Y values.
3. Verify parent physics proxy center derivation matches active collision mode.
4. Verify collision center and cross-radius uniforms update per frame.
5. Verify intersection foam toggle is enabled and intersection factors are non-zero near the waterline.
6. Verify crest foam enable and threshold are set to visible values for the active shader.

If underwater transition seems wrong:

1. Verify underwater toggle is enabled in controls.
2. Verify transition depth and fog density are non-zero.
3. Verify camera crosses the waterline and underwaterFactor changes smoothly.

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

6. PWA checks:
   - manifest.webmanifest loads with no errors
   - manifest includes valid icons (192, 512, maskable) and screenshots
   - service worker registers in production build and activates
   - offline navigation serves app shell

## 10) Known Deferred Investigation

- GLB visual rendering can still appear offset relative to parent physics proxies in some scenarios despite small logged center offsets.
- Defer deep transform-chain investigation unless explicitly prioritized over current feature/incident work.

---

Last updated: 2026-03-29
Intent: reliability and fast incident recovery.
