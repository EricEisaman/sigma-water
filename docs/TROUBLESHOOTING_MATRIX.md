# Troubleshooting Matrix

| Symptom | Primary Checks | Likely Root Cause | First Action |
|---|---|---|---|
| Overlay visible, scene blank | `pnpm verify:runtime-log`; check for `GPUValidationError` | WGSL parse/validation failure | Validate shader source resolution pipeline |
| Blank scene after hot reload | Check for multi-device texture warnings | Duplicate engine instances from remount/HMR | Confirm singleton + cleanup behavior |
| Scene appears once then disappears | Check render health logs and material binding | Material not attached after shader switch | Re-run current shader switch and verify material attach |
| Controls change values but visuals do not react | Check active shader supports control key | Unsupported uniforms being sent | Filter parameters by shader contract |
| Camera controls move but nothing visible | Check camera position/target and top-down view | Camera framing issue | Reset camera via orbit defaults / top-down |
| Frequent console warning floods | Check if historical log data is being read | Stale log interpretation | Use timestamp-window verifier |
| Tests pass but runtime still unstable | Compare runtime logs vs unit tests | Missing browser-level scenario coverage | Run manual switch and camera smoke sequence |

## Standard Command Set
- Full verification: `pnpm verify:all`
- Runtime log only: `pnpm verify:runtime-log`
- Tests only: `pnpm test`
- Typecheck only: `pnpm check`

## Manual Smoke Sequence
1. Load app and wait for first render marker.
2. Switch shaders through all available types.
3. Adjust wave and effect controls.
4. Use top-down view and return to orbit.
5. Confirm no fresh runtime failure signatures.
