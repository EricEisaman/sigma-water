# Blank Scene Runbook

## Goal
Restore visible rendering when the app loads but the scene appears blank, frozen, or only overlays are visible.

## Fast Triage (2-3 minutes)
1. Run full verification:
   - `pnpm verify:all`
2. Check runtime log freshness and failure signatures:
   - `pnpm verify:runtime-log`
3. Check latest browser log markers:
   - Expected success markers:
     - `✅ First render frame completed`
     - `✅ Render health check passed (...)`
     - `✅ Switched to ... at ...`

If verification fails, continue with Root Cause Isolation.

## Root Cause Isolation

### 1) Shader Source / WebGPU Failures
Symptoms:
- `GPUValidationError`
- `invalid character found`
- `CreateShaderModule`

Checks:
- Confirm runtime verifier window has fresh failures.
- Confirm shader source normalization paths remain active in core shader registry/context.

Likely Fixes:
- Ensure shader sources resolve to WGSL strings only.
- Reject unresolved module objects (fail fast) rather than coercing payloads.

### 2) Lifecycle / Multi-Engine Contention
Symptoms:
- Intermittent blank output after HMR or remount.
- Device/texture association warnings across different devices.

Checks:
- Confirm page cleanup disposes old renderer instance.
- Confirm singleton guard prevents concurrent ocean engines.

Likely Fixes:
- Keep strict mount/unmount disposal in page lifecycle.
- Keep singleton ocean ownership on window for HMR cycles.

### 3) Material Not Bound to Mesh
Symptoms:
- No shader errors, but scene still blank.

Checks:
- Verify active shader exists.
- Verify ocean mesh has assigned material after switch.
- Confirm render health check did not trigger recovery warnings.

Likely Fixes:
- Re-run switch for current shader.
- Keep render health check auto-recovery enabled.

### 4) Camera Framing / Visibility
Symptoms:
- Scene renders but object not visible from current camera.

Checks:
- Confirm camera target and position updates execute.
- Use top-down command to force framing.

Likely Fixes:
- Recompute orbit camera position via shared utility.
- Reset controls to defaults.

## Recovery Sequence
1. Hard refresh app.
2. Run `pnpm verify:runtime-log`.
3. Switch shaders from control panel once (gerstner -> ocean -> gerstner).
4. Use top-down view.
5. If still blank, inspect `.manus-logs/browserConsole.log` with timestamp focus.

## Evidence to Capture Before Escalation
- Output of `pnpm verify:all`.
- Last 150 lines of `.manus-logs/browserConsole.log`.
- Current git status (`git status --short`).
- Whether issue reproduces after hard refresh and after one shader switch cycle.
