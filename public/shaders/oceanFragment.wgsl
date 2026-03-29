// SIGGRAPH-Grade Ocean Fragment Shader - Babylon.js 9 WebGPU
// Advanced Fresnel + Caustics + Foam + PBR Lighting + Tone Mapping
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

// Fragment input
struct FragmentInput {
  @location(0) worldPos: vec3<f32>,
  @location(1) normal: vec3<f32>,
  @location(2) uv: vec2<f32>,
  @location(3) foam: f32,
  @location(4) waveHeight: f32,
};

// Fragment output
struct FragmentOutput {
  @location(0) color: vec4<f32>,
};

// Constants
const PI = 3.14159265359;
const WATER_DEPTH = 50.0;
const LIGHT_DIR = vec3<f32>(-0.577, 0.577, -0.577);
const SKY_COLOR = vec3<f32>(0.53, 0.81, 0.92);
const WATER_COLOR_DEEP = vec3<f32>(0.0, 0.15, 0.3);
const WATER_COLOR_SHALLOW = vec3<f32>(0.15, 0.7, 0.9);

// Fresnel effect (Schlick approximation) - SIGGRAPH quality
fn fresnel(cosTheta: f32, f0: f32) -> f32 {
  let clampedCos = clamp(1.0 - cosTheta, 0.0, 1.0);
  return f0 + (1.0 - f0) * pow(clampedCos, 5.0);
}

// Advanced caustic pattern generation
fn causticPattern(position: vec3<f32>, time: f32) -> f32 {
  let uv = position.xz * causticScale;
  
  // Multiple sine waves for complex caustic patterns
  let wave1 = sin(uv.x + time * 0.5) * cos(uv.y + time * 0.3);
  let wave2 = sin(uv.y - time * 0.4) * cos(uv.x - time * 0.2);
  let wave3 = sin((uv.x + uv.y) * 0.5 + time * 0.6);
  let wave4 = cos(uv.x * 0.7 - time * 0.35) * sin(uv.y * 0.7 + time * 0.25);
  
  let pattern = (wave1 + wave2 + wave3 + wave4) / 4.0;
  let caustic = smoothstep(0.0, 1.0, pattern * 0.5 + 0.5);
  
  // Add high-frequency detail
  let detail = sin(uv.x * 3.0 + time) * sin(uv.y * 3.0 + time) * 0.2;
  
  return (caustic + detail) * causticIntensity;
}

// Underwater caustics projection with depth fade
fn underwaterCaustics(position: vec3<f32>, depth: f32, time: f32) -> vec3<f32> {
  let caustic = causticPattern(position, time);
  
  // Caustics fade with depth using exponential decay
  let depthFade = exp(-depth / WATER_DEPTH);
  
  // Caustic color (bright cyan-white with slight green tint)
  let causticColor = vec3<f32>(0.85, 1.0, 0.95) * caustic * depthFade;
  
  return causticColor;
}

// Advanced foam rendering with specular highlights
fn renderFoam(foam: f32, normal: vec3<f32>, lightDir: vec3<f32>) -> vec3<f32> {
  if (foam < 0.01) {
    return vec3<f32>(0.0);
  }
  
  // Foam is bright white with slight blue tint
  let foamColor = vec3<f32>(0.98, 0.99, 1.0);
  
  // Foam is brightest on top surface
  let foamBrightness = foam * smoothstep(-0.5, 0.5, normal.y);
  
  // Add specular highlight to foam
  let specular = pow(max(0.0, dot(reflect(-lightDir, normal), vec3<f32>(0.0, 1.0, 0.0))), 64.0);
  
  // Add rim lighting for foam edges
  let rimLight = pow(max(0.0, 1.0 - dot(normal, vec3<f32>(0.0, 1.0, 0.0))), 3.0) * 0.3;
  
  return foamColor * foamBrightness * (0.8 + specular * 0.3 + rimLight);
}

// PBR lighting calculation - SIGGRAPH quality
fn pbrLighting(
  normal: vec3<f32>,
  viewDir: vec3<f32>,
  lightDir: vec3<f32>,
  baseColor: vec3<f32>,
  metallic: f32,
  roughness: f32
) -> vec3<f32> {
  let h = normalize(lightDir + viewDir);
  let cosTheta = max(0.0, dot(normal, lightDir));
  let cosH = max(0.0, dot(normal, h));
  let cosV = max(0.0, dot(normal, viewDir));
  
  // Fresnel
  let f0 = mix(vec3<f32>(0.04), baseColor, metallic);
  let f = fresnel(cosH, f0.x);
  
  // Roughness affects specular
  let alpha = roughness * roughness;
  let alphaSq = alpha * alpha;
  
  // GGX distribution
  let denominator = cosH * cosH * (alphaSq - 1.0) + 1.0;
  let d = alphaSq / (PI * denominator * denominator);
  
  // Geometry (Schlick-GGX)
  let k = (roughness + 1.0) * (roughness + 1.0) / 8.0;
  let g1 = cosTheta / (cosTheta * (1.0 - k) + k);
  let g2 = cosV / (cosV * (1.0 - k) + k);
  let g = g1 * g2;
  
  // Specular BRDF
  let specular = (f * d * g) / max(0.001, 4.0 * cosTheta * cosV);
  
  // Diffuse
  let kd = (1.0 - f) * (1.0 - metallic);
  let diffuse = kd * baseColor / PI;
  
  // Combine
  let radiance = vec3<f32>(1.2); // Sun intensity
  return (diffuse + specular) * radiance * cosTheta;
}

// Normal mapping with detail perturbation
fn perturbNormal(normal: vec3<f32>, position: vec3<f32>, time: f32) -> vec3<f32> {
  let detailScale = 5.0;
  let detail1 = sin(position.x * detailScale + time) * sin(position.z * detailScale + time * 0.7);
  let detail2 = cos(position.x * detailScale * 0.5 + time * 0.5) * cos(position.z * detailScale * 0.5 + time * 0.3);
  let detail3 = sin((position.x + position.z) * detailScale * 0.3 + time * 0.4) * 0.1;
  
  let perturbation = vec3<f32>(detail1 * 0.06, detail3, detail2 * 0.06);
  
  return normalize(normal + perturbation);
}

// Atmospheric scattering for underwater effect
fn atmosphericScattering(viewDir: vec3<f32>, lightDir: vec3<f32>, depth: f32) -> vec3<f32> {
  let sunDot = max(0.0, dot(viewDir, lightDir));
  let scatterFactor = pow(sunDot, 0.5) * 0.3;
  
  let scatterColor = mix(
    vec3<f32>(0.1, 0.3, 0.5),
    vec3<f32>(1.0, 0.8, 0.6),
    sunDot
  );
  
  let depthFade = exp(-depth / WATER_DEPTH * 0.5);
  
  return scatterColor * scatterFactor * depthFade;
}

@fragment
fn main(input: FragmentInput) -> FragmentOutput {
  var output: FragmentOutput;
  
  // Normalize inputs
  let normal = normalize(input.normal);
  let viewDir = normalize(vec3<f32>(0.0, 1.0, 0.0) - input.worldPos);
  let lightDir = normalize(LIGHT_DIR);
  
  // Perturb normal for detail
  let perturbedNormal = perturbNormal(normal, input.worldPos, time);
  
  // Calculate Fresnel for reflection/refraction blend
  let cosTheta = max(0.0, dot(perturbedNormal, viewDir));
  let fresnelFactor = fresnel(cosTheta, 0.02);
  
  // Water color based on depth (simplified)
  let depthColor = mix(WATER_COLOR_DEEP, WATER_COLOR_SHALLOW, smoothstep(0.0, 1.0, input.waveHeight / amplitude + 0.5));
  
  // Sky reflection color
  let skyReflection = SKY_COLOR;
  
  // Combine reflection and refraction
  let waterColor = mix(depthColor, skyReflection, fresnelFactor);
  
  // Apply PBR lighting
  let litColor = pbrLighting(
    perturbedNormal,
    viewDir,
    lightDir,
    waterColor,
    0.0,  // metallic
    0.25  // roughness (water is smooth)
  );
  
  // Add caustics
  let caustics = underwaterCaustics(input.worldPos, 10.0, time);
  let colorWithCaustics = litColor + caustics * 0.4;
  
  // Add atmospheric scattering
  let scatter = atmosphericScattering(viewDir, lightDir, 10.0);
  let colorWithScatter = colorWithCaustics + scatter * 0.2;
  
  // Add foam
  let foamColor = renderFoam(input.foam, perturbedNormal, lightDir);
  
  // Blend foam on top
  let finalColor = mix(colorWithScatter, foamColor, input.foam * 0.8);
  
  // Add specular highlight
  let h = normalize(lightDir + viewDir);
  let specular = pow(max(0.0, dot(perturbedNormal, h)), 128.0) * 0.6;
  let finalColorWithSpecular = finalColor + vec3<f32>(specular);
  
  // Tone mapping (Reinhard)
  let toneMapped = finalColorWithSpecular / (finalColorWithSpecular + vec3<f32>(1.0));
  
  // Gamma correction
  let gamma = 2.2;
  let corrected = pow(toneMapped, vec3<f32>(1.0 / gamma));
  
  // Add slight color grading for cinematic look
  let graded = mix(corrected, corrected * vec3<f32>(1.05, 1.02, 0.98), 0.1);
  
  output.color = vec4<f32>(graded, 1.0);
  
  return output;
}
