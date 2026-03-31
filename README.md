# Sigma Water

A high-performance, interactive water rendering demonstration built with **Babylon.js**, recreating the advanced features including realistic wave simulation, dynamic visual effects, and real-time parameter controls.

## Features

### 🌊 Advanced Water Rendering
- **Multi-Cascade Wave System**: Combines large swells, medium waves, and ripples for realistic ocean behavior
- **Gerstner Wave Displacement**: Procedural vertex displacement creating natural-looking wave motion
- **Dynamic Water Texture**: Real-time animated procedural textures with wave patterns, foam, and caustics
- **Specular Highlights**: Sun reflection on water surface with adjustable intensity

### 🎮 Interactive Controls
All parameters are adjustable in real-time with live value display:

| Control | Range | Default | Effect |
|---------|-------|---------|--------|
| **Wave Amplitude** | 0.1 - 5.0 | 1.5 | Controls wave height and displacement magnitude |
| **Wave Frequency** | 0.1 - 2.0 | 1.0 | Adjusts wave density and propagation speed |
| **Wind Direction** | 0° - 360° | 45° | Changes wave propagation direction |
| **Foam Intensity** | 0.0 - 1.0 | 0.6 | Modulates foam visibility and water transparency |
| **Caustics Intensity** | 0.0 - 1.0 | 0.5 | Controls underwater light pattern effects |
| **Sun Intensity** | 0.0 - 2.0 | 1.0 | Adjusts specular highlight strength |
| **Camera Speed** | 0.1 - 5.0 | 1.0 | Modifies camera navigation sensitivity |

### 🎨 Color Customization
- **Water Color**: Adjust the surface water hue (default: `#1E90FF` - dodger blue)
- **Deep Water Color**: Customize the deep water appearance (default: `#001F3F` - navy)

### 📊 Performance Monitoring
Real-time statistics display in the top-left corner:
- **FPS**: Frames per second
- **Frame Time**: Milliseconds per frame
- **Draw Calls**: Number of render calls
- **Triangles**: Polygon count
- **Renderer**: WebGL version or WebGPU

### 🎥 Camera Controls
- **Rotate**: Click and drag with mouse
- **Zoom**: Mouse scroll wheel
- **Pan**: WASD keys for movement
- **Speed**: Adjustable via Camera Speed slider

## Scene Elements

- **Skybox**: Atmospheric gradient sky with realistic lighting
- **Island**: Textured geometry for visual reference and reflections
- **Reflective Sphere**: Demonstrates material properties and light interaction
- **Water Plane**: 2000x2000 unit mesh with 200x200 subdivisions for wave detail

## Technical Implementation

### Architecture
- **Framework**: React 19 + Babylon.js 9
- **Rendering**: WebGL2 (with WebGPU support)
- **Styling**: Tailwind CSS 4 + shadcn/ui
- **State Management**: React Hooks

### Water Simulation
The water system uses a procedural approach combining:

1. **Vertex Displacement**: Gerstner wave equations applied to mesh vertices
2. **Normal Recalculation**: Per-frame normal updates for accurate lighting
3. **Texture Animation**: Dynamic procedural textures for surface detail
4. **Wave Cascades**: Three independent wave systems at different scales

### Performance Optimizations
- Vertex updates every 3 frames (not every frame) for performance
- Procedural textures updated efficiently
- Optimized mesh subdivision balance (200x200)
- Efficient state management with React hooks

## Getting Started

### Installation
```bash
cd babylon-water-pro-demo
pnpm install
```

### Development
```bash
pnpm run dev
```
The demo will be available at `http://localhost:3000`

### Production Build
```bash
pnpm run build
pnpm run start
```

### Verification
```bash
pnpm run verify:all
```

This runs unit tests, TypeScript checks, and runtime log verification.

For runtime-only validation:
```bash
pnpm run verify:runtime-log
```

This command checks the most recent 10-minute window in `.manus-logs/browserConsole.log` for critical rendering failure signatures.
It also fails if the newest log entry is stale (older than 20 minutes), preventing false passes on outdated logs.

For marker validation (fresh successful render evidence):
```bash
pnpm run verify:render-markers
```

This checks the same log window for first-frame and render-health success markers.
If first-frame is not present in the current window, timestamped shader-switch success markers are accepted as alternate render evidence.

For CI contexts where runtime logs may not exist:
```bash
pnpm run verify:ci
```

This runs tests, type checks, runtime failure-signature scanning, and render-marker validation.
Both log-based checks are configured with `--allow-missing-file true` so CI can pass in environments without browser log capture.

For local concise output:
```bash
pnpm run verify:concise
```

This is the same validation set as `verify:all`, using a dot reporter for shorter test output.

GitHub Actions workflow is available at `.github/workflows/verify.yml` and runs on push + pull request.

## Browser Requirements
- **WebGL2** support (all modern browsers)
- **WebGPU** support (optional, for enhanced features)
- Hardware acceleration enabled
- Minimum 2GB RAM recommended for smooth performance

## File Structure
```
client/
├── src/
│   ├── pages/
│   │   └── Home.tsx           # Main demo page
│   ├── components/
│   │   ├── ControlPanel.tsx   # Interactive parameter controls
│   │   └── PerformanceMonitor.tsx  # Real-time stats display
│   ├── lib/
│   │   └── VisualOcean.ts     # Babylon.js WebGPU/WGSL ocean renderer
│   ├── App.tsx                # React router setup
│   ├── main.tsx               # React entry point
│   └── index.css              # Global styles
├── public/
│   └── favicon.ico
└── index.html
```

## Performance Tips

1. **Reduce Wave Frequency** for better performance on lower-end devices
2. **Lower Camera Speed** to reduce unnecessary calculations
3. **Adjust mesh/subdivision settings** in VisualOcean.ts if needed
4. **Monitor FPS** using the Performance Monitor widget

## Comparison with Three.js Water Pro

| Feature | Babylon.js Demo | Three.js Water Pro |
|---------|-----------------|-------------------|
| Wave System | Gerstner multi-cascade | FFT-based JONSWAP |
| Rendering | WebGL2/WebGPU | WebGPU/WebGL2 |
| Reflections | Material-based | Render-to-texture |
| Refractions | Material-based | Render-to-texture |
| Caustics | Procedural texture | GPU-computed |
| Performance | Optimized | Ultra-optimized |

## Future Enhancements

1. **GPU Compute Shaders**: Implement FFT-based wave simulation for improved realism
2. **Reflection/Refraction Maps**: Add render-to-texture for environment reflections
3. **Physics Integration**: Floating objects with wave-based buoyancy
4. **Advanced Caustics**: GPU-computed caustics for underwater effects
5. **Mobile Optimization**: Adaptive quality settings for mobile devices
6. **Post-Processing**: Bloom, depth of field, and other effects

## Troubleshooting

### WebGL Not Supported
- Ensure your browser supports WebGL2
- Check that hardware acceleration is enabled
- Try a different browser (Chrome, Firefox, Safari, Edge)

### Low Performance
- Reduce Wave Amplitude and Frequency
- Lower Camera Speed
- Disable unnecessary visual effects
- Check browser console for errors

### Sliders Not Responding
- Ensure JavaScript is enabled
- Clear browser cache and reload
- Check browser console for errors

## Credits

- **Babylon.js**: https://www.babylonjs.com/
- **React**: https://react.dev/
- **Tailwind CSS**: https://tailwindcss.com/

## License

MIT License - Feel free to use this demo as a reference for your own projects.

## Support

For issues or questions:
1. Check the browser console for error messages
2. Verify WebGL2 support in your browser
3. Try different parameter values
4. Clear cache and reload the page

---

**Sigma Water** - Experience realistic ocean rendering in your browser.
