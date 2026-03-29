/**
 * Toon Water Shader Definition
 * Stylized cell-shaded water with bold outlines, color blocking, and cartoon aesthetics
 * Inspired by The Legend of Zelda: The Wind Waker and modern cel-shading techniques
 */

import { ShaderContext, ShaderRegistryEntry } from '../index';

const vertexCode = `
#include<sceneUboDeclaration>
#include<meshUboDeclaration>

uniform time : f32;
uniform amplitude : f32;
uniform frequency : f32;
uniform windDirection : f32;
uniform outlineWidth : f32;

attribute position : vec3<f32>;
attribute normal : vec3<f32>;
attribute uv : vec2<f32>;

varying vWorldPos : vec3<f32>;
varying vNormal : vec3<f32>;
varying vUv : vec2<f32>;
varying vWaveHeight : f32;
varying vViewDir : vec3<f32>;

fn hash2(p: vec2<f32>) -> f32 {
  return fract(sin(dot(p, vec2<f32>(127.1, 311.7))) * 43758.5453);
}

fn noise2(p: vec2<f32>) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);
  let a = hash2(i + vec2<f32>(0.0, 0.0));
  let b = hash2(i + vec2<f32>(1.0, 0.0));
  let c = hash2(i + vec2<f32>(0.0, 1.0));
  let d = hash2(i + vec2<f32>(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

fn fbm(p: vec2<f32>) -> f32 {
  var value = 0.0;
  var amp = 0.5;
  var freq = 1.0;
  for (var i = 0; i < 3; i = i + 1) {
    value += noise2(p * freq) * amp;
    freq *= 2.0;
    amp *= 0.5;
  }
  return value;
}

fn toonWaveDisplacement(xz: vec2<f32>, t: f32) -> vec3<f32> {
  let windAngle = uniforms.windDirection * 0.01745329251;
  let baseDir = normalize(vec2<f32>(cos(windAngle), sin(windAngle)));
  
  // Multiple wave layers for stylized effect
  let w0 = sin(dot(baseDir, xz) * uniforms.frequency - t * 0.6) * uniforms.amplitude;
  let w1 = sin(dot(baseDir * 0.7, xz) * uniforms.frequency * 1.5 - t * 0.5) * uniforms.amplitude * 0.6;
  let w2 = cos(dot(baseDir * 0.4, xz) * uniforms.frequency * 2.2 - t * 0.4) * uniforms.amplitude * 0.3;
  
  // Quantize for toon effect
  let totalDisp = (w0 + w1 + w2);
  let quantized = round(totalDisp * 4.0) / 4.0;
  
  return vec3<f32>(0.0, quantized, 0.0);
}

@vertex
fn main(input: VertexInputs) -> VertexOutput {
  var pos = input.position;
  let displacement = toonWaveDisplacement(pos.xz, uniforms.time);
  pos += displacement;
  
  let worldPos = (sceneUniforms.world * vec4<f32>(pos, 1.0)).xyz;
  let worldNormal = normalize((sceneUniforms.world * vec4<f32>(input.normal, 0.0)).xyz);
  let viewDir = normalize(scene.vEyePosition.xyz - worldPos);
  
  var output: VertexOutput;
  output.position = sceneUniforms.worldViewProjection * vec4<f32>(pos, 1.0);
  output.vWorldPos = worldPos;
  output.vNormal = worldNormal;
  output.vUv = input.uv;
  output.vWaveHeight = displacement.y;
  output.vViewDir = viewDir;
  return output;
}
`;

const fragmentCode = `
uniform time : f32;
uniform cameraPosition : vec3<f32>;
uniform outlineThreshold : f32;
uniform colorPalette : f32;

fn celShade(intensity: f32, levels: f32) -> f32 {
  return floor(intensity * levels) / levels;
}

fn posterize(color: vec3<f32>, levels: f32) -> vec3<f32> {
  return floor(color * levels) / levels;
}

@fragment
fn main(@location(0) vWorldPos: vec3<f32>,
        @location(1) vNormal: vec3<f32>,
        @location(2) vUv: vec2<f32>,
        @location(3) vWaveHeight: f32,
        @location(4) vViewDir: vec3<f32>) -> @location(0) vec4<f32> {
  let n = normalize(vNormal);
  let viewDir = normalize(vViewDir);
  let lightDir = normalize(vec3<f32>(0.5, 0.8, 0.3));
  
  // Cell shading with discrete levels
  let diffuse = max(dot(n, lightDir), 0.0);
  let cellDiffuse = celShade(diffuse, 4.0);
  
  // Fresnel for rim lighting (toon style)
  let fresnel = pow(1.0 - dot(n, viewDir), 2.5);
  let rimLight = celShade(fresnel, 3.0) * 0.4;
  
  // Specular highlight (sharp, cartoon-like)
  let halfVec = normalize(lightDir + viewDir);
  let specular = pow(max(dot(n, halfVec), 0.0), 64.0);
  let cellSpecular = step(0.5, specular) * 0.8;
  
  // Color palette based on height and lighting
  let heightLevel = round(vWaveHeight * 3.0) / 3.0;
  
  // Toon water color palette - vibrant and stylized
  var baseColor = vec3<f32>(0.2, 0.6, 0.9);  // Bright cyan
  
  if (heightLevel > 0.5) {
    baseColor = vec3<f32>(0.1, 0.8, 1.0);    // Bright turquoise (wave crests)
  } else if (heightLevel < -0.3) {
    baseColor = vec3<f32>(0.0, 0.3, 0.7);    // Deep blue (troughs)
  }
  
  // Apply cel shading
  var waterColor = baseColor * (0.5 + cellDiffuse * 0.5);
  
  // Add rim lighting
  waterColor += vec3<f32>(0.9, 0.95, 1.0) * rimLight;
  
  // Add specular highlight
  waterColor += vec3<f32>(1.0) * cellSpecular;
  
  // Posterize for stronger toon effect
  waterColor = posterize(waterColor, 6.0);
  
  // Add outline effect based on normal discontinuity
  let outlineIntensity = smoothstep(0.7, 0.5, abs(dot(n, viewDir)));
  let outline = vec3<f32>(0.0, 0.0, 0.0) * outlineIntensity * 0.3;
  
  var finalColor = waterColor + outline;
  
  return vec4<f32>(finalColor, 1.0);
}
`;

export const toonWaterDefinition: ShaderRegistryEntry = {
  id: 'toonWater',
  displayName: 'Toon Water',
  description: 'Stylized cell-shaded water with bold outlines, color blocking, and cartoon aesthetics',
  
  features: {
    supportsFoam: false,
    supportsCaustics: false,
    supportsCollisions: false,
    supportsWake: false,
  },
  
  shader: {
    vertex: vertexCode,
    fragment: fragmentCode,
  },
  
  babylon: {
    uniforms: ['time', 'amplitude', 'frequency', 'windDirection', 'outlineWidth', 'outlineThreshold', 'colorPalette', 'cameraPosition'],
    attributes: ['position', 'normal', 'uv'],
    uniformBuffers: ['Scene', 'Mesh'],
  },
  
  setup: (context: ShaderContext) => {
    console.log('🎨 Setting up Toon Water shader');
    context.setUniforms({
      time: 0,
      amplitude: 1.8,
      frequency: 1.2,
      windDirection: 60,
      outlineWidth: 0.02,
      outlineThreshold: 0.5,
      colorPalette: 0,
      cameraPosition: [0, 10, 0],
    });
  },
  
  update: (context: ShaderContext, deltaTime: number) => {
    const currentTime = context.getUniform('time') || 0;
    context.setUniform('time', currentTime + deltaTime * 0.001);
  },
  
  cleanup: () => {
    console.log('🧹 Cleaning up Toon Water shader');
  },
};
