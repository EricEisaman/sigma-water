# Babylon.js 9 WebGPU WGSL Shader Guide

## Quick Start: Correct WGSL Setup

**Critical Rules:**
1. Custom WGSL must be **completely standalone**—no Babylon template boilerplate, no references to injected structs
2. **NO `@group/@binding` on uniforms**—Babylon auto-injects them; duplicates cause compilation errors
3. **NO template lines**—Delete `vertexInputs = input`, `fragmentInputs = input`, `vertexOutputs.*`, `fragmentOutputs`

```typescript
// 1. Define WGSL shaders as inline strings (NO template code)
const vertexCode = `
struct OceanVertexInput {
  @location(0) position : vec3f,
  @location(1) normal : vec3f,
  @location(2) uv : vec2f,
};

struct OceanVertexOutput {
  @builtin(position) position : vec4f,
  @location(0) vColor : vec4f,
  @location(1) vNormal : vec3f,
  @location(2) vWorldPos : vec3f,
  @location(3) vUv : vec2f,
};

// NO @group/@binding - Babylon adds them automatically!
var<uniform> scene : Scene;
var<uniform> mesh : Mesh;
var<uniform> waveParams : WaveParams;

@vertex
fn main(input: OceanVertexInput) -> OceanVertexOutput {
  var output: OceanVertexOutput;
  // ... shader code ...
  return output;
}
`;

// 2. Create ShaderMaterial with vertexSource/fragmentSource
const material = new BABYLON.ShaderMaterial(
  'oceanShader',
  scene,
  {
    vertexSource: vertexCode,
    fragmentSource: fragmentCode,
  },
  {
    attributes: ['position', 'normal', 'uv'],
    uniformBuffers: ['Scene', 'Mesh', 'waveParams'],  // CRITICAL: Include ALL custom uniforms!
    needAlphaBlending: true,
  }
);

// 3. Create and bind uniform buffer for custom parameters
const waveParamsBuffer = new BABYLON.UniformBuffer(engine);
waveParamsBuffer.addUniform('time', 1);
waveParamsBuffer.addUniform('amplitude', 1);
waveParamsBuffer.addUniform('frequency', 1);
waveParamsBuffer.update();
material.setUniformBuffer('waveParams', waveParamsBuffer);

// 4. CRITICAL: Assign material to mesh
material.transparencyMode = BABYLON.Material.MATERIAL_ALPHABLEND;
material.backFaceCulling = false;

const oceanMesh = BABYLON.MeshBuilder.CreateGround('ocean', { width: 1000, height: 1000, subdivisions: 256 }, scene);
oceanMesh.material = material;  // MUST assign!
oceanMesh.renderingGroupId = 2;  // Transparent queue
oceanMesh.visibility = 1.0;
oceanMesh.setEnabled(true);

// 5. Animate in render loop
scene.registerBeforeRender(() => {
  waveParamsBuffer.updateFloat('time', time);
  waveParamsBuffer.update();
});
```

---

## CRITICAL: Remove Babylon Template Boilerplate

**Problem:** Babylon.js injects template boilerplate (like `var<private> vertexInputs : VertexInputs;`) into your custom WGSL. If your `main()` function still contains leftover template code, you get type mismatches and unreachable code errors.

**Solution:** Your custom WGSL must be **completely standalone**. Delete ALL template lines:

```wgsl
// ❌ DELETE THESE LINES:
vertexInputs = input;              // Type mismatch: OceanVertexInput ≠ VertexInputs
fragmentInputs = input;            // Type mismatch
vertexOutputs.position.y = ...;    // Unreachable Babylon template
return vertexOutputs;              // Wrong return type
return fragmentOutputs;            // Wrong return type

// ✅ ONLY KEEP YOUR CUSTOM CODE:
@vertex
fn main(input: OceanVertexInput) -> OceanVertexOutput {
  var output: OceanVertexOutput;
  // ... your wave displacement code ...
  return output;  // ONLY this return
}
```

**Why This Happens:** Babylon's shader templates contain boilerplate for legacy compatibility. When you pass custom WGSL, Babylon still injects the template structs but you should NOT reference them. Your code should only use your custom structs and Babylon's provided uniforms (scene, mesh).

---

## CRITICAL: Babylon.js Auto-Injects @group/@binding

**Problem:** Babylon.js v9.0.0 automatically injects `@group/@binding` attributes for ALL uniforms. If you also declare them in your WGSL code, you get **duplicate attribute errors**.

**Symptom in Error Log:**
```
duplicate @group(0) @binding(0) @group(0) @binding(0)  // Babylon's + your code = duplicate!
```

**Solution:** Remove ALL `@group/@binding` from your uniform declarations:

```wgsl
// ❌ WRONG (causes duplicate attributes):
@group(0) @binding(0) var<uniform> scene : Scene;
@group(1) @binding(1) var<uniform> mesh : Mesh;
@group(1) @binding(2) var<uniform> waveParams : WaveParams;

// ✅ CORRECT (Babylon injects bindings automatically):
var<uniform> scene : Scene;
var<uniform> mesh : Mesh;
var<uniform> waveParams : WaveParams;
```

**How Babylon Handles Bindings:**
Babylon automatically assigns:
- Scene uniform → Group 0, Binding 0
- Mesh uniform → Group 1, Binding 0 (or 1)
- Custom uniforms → Group 1+, Binding 2+ (as needed)

You don't need to specify them; Babylon manages the layout internally.

---

## Struct Naming: Avoid Babylon's Reserved Names

**Problem:** Babylon.js v9.0.0 injects its own `VertexInputs` and `FragmentInputs` structs, causing redeclaration conflicts.

**Solution:** Use domain-specific struct names:

```wgsl
// ❌ WRONG (conflicts with Babylon's injected structs):
struct VertexInputs { ... }
struct FragmentInputs { ... }

// ✅ CORRECT (unique domain-specific names):
struct OceanVertexInput { ... }
struct OceanVertexOutput { ... }
struct OceanFragmentInput { ... }
```

**Naming Convention:**
- For ocean: `OceanVertexInput`, `OceanVertexOutput`, `OceanFragmentInput`
- For water: `WaterVertexInput`, `WaterVertexOutput`, `WaterFragmentInput`
- For sky: `SkyVertexInput`, `SkyVertexOutput`, `SkyFragmentInput`

---

## Complete WGSL Shader Template

### Vertex Shader

```wgsl
struct Scene {
  viewProjection : mat4x4f,
  view : mat4x4f,
  projection : mat4x4f,
  vEyePosition : vec4f,
};

struct Mesh {
  world : mat4x4f,
  visibility : f32,
};

struct WaveParams {
  time : f32,
  amplitude : f32,
  frequency : f32,
  windDir : f32,
  windSpeed : f32,
  foamIntensity : f32,
  causticIntensity : f32,
  causticScale : f32,
};

struct OceanVertexInput {
  @location(0) position : vec3f,
  @location(1) normal : vec3f,
  @location(2) uv : vec2f,
};

struct OceanVertexOutput {
  @builtin(position) position : vec4f,
  @location(0) vColor : vec4f,
  @location(1) vNormal : vec3f,
  @location(2) vWorldPos : vec3f,
  @location(3) vUv : vec2f,
};

// NO @group/@binding - Babylon adds them automatically!
var<uniform> scene : Scene;
var<uniform> mesh : Mesh;
var<uniform> waveParams : WaveParams;

@vertex
fn main(input: OceanVertexInput) -> OceanVertexOutput {
  var output: OceanVertexOutput;
  
  let time = waveParams.time;
  let waveAmp = waveParams.amplitude;
  let waveFreq = waveParams.frequency;
  let wave1 = waveAmp * sin(input.position.x * waveFreq + time) * cos(input.position.z * waveFreq + time * 0.7);
  let wave2 = waveAmp * 0.6 * sin(input.position.x * waveFreq * 1.3 + time * 1.3) * cos(input.position.z * waveFreq * 1.3 + time * 0.9);
  let wave3 = waveAmp * 0.4 * sin(input.position.x * waveFreq * 2.0 + time * 0.8) * cos(input.position.z * waveFreq * 2.0 + time * 1.1);
  let totalWave = wave1 + wave2 + wave3;
  
  var displaced = input.position;
  displaced.y += totalWave;
  let worldPos = mesh.world * vec4f(displaced, 1.0);
  output.position = scene.viewProjection * worldPos;
  
  let depthFactor = clamp(displaced.y * 0.1 + 0.5, 0.0, 1.0);
  output.vColor = vec4f(0.0, 0.3 + depthFactor * 0.2, 0.6 + depthFactor * 0.2, 0.95);
  output.vNormal = input.normal;
  output.vWorldPos = worldPos.xyz;
  output.vUv = input.uv;
  
  return output;
}
```

### Fragment Shader

```wgsl
struct OceanFragmentInput {
  @location(0) vColor : vec4f,
  @location(1) vNormal : vec3f,
  @location(2) vWorldPos : vec3f,
  @location(3) vUv : vec2f,
};

@fragment
fn main(input: OceanFragmentInput) -> @location(0) vec4f {
  var finalColor = input.vColor.rgb;
  
  let viewDir = normalize(vec3f(0.0, 1.0, 0.5));
  let n = normalize(input.vNormal);
  let fresnel = pow(1.0 - abs(dot(n, viewDir)), 3.0);
  
  let sunDir = normalize(vec3f(1.0, 1.0, 0.5));
  let reflection = reflect(-viewDir, n);
  let specular = pow(max(dot(reflection, sunDir), 0.0), 32.0);
  
  let causticPattern = sin(input.vWorldPos.x * 3.0) * 0.5 + 0.5;
  let causticColor = vec3f(0.8, 0.9, 1.0) * causticPattern * 0.5;
  
  let foam = smoothstep(0.2, 0.8, input.vWorldPos.y) * 0.3;
  let foamColor = vec3f(1.0, 1.0, 1.0) * foam;
  
  finalColor = mix(finalColor, vec3f(0.5, 0.7, 1.0), fresnel * 0.3);
  finalColor += causticColor + foamColor + vec3f(1.0, 0.95, 0.8) * specular * 0.8;
  
  return vec4f(finalColor, input.vColor.a);
}
```

---

## Common Pitfalls & Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| `redeclaration of 'VertexInputs'` | Using generic struct names that Babylon.js injects | Rename to domain-specific: `OceanVertexInput`, `OceanFragmentInput` |
| `duplicate attribute` on uniform | Babylon injects `@group/@binding` automatically | Remove ALL `@group/@binding` from your uniform declarations |
| `syntax error, unexpected LEFT_ANGLE` | HTML in shader source (file path served as HTML) | Use inline WGSL strings, not file paths |
| `<!doctype html>` in error | SPA router returning HTML for shader file path | Use `vertexSource`/`fragmentSource` parameters, not file paths |
| Mesh not rendering | Material not assigned to mesh | Call `mesh.material = material` AFTER creating material |
| Mesh invisible (white) | Missing custom uniforms in `uniformBuffers` | Add ALL custom uniform names: `uniformBuffers: ['Scene', 'Mesh', 'waveParams']` |
| Flat ocean (no waves) | `waveParams.time` not updating | Update uniform buffer in render loop: `waveParamsBuffer.updateFloat('time', time)` |
| Black mesh | Camera not set as active | Call `scene.activeCamera = camera` |
| `gl_Position` error | GLSL syntax in WGSL | Use `@builtin(position)` instead |
| `attribute` keyword error | GLSL syntax in WGSL | Use `@location(N)` in struct |
| `varying` keyword error | GLSL syntax in WGSL | Use struct with `@location(N)` fields |
| Type mismatch on `vertexInputs = input` | Leftover Babylon template code | Delete this line; use `input` directly in your code |
| Unreachable code after `return output` | Babylon template boilerplate still in shader | Remove all template lines; only keep your custom code |
| `vertexOutputs` or `fragmentOutputs` undefined | Babylon template reference in custom WGSL | Delete these; use your custom output struct instead |

---

## ShaderMaterial Constructor Reference

```typescript
new BABYLON.ShaderMaterial(
  'materialName',
  scene,
  {
    vertexSource: vertexWGSLString,      // Inline WGSL vertex shader
    fragmentSource: fragmentWGSLString,   // Inline WGSL fragment shader
  },
  {
    attributes: ['position', 'normal', 'uv'],           // Vertex attributes
    uniformBuffers: ['Scene', 'Mesh', 'waveParams'],    // CRITICAL: Include ALL custom uniforms!
    needAlphaBlending: true,                            // For transparent materials
    backFaceCulling: false,                             // Disable for water (render both sides)
    alphaMode: BABYLON.Engine.ALPHA_BLEND,              // Blending mode
  }
);
```

---

## Uniform Buffer Management

### Creating Custom Uniform Buffers

```typescript
const waveParamsBuffer = new BABYLON.UniformBuffer(engine);
waveParamsBuffer.addUniform('time', 1);          // 1 float
waveParamsBuffer.addUniform('amplitude', 1);     // 1 float
waveParamsBuffer.addUniform('frequency', 1);     // 1 float
waveParamsBuffer.addUniform('windDir', 1);       // 1 float
waveParamsBuffer.addUniform('windSpeed', 1);     // 1 float
waveParamsBuffer.addUniform('foamIntensity', 1); // 1 float
waveParamsBuffer.addUniform('causticIntensity', 1); // 1 float
waveParamsBuffer.addUniform('causticScale', 1);  // 1 float
waveParamsBuffer.update();

material.setUniformBuffer('waveParams', waveParamsBuffer);
```

### Updating Uniform Buffers in Render Loop

```typescript
engine.runRenderLoop(() => {
  if (waveParamsBuffer) {
    waveParamsBuffer.updateFloat('time', currentTime);
    waveParamsBuffer.updateFloat('amplitude', waveAmplitude);
    waveParamsBuffer.updateFloat('frequency', waveFrequency);
    // ... update other uniforms ...
    waveParamsBuffer.update();  // Commit changes to GPU
  }
  
  scene.render();
});
```

---

## Key Takeaways

1. **Custom WGSL must be completely standalone** - No Babylon template boilerplate, no references to injected structs
2. **Delete all template lines** - Remove `vertexInputs = input`, `fragmentInputs = input`, `vertexOutputs.*`, `fragmentOutputs`
3. **NO `@group/@binding` on uniforms** - Babylon auto-injects them; duplicates cause compilation errors
4. **Use inline WGSL strings** - Never pass file paths; SPA routers return HTML
5. **Use domain-specific struct names** - Avoid `VertexInputs`/`FragmentInputs` (Babylon's reserved names)
6. **Force WGSL compilation** - Add `shaderLanguage: BABYLON.ShaderLanguage.WGSL` to prevent GLSL transpilation
7. **Pass WGSL via `vertexSource`/`fragmentSource`** - Not via file paths or shader store names
8. **uniformBuffers MUST include ALL custom uniforms** - `uniformBuffers: ['Scene', 'Mesh', 'waveParams']` (CRITICAL!)
9. **Assign material to mesh** - Call `mesh.material = material` after creating the material
10. **Configure transparency** - Set `transparencyMode = MATERIAL_ALPHABLEND` and `backFaceCulling = false` for water
11. **Set rendering group** - Use `mesh.renderingGroupId = 2` for transparent objects
12. **Update uniform buffers each frame** - Use `updateFloat()` and `update()` in render loop for animation

---

## References

- [Babylon.js WebGPU Documentation](https://doc.babylonjs.com/features/featuresDeepDive/Rendering/WebGPU)
- [WGSL Specification](https://www.w3.org/TR/WGSL/)
- [Babylon.js ShaderMaterial API](https://doc.babylonjs.com/features/featuresDeepDive/Materials/Using/ShaderMaterial)
