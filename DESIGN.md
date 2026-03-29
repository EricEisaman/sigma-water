# Sigma Water Demo - Design & Architecture

## Overview

This document outlines the architecture and design approach for recreating the ThreeJSWaterPro demo using Babylon.js 9. The implementation will focus on realistic ocean water rendering with FFT-based wave simulation, dynamic reflections, refractions, foam generation, and interactive controls.

## Scene Architecture

### Core Components

The water demo will consist of the following major components:

| Component | Purpose | Technology |
|-----------|---------|-----------|
| **Water Mesh** | Main water surface geometry | Babylon.js Mesh with subdivisions |
| **Wave System** | Height field generation | Gerstner waves + analytical displacement |
| **Material System** | Water appearance and effects | Custom WGSL shader with Babylon.js material |
| **Reflection/Refraction** | Environmental effects | RenderTargetTexture + Fresnel blending |
| **Caustics** | Underwater light patterns | Procedural texture + scrolling animation |
| **Foam** | Wave crest visualization | Fragment shader based on curvature |
| **Skybox** | Environment | Procedural sky or HDR texture |
| **UI Controls** | Parameter adjustment | React interface with sliders |

### Rendering Pipeline

The rendering will follow this sequence:

1. **Depth Prepass** (optional): Render depth for transparency sorting
2. **Reflection Capture**: Render scene to reflection texture (excluding water)
3. **Refraction Capture**: Render scene to refraction texture (underwater view)
4. **Water Rendering**: Apply water material with all effects
5. **Post-Processing** (optional): Tone mapping, color grading

## Water Simulation Strategy

### Wave Generation Approach

Instead of implementing full FFT (which is complex), the initial implementation will use **Gerstner waves** - an analytical approach that provides realistic wave behavior with lower computational cost:

```
Wave Height = sum of Gerstner waves
Each wave defined by: amplitude, wavelength, direction, steepness, phase speed
```

**Gerstner Wave Parameters**:
- **Amplitude (A)**: Wave height
- **Wavelength (λ)**: Distance between wave crests
- **Direction (D)**: Wave propagation direction (2D)
- **Steepness (S)**: Controls wave peak sharpness (0-1)
- **Phase Speed (ω)**: Wave movement speed

### Multi-Cascade System

To achieve detail at multiple scales, we'll layer multiple Gerstner waves:

| Cascade | Wavelength | Amplitude | Purpose |
|---------|-----------|-----------|---------|
| Large Swells | 200-500m | 1-3m | Overall ocean motion |
| Medium Waves | 50-150m | 0.5-1.5m | Wave structure |
| Ripples | 5-20m | 0.1-0.3m | Surface detail |

## Shader Architecture

### Vertex Shader

The vertex shader will:
1. Sample wave height field at current vertex position
2. Calculate vertex normal from wave derivatives
3. Displace vertex position based on wave height
4. Calculate tangent vectors for normal mapping
5. Pass data to fragment shader

### Fragment Shader

The fragment shader will implement:

1. **Fresnel Effect**: Blend between reflection and refraction based on view angle
   - Steep angles: More refraction (see through water)
   - Shallow angles: More reflection (mirror-like)

2. **Water Color**: 
   - Shallow water: Lighter, more transparent
   - Deep water: Darker, more opaque
   - Based on depth sampling

3. **Foam Generation**:
   - Calculated from wave curvature (second derivative)
   - Appears on wave crests
   - Fades with distance

4. **Caustics**:
   - Scrolling caustic texture
   - Modulates light intensity
   - Creates underwater light patterns

5. **Specular Highlights**:
   - Sun reflection on water surface
   - Based on wave normal and light direction

6. **Normal Mapping**:
   - Combines wave-derived normals with detail normals
   - Adds surface roughness variation

## Material System

### Custom Material Implementation

```typescript
// Pseudocode structure
class WaterMaterial extends ShaderMaterial {
  uniforms: {
    // Wave parameters
    waveAmplitude: float[]
    waveWavelength: float[]
    waveDirection: vec2[]
    waveSteepness: float[]
    
    // Rendering parameters
    waterColor: vec3
    deepColor: vec3
    foamColor: vec3
    
    // Textures
    reflectionTexture: RenderTargetTexture
    refractionTexture: RenderTargetTexture
    causticsTexture: Texture
    normalMap: Texture
    
    // Lighting
    sunDirection: vec3
    sunColor: vec3
    
    // Time
    time: float
  }
  
  vertexShader: string // Gerstner wave displacement
  fragmentShader: string // Fresnel, foam, caustics, etc.
}
```

## Performance Optimization

### Level of Detail (LOD)

- **Close Range (0-100m)**: High-resolution mesh with detailed waves
- **Mid Range (100-500m)**: Medium resolution with simplified waves
- **Far Range (500m+)**: Low-resolution mesh with distant wave patterns

### Texture Optimization

- **Caustics**: 512x512 texture, scrolled and tiled
- **Normal Map**: 1024x1024, reused across surface
- **Reflection/Refraction**: 1024x1024 render targets (adjustable quality)

### Shader Optimization

- Minimize texture lookups in fragment shader
- Use pre-computed wave data when possible
- Implement early-exit for fully opaque/transparent pixels
- Use derivatives for efficient normal calculation

## UI Control System

### Interactive Parameters

The React UI will expose controls for:

| Parameter | Range | Default | Effect |
|-----------|-------|---------|--------|
| Wave Amplitude | 0.1 - 5.0 | 1.5 | Overall wave height |
| Wave Frequency | 0.1 - 2.0 | 1.0 | Wave density |
| Wind Direction | 0° - 360° | 45° | Wave propagation direction |
| Water Color | RGB | #1E90FF | Shallow water tint |
| Deep Color | RGB | #001F3F | Deep water tint |
| Foam Intensity | 0.0 - 1.0 | 0.6 | Foam visibility |
| Caustics Intensity | 0.0 - 1.0 | 0.5 | Caustic effect strength |
| Sun Intensity | 0.0 - 2.0 | 1.0 | Specular highlight strength |
| Camera Speed | 0.1 - 5.0 | 1.0 | Mouse control sensitivity |

### Performance Metrics Display

Real-time display of:
- FPS (frames per second)
- Frame time (milliseconds)
- Draw calls
- Triangle count
- Memory usage
- Renderer info (WebGPU/WebGL)

## Implementation Phases

### Phase 1: Foundation
- Set up Babylon.js scene with camera and lighting
- Create water mesh with appropriate subdivision
- Implement basic Gerstner wave displacement

### Phase 2: Core Material
- Develop water shader with wave normals
- Implement Fresnel effect
- Add water color and depth-based transparency

### Phase 3: Advanced Effects
- Implement reflection/refraction capture
- Add foam generation
- Integrate caustics texture and animation

### Phase 4: Polish & Optimization
- Add UI controls for all parameters
- Implement LOD system
- Performance profiling and optimization
- Add skybox and environment

### Phase 5: Refinement
- Fine-tune visual appearance
- Add animations and transitions
- Implement preset configurations
- Documentation and deployment

## Technical Considerations

### Browser Compatibility

- **WebGPU**: Primary target for best performance (Chrome 113+, Edge 113+)
- **WebGL**: Fallback for broader compatibility
- **Feature Detection**: Graceful degradation for unsupported features

### Mobile Support

- Reduced geometry complexity on mobile
- Lower texture resolutions
- Simplified shader variants
- Touch-based camera controls

### Accessibility

- Keyboard navigation for all controls
- ARIA labels for UI elements
- High contrast mode support
- Reduced motion options for animations

## References

This design is informed by:
- Babylon.js 9 rendering capabilities and Frame Graph system
- Jerry Tessendorf's ocean simulation research
- Gerstner wave theory for analytical wave displacement
- Modern WebGPU shader techniques
