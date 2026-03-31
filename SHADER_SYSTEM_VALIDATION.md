# Shader System Validation & Testing Guide

## Architecture Overview

The shader system is built on three core abstractions:

1. **ShaderContext** - Individual shader lifecycle management
2. **ShaderManager** - Orchestrates transitions between contexts
3. **ShaderRegistry** - Declarative registry for all shaders

## Current Implementation Status

### ✅ Completed

- [x] ShaderContext abstraction with lifecycle management
- [x] ShaderManager with smooth transitions
- [x] ShaderRegistry with declarative API
- [x] gerstnerWaves shader definition (full WGSL)
- [x] oceanWaves shader definition (proper WGSL port)
- [x] Integration into VisualOcean.ts
- [x] Automatic shader registration on startup
- [x] 300ms fade transitions between shaders
- [x] Uniform preservation across switches
- [x] Production build verification

### 🔄 In Progress

- [ ] Browser testing of shader switching
- [ ] Validation of all selectable shaders rendering correctly
- [ ] Performance profiling (target: 60fps)
- [ ] Console logging verification
- [ ] WaterControls integration for crest/intersection/underwater controls

### 📋 TODO

- [ ] Add 10+ additional water type shaders
- [ ] Implement preset system (save/load configurations)
- [ ] Create performance metrics display
- [ ] Add visual shader indicators in UI
- [ ] Optimize for GDC 2026 showcase
- [ ] Create demo video/screenshots

## Testing Checklist

### Browser Testing

**Prerequisites:**
- Dev server running: `pnpm run dev`
- Browser console open (F12)
- Network tab for performance monitoring

**Test 1: Initial Load**
```
Expected:
- Ocean renders with gerstnerWaves shader
- Console shows: "✅ Shader registry initialized with 2 shaders"
- No WebGL errors
- 60fps maintained
```

**Test 2: Shader Switching**
```
Steps:
1. Open WaterControls dropdown
2. Select "Ocean Waves"
3. Observe transition

Expected:
- 300ms smooth fade transition
- Console shows: "🔄 Switching to shader: oceanWaves"
- Ocean mesh updates with new shader
- No flickering or artifacts
- Uniforms synchronized
```

**Test 3: Switch Back**
```
Steps:
1. Select "Gerstner Waves" from dropdown
2. Observe transition

Expected:
- Smooth fade back to original shader
- All foam/caustics effects restored
- No performance degradation
```

**Test 4: Rapid Switching**
```
Steps:
1. Rapidly toggle between shaders 5+ times
2. Monitor performance

Expected:
- No crashes or errors
- Smooth transitions maintained
- Memory stable (no leaks)
- FPS remains 60+
```

**Test 5: Console Logging**
```
Check console for:
- ✅ Shader registry initialization
- ✅ Shader context creation
- ✅ Activation/deactivation messages
- ✅ Transition completion
- ❌ No error messages
```

### Performance Metrics

**Target Benchmarks:**
- Initial load: < 3 seconds
- Shader switch time: < 50ms (excluding fade)
- Memory per shader: < 5MB
- FPS during switch: 60+ (with fade)
- No frame drops during transition

**Profiling Steps:**
1. Open DevTools Performance tab
2. Start recording
3. Switch shader
4. Stop recording
5. Analyze frame time and memory

### Visual Validation

**Gerstner Waves Shader:**
- [ ] Ocean surface animates smoothly
- [ ] Wave height variations visible
- [ ] Crest foam appears and responds to threshold/intensity controls
- [ ] Caustics pattern visible underwater
- [ ] Boat mesh-water intersection foam renders and tracks immersion
- [ ] Island shoreline intersection foam renders and tracks immersion
- [ ] Intersection foam can be disabled independently from crest foam

**Ocean Waves Shader:**
- [ ] Multi-octave wave pattern visible
- [ ] Procedural noise-based waves
- [ ] Fresnel reflection effect
- [ ] Sky color reflection
- [ ] Smooth wave animation
- [ ] Crest foam controls produce visible response
- [ ] Intersection foam controls produce visible response

**Toon Water Shader:**
- [ ] Stylized banding remains stable after foam additions
- [ ] Crest foam controls produce visible response
- [ ] Intersection foam controls produce visible response

**Underwater Transition:**
- [ ] Above/below water transition is smooth across the waterline
- [ ] Underwater tint/fog controls visibly affect result
- [ ] Rapid camera oscillation near waterline does not flicker

## Shader Definition Template

For adding new water types:

```typescript
export const newWavesDefinition: ShaderRegistryEntry = {
  id: 'newWaves',
  displayName: 'New Waves',
  description: 'Description of the shader',
  
  features: {
    supportsFoam: true,
    supportsCaustics: true,
    supportsCollisions: true,
    supportsWake: true,
  },
  
  shader: {
    vertex: `/* WGSL vertex code */`,
    fragment: `/* WGSL fragment code */`,
  },
  
  babylon: {
    uniforms: ['time', 'cameraPosition', /* ... */],
    attributes: ['position', 'normal', 'uv'],
    samplers: ['sceneDepth'],
    uniformBuffers: ['Scene', 'Mesh'],
  },
  
  setup: (context: ShaderContext) => {
    // Initialize uniforms
    context.setUniforms({
      time: 0,
      cameraPosition: [0, 10, 0],
    });
  },
  
  update: (context: ShaderContext, deltaTime: number) => {
    // Update per-frame uniforms
    const time = context.getUniform('time') || 0;
    context.setUniform('time', time + deltaTime * 0.001);
  },
  
  cleanup: () => {
    // Cleanup resources
    console.log('Cleaning up newWaves shader');
  },
};
```

## Console Output Reference

### Initialization
```
📝 Initializing shader registry...
✅ Shader registry initialized with 2 shaders
🎨 Initializing shader context: gerstnerWaves
✅ Shader context initialized: gerstnerWaves
🎨 Initializing shader context: oceanWaves
✅ Shader context initialized: oceanWaves
```

### Shader Switching
```
🎨 Switching shader to: oceanWaves
🔄 Switching to shader: oceanWaves
🎬 Activating shader context: oceanWaves
✅ Shader context activated: oceanWaves
✅ Shader switched successfully to: oceanWaves
```

### Cleanup
```
🧹 Disposing shader context: gerstnerWaves
✅ Shader context disposed: gerstnerWaves
```

## Troubleshooting

### Issue: Shader doesn't switch
**Solution:**
1. Check console for errors
2. Verify shader ID exists in registry
3. Ensure ocean mesh is initialized
4. Check WaterControls dropdown value

### Issue: Black screen after switch
**Solution:**
1. Verify fragment shader compiles
2. Check uniform values are set
3. Ensure camera position is correct
4. Verify material properties (alpha, culling)

### Issue: Performance drops during switch
**Solution:**
1. Profile with DevTools
2. Check for memory leaks
3. Verify material disposal
4. Monitor GPU memory

### Issue: Uniforms not updating
**Solution:**
1. Verify uniform name matches shader
2. Check uniform type (float, vec2, vec3, etc.)
3. Ensure setUniform is called with correct type
4. Verify shader context is active

## GDC 2026 Showcase Checklist

- [ ] 20+ water type shaders implemented
- [ ] Smooth transitions between all shaders
- [ ] Performance optimized (60fps target)
- [ ] Visual quality verified
- [ ] Preset system working
- [ ] Demo video recorded
- [ ] Performance metrics displayed
- [ ] UI polished and responsive
- [ ] Documentation complete
- [ ] Ready for live demo

## Resources

- **ShaderContext**: `client/src/lib/shaders/ShaderContext.ts`
- **ShaderManager**: `client/src/lib/shaders/ShaderManager.ts`
- **ShaderRegistry**: `client/src/lib/shaders/ShaderRegistry.ts`
- **Shader Definitions**: `client/src/lib/shaders/definitions/`
- **VisualOcean Integration**: `client/src/lib/VisualOcean.ts`
- **WaterControls**: `client/src/components/WaterControls.tsx`
