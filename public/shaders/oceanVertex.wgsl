// SIGGRAPH-Grade Ocean Vertex Shader - Babylon.js 9 WebGPU
// Gerstner Waves + Wave Normals + Foam Generation + Advanced Displacement
// WGSL Only - No GLSL

// Uniforms
uniform time: f32;
uniform amplitude: f32;
uniform frequency: f32;
uniform windDirection: f32;
uniform windSpeed: f32;
uniform foamIntensity: f32;
uniform foamThreshold: f32;
uniform causticIntensity: f32;
uniform causticScale: f32;

// Vertex input
struct VertexInput {
  @location(0) position: vec3<f32>,
  @location(1) normal: vec3<f32>,
  @location(2) uv: vec2<f32>,
};

// Vertex output
struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) worldPos: vec3<f32>,
  @location(1) normal: vec3<f32>,
  @location(2) uv: vec2<f32>,
  @location(3) foam: f32,
  @location(4) waveHeight: f32,
};

// Gerstner wave parameters
struct Wave {
  direction: vec2<f32>,
  wavelength: f32,
  amplitude: f32,
  phase: f32,
  steepness: f32,
};

// Calculate Gerstner wave displacement with high precision
fn gerstnerWave(
  wave: Wave,
  position: vec3<f32>,
  time: f32
) -> vec4<f32> {
  let k = 2.0 * 3.14159265359 / wave.wavelength;
  let c = sqrt(9.81 / k);
  let d = normalize(wave.direction);
  let f = k * (dot(d, position.xz) - c * time) + wave.phase;
  let a = wave.steepness / k;

  let displacement = vec3<f32>(
    a * d.x * cos(f),
    wave.amplitude * sin(f),
    a * d.y * cos(f)
  );

  return vec4<f32>(displacement, f);
}

// Calculate wave normal with improved precision
fn calculateWaveNormal(
  position: vec3<f32>,
  time: f32
) -> vec3<f32> {
  let epsilon = 0.01;
  
  // Sample height at nearby points for finite difference calculation
  let h0 = gerstnerWave(
    Wave(vec2<f32>(cos(windDirection), sin(windDirection)), 60.0, amplitude * 0.5, 0.0, 0.25),
    position,
    time
  ).y;
  
  let h1 = gerstnerWave(
    Wave(vec2<f32>(cos(windDirection), sin(windDirection)), 60.0, amplitude * 0.5, 0.0, 0.25),
    position + vec3<f32>(epsilon, 0.0, 0.0),
    time
  ).y;
  
  let h2 = gerstnerWave(
    Wave(vec2<f32>(cos(windDirection), sin(windDirection)), 60.0, amplitude * 0.5, 0.0, 0.25),
    position + vec3<f32>(0.0, 0.0, epsilon),
    time
  ).y;

  let dx = (h1 - h0) / epsilon;
  let dz = (h2 - h0) / epsilon;

  return normalize(vec3<f32>(-dx, 1.0, -dz));
}

// Calculate foam based on wave steepness and crest detection
fn calculateFoam(
  position: vec3<f32>,
  time: f32,
  waveHeight: f32
) -> f32 {
  // Multiple wave contributions for complex foam patterns
  let wave1 = gerstnerWave(
    Wave(vec2<f32>(cos(windDirection), sin(windDirection)), 60.0, amplitude * 0.5, 0.0, 0.25),
    position,
    time
  );
  
  let wave2 = gerstnerWave(
    Wave(vec2<f32>(cos(windDirection + 0.5), sin(windDirection + 0.5)), 40.0, amplitude * 0.3, 1.5, 0.3),
    position,
    time
  );
  
  let wave3 = gerstnerWave(
    Wave(vec2<f32>(cos(windDirection + 1.0), sin(windDirection + 1.0)), 20.0, amplitude * 0.2, 3.0, 0.35),
    position,
    time
  );

  // Calculate steepness (derivative magnitude)
  let steepness1 = abs(sin(wave1.w)) * 0.25;
  let steepness2 = abs(sin(wave2.w)) * 0.3;
  let steepness3 = abs(sin(wave3.w)) * 0.35;

  let totalSteepness = (steepness1 + steepness2 + steepness3) / 3.0;
  
  // Foam appears on steep wave faces
  let foam = smoothstep(foamThreshold, 1.0, totalSteepness) * foamIntensity;
  
  // Add wave crest foam with smooth transition
  let crestFoam = smoothstep(0.5, 1.0, waveHeight / (amplitude * 1.5)) * 0.4;
  
  // Combine foam effects
  let combinedFoam = clamp(foam + crestFoam, 0.0, 1.0);
  
  // Add temporal variation for realistic foam movement
  let temporalVariation = sin(time * 0.5 + position.x * 0.1 + position.z * 0.1) * 0.1 + 0.9;
  
  return combinedFoam * temporalVariation;
}

// Advanced wave displacement with multiple layers
fn calculateWaveDisplacement(
  position: vec3<f32>,
  time: f32
) -> vec3<f32> {
  // Layer 1: Large primary waves
  let wave1 = gerstnerWave(
    Wave(vec2<f32>(cos(windDirection), sin(windDirection)), 60.0, amplitude * 0.5, 0.0, 0.25),
    position,
    time
  );
  
  // Layer 2: Medium secondary waves
  let wave2 = gerstnerWave(
    Wave(vec2<f32>(cos(windDirection + 0.5), sin(windDirection + 0.5)), 40.0, amplitude * 0.3, 1.5, 0.3),
    position,
    time
  );
  
  // Layer 3: Small tertiary waves
  let wave3 = gerstnerWave(
    Wave(vec2<f32>(cos(windDirection + 1.0), sin(windDirection + 1.0)), 20.0, amplitude * 0.2, 3.0, 0.35),
    position,
    time
  );
  
  // Combine all wave layers
  return wave1.xyz + wave2.xyz + wave3.xyz;
}

@vertex
fn main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  
  var position = input.position;
  
  // Apply multi-layer Gerstner wave displacement
  let displacement = calculateWaveDisplacement(position, time);
  position += displacement;

  // Calculate total wave height for foam
  let wave1 = gerstnerWave(
    Wave(vec2<f32>(cos(windDirection), sin(windDirection)), 60.0, amplitude * 0.5, 0.0, 0.25),
    input.position,
    time
  );
  
  let wave2 = gerstnerWave(
    Wave(vec2<f32>(cos(windDirection + 0.5), sin(windDirection + 0.5)), 40.0, amplitude * 0.3, 1.5, 0.3),
    input.position,
    time
  );
  
  let wave3 = gerstnerWave(
    Wave(vec2<f32>(cos(windDirection + 1.0), sin(windDirection + 1.0)), 20.0, amplitude * 0.2, 3.0, 0.35),
    input.position,
    time
  );

  let totalWaveHeight = wave1.y + wave2.y + wave3.y;

  // Calculate normal from waves
  let waveNormal = calculateWaveNormal(input.position, time);

  // Calculate foam
  let foam = calculateFoam(input.position, time, totalWaveHeight);

  // Output
  output.worldPos = position;
  output.normal = waveNormal;
  output.uv = input.uv;
  output.foam = foam;
  output.waveHeight = totalWaveHeight;
  output.position = worldViewProjection * vec4<f32>(position, 1.0);

  return output;
}
