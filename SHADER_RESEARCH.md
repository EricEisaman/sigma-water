# Shader Research

## Key Technologies

### TSL (Three.js Shading Language)
- **Node-based shader abstraction** written in JavaScript
- **WGSL compilation** for WebGPU backend
- **GLSL fallback** for WebGL compatibility
- Functions inspired by GLSL but follow JavaScript-based concepts
- Allows describing shader effects without writing raw shader code

### WebGPU Implementation
- **WGSL (WebGPU Shading Language)** for compute and render shaders
- **Compute shaders** for FFT wave simulation
- **Render shaders** for water surface rendering

## Wave Simulation Approach

### FFT-Based Wave System
- **Fast Fourier Transform** for realistic ocean waves
- **JONSWAP Spectrum** - realistic ocean wave spectrum
- **Multi-cascade system**:
  - Cascade 1: Large waves (FFT-based)
  - Cascade 2: Ripples and detail (FFT-based)
  - Analytical Gerstner swells for additional realism

### Wave Parameters
- **Wavelength**: Determines wave size
- **Amplitude**: Wave height
- **Direction**: Wind direction influence
- **Phase velocity**: Wave propagation speed
- **Steepness**: Controls wave peak sharpness

## Shader Architecture

### Vertex Shader (Displacement)
1. **Wave Height Calculation**: Sample FFT height field
2. **Normal Calculation**: Compute surface normals from height derivatives
3. **Vertex Displacement**: Move vertices based on wave height
4. **Tangent/Binormal**: Calculate for normal mapping

### Fragment Shader (Appearance)
1. **Fresnel Effect**: Blend reflection/refraction based on view angle
2. **Water Color**: Depth-based color blending
3. **Specular Highlights**: Sun reflection on surface
4. **Foam Generation**: Based on wave curvature (second derivative)
5. **Caustics**: Underwater light patterns
6. **Normal Mapping**: Surface detail from normal texture

## Key Visual Features

### Reflections & Refractions
- **Environment mapping** for reflections
- **Refraction texture** for underwater view
- **Fresnel blending** to combine both effects

### Foam Rendering
- **Procedurally generated** from wave curvature
- **Appears on wave crests** where curvature is high
- **Fades with distance** for performance

### Caustics
- **Scrolling texture** for underwater light patterns
- **Modulates light intensity** beneath surface
- **Creates dynamic underwater effects**

### Specular Highlights
- **Sun reflection** on water surface
- **Depends on wave normal** and light direction
- **Physically-based** intensity calculation

## Performance Optimizations

### Compute Shaders
- **GPU-accelerated FFT** computation
- **Parallel wave calculation** across all vertices
- **Reduces CPU overhead** significantly

### Texture Atlasing
- **Multiple wave cascades** in single texture
- **Efficient memory usage**
- **Reduced texture lookups**

### Level of Detail (LOD)
- **High detail** near camera
- **Simplified waves** at distance
- **Reduced geometry** for far objects

### Viewport Culling
- **Only render visible** water regions
- **Frustum-based optimization**
- **Reduces draw calls**

## TSL/WGSL Code Patterns

### Typical TSL Wave Calculation
```javascript
// TSL pattern for wave displacement
const waveHeight = (pos) => {
  // FFT-based height field lookup
  // Gerstner wave calculation
  // Normal calculation from derivatives
  return displacement;
};
```

### WGSL Compute Shader Pattern
```wgsl
// Compute FFT for wave simulation
@compute @workgroup_size(16, 16)
fn computeWaves(@builtin(global_invocation_id) id: vec3<u32>) {
  // FFT computation
  // Height field generation
  // Normal calculation
}
```

### Fresnel Effect Pattern
```glsl
float fresnel(vec3 viewDir, vec3 normal) {
  float cosAngle = max(dot(viewDir, normal), 0.0);
  return mix(0.2, 1.0, pow(1.0 - cosAngle, 5.0));
}
```

## Babylon.js Equivalent Approaches

### For Babylon.js Implementation
1. **Use ShaderMaterial** with WGSL/GLSL shaders
2. **Implement Gerstner waves** in vertex shader (simpler than FFT)
3. **Use RenderTargetTexture** for reflections/refractions
4. **DynamicTexture** for procedural foam and caustics
5. **ComputeShader** (if available) for wave simulation

### Performance Considerations
- Babylon.js 9 supports WebGPU
- Can use compute shaders for wave simulation
- ShaderMaterial supports both GLSL and WGSL
- RenderTargetTexture for environment effects

## References

- Three.js Shading Language (TSL): https://github.com/mrdoob/three.js/wiki/Three.js-Shading-Language
- Field Guide to TSL and WebGPU: https://blog.maximeheckel.com/posts/field-guide-to-tsl-and-webgpu/
- Three.js Water Examples: https://github.com/mrdoob/three.js/blob/dev/examples/webgl_gpgpu_water.html
- Evan Wallace's WebGL Water: https://github.com/martinRenou/threejs-water
