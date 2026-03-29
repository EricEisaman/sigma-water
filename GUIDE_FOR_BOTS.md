# Sigma Water - Production Deployment Operations Guide (for Bots)

This guide is optimized for production deployment and operations, not feature prototyping.

Primary target platform: Render.
Primary deployment model: Static Site.

## 1) Operational Source of Truth

- Frontend build system: Vite.
- Frontend output directory: `dist/public`.
- Active runtime renderer path: `client/src/lib/VisualOcean.ts` used by `client/src/pages/Home.tsx`.
- WebGPU/WGSL requirement: keep active shader flow WGSL-only.
- Babylon.js import style: **named imports only** from `@babylonjs/core` — no `import * as BABYLON` namespace. `@babylonjs/loaders` is imported as a side-effect for GLB support.
- 3D assets: GLB models served from `client/public/assets/models/` (diving-boat.glb, island.glb). Loaded at runtime via `SceneLoader.ImportMeshAsync`.

Cleanup status (important):
- Removed legacy modules: `client/src/lib/WaterScene.ts`, `client/src/lib/OceanShaders.ts`.
- Removed duplicate/orphaned shader assets under `client/public/shaders` and `public/shaders`.
- Removed placeholder box/cylinder meshes for boat and island — replaced with GLB models.
- Current production path does not depend on those deleted files.

Operational priority order:
1. Availability (site responds).
2. Correct static asset serving (no 404 chunk failures).
3. Visual correctness (sky/water/boat appear).
4. Performance and quality tuning.

## 2) Render Deployment Profiles

### Preferred: Render Static Site

Use these exact settings:

- Build command: `pnpm install && pnpm build`
- Publish directory: `dist/public`
- Rewrite rule (SPA):
  - Source: `/*`
  - Destination: `/index.html`
  - Action: Rewrite (HTTP 200)

When to use:
- No backend runtime logic required at request time.
- Lowest operational complexity and cost.

### Alternative: Render Web Service

Use only when server behavior is required:

- Build command: `pnpm install && pnpm build`
- Start command: `node dist/index.js`

The server path is in `server/index.ts` and serves static files from `dist/public` with SPA fallback.

## 3) Release Workflow (Production)

For every deploy-triggering change:

1. Validate locally:
   - `pnpm install`
   - `pnpm build`
2. Confirm output exists:
   - `dist/public/index.html`
3. Confirm no wrong publish-dir assumptions in docs/settings.
4. Push changes.
5. Verify Render deploy completes.
6. Smoke test production URL.

Minimum smoke test checklist:

- `/` returns HTTP 200.
- Hard refresh loads JS/CSS chunks without 404.
- Scene initializes (not only UI overlay).
- Skybox visible.
- Ocean mesh visible and animated.
- Boat (diving-boat.glb) visible and floating on waves.
- Island (island.glb) visible at scene center.
- No GLB 404s in network tab (`/assets/models/diving-boat.glb`, `/assets/models/island.glb`).

## 4) Incident Playbooks

### Incident A: Site returns 404 / Not Found

Likely causes:
- Wrong publish directory.
- Missing SPA rewrite.

Actions:
1. Set publish directory to `dist/public`.
2. Ensure `/* -> /index.html` rewrite is configured.
3. Redeploy and retest `/` and one non-root path.

### Incident B: UI loads but 3D scene missing

Symptoms:
- Gradient/UI visible, but no sky/water/boat.

Actions:
1. Check browser console for WebGPU/shader errors.
2. Confirm `navigator.gpu` exists.
3. Confirm render loop starts in `VisualOcean`.
4. Confirm EXR load path and skybox creation succeed.
5. Confirm ocean material exists and is assigned to ocean mesh.
6. Confirm camera framing is sane.

### Incident C: Build succeeds but runtime asset 404s

Likely causes:
- Output path mismatch.
- Stale cache + hashed chunk mismatch.

Actions:
1. Verify build writes to `dist/public`.
2. Redeploy full build artifact.
3. Perform hard refresh in browser.

## 5) Ops Constraints for Bots

- Do not switch deploy model unless explicitly requested.
- Do not change Vite output dir away from `dist/public` without explicit approval.
- Do not revert to legacy shader registration paths when production fixes are needed.
- Prefer minimal, high-confidence fixes over broad refactors during incidents.

## 6) Controlled Change Areas

Safe/common production touchpoints:

- `client/index.html` (title/favicon/shell tags)
- `client/src/lib/VisualOcean.ts` (scene init/rendering)
- `client/src/pages/Home.tsx` (init lifecycle)
- `vite.config.ts` (build output and root)
- `.gitignore` (artifact hygiene)

Use caution / legacy drift risk:

- stale documentation that still references removed shader/module paths
- re-introducing parallel renderer stacks outside `VisualOcean.ts`
- re-adding deleted shader directories without a clear runtime need

## 6.1 Removed Paths (Do Not Reference)

These paths were intentionally removed during cleanup:

- `client/src/lib/WaterScene.ts`
- `client/src/lib/OceanShaders.ts`
- `client/public/shaders/*`
- `public/shaders/*`

If a future change needs shader files again, document the runtime owner and load path first, then add only the minimum required files.

## 7) Logging and Validation Notes

- Keep actionable logs in initialization and critical rendering path.
- Do not remove error logs that help production triage unless replaced with better structured logs.
- Build warnings about analytics placeholders in `client/index.html` are currently non-blocking unless deployment policy says otherwise.

## 8) Rollback Guidance

If production regression is detected post-deploy:

1. Roll back to last known-good Render deploy.
2. Capture failing commit hash and symptom.
3. Reproduce locally with `pnpm build`.
4. Apply minimal fix.
5. Redeploy and run smoke test checklist.

## 9) Branding and Product Identity

- Keep wave branding consistent (`🌊 Sigma Water`) unless explicitly directed otherwise.
- Favicon/title are part of production UX and should be preserved across release fixes.

## 10) Bot Execution Checklist (Prod-Focused)

Before finishing a production-related task:

1. Confirm deployment assumptions (Static Site vs Web Service).
2. Confirm build output target remains `dist/public`.
3. Run `pnpm build` successfully.
4. Confirm guide/docs/settings remain consistent with deployment model.
5. Report exactly what operators must set in Render.

---

Last updated: 2026-03-29
Intent: production operations reliability first.
