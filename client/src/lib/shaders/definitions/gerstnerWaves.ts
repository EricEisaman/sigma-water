/**
 * Gerstner Waves Shader Definition
 * High-performance wave simulation with dynamic foam and caustics
 */

import { ShaderContext, ShaderRegistryEntry } from '../index';

// Vertex shader - inline WGSL
const vertexCode = `
#include<sceneUboDeclaration>
#include<meshUboDeclaration>

uniform time : f32;
uniform amplitude : f32;
uniform frequency : f32;
uniform windDirection : f32;
uniform windSpeed : f32;
uniform foamIntensity : f32;
uniform causticIntensity : f32;
uniform causticScale : f32;
uniform boatPos : vec2<f32>;
uniform islandCenter : vec2<f32>;
uniform islandRadius : f32;
uniform foamDistanceScale : f32;
uniform foamWidth : f32;
uniform foamNoiseFactor : f32;
uniform foamCellScale : f32;
uniform foamShredSlope : f32;
uniform foamFizzWeight : f32;
uniform boatFoamRadius : f32;
uniform wakeWidth : f32;
uniform collisionMode : f32;
uniform showProxySpheres : f32;
uniform boatSphereCenter : vec3<f32>;
uniform boatSphereRadius : f32;
uniform boatSphereCrossRadius : f32;
uniform islandSphereCenter : vec3<f32>;
uniform islandSphereRadius : f32;
uniform islandSphereCrossRadius : f32;

attribute position : vec3<f32>;
attribute normal : vec3<f32>;
attribute uv : vec2<f32>;

varying vColor : vec4<f32>;
varying vNormal : vec3<f32>;
varying vWorldPos : vec3<f32>;
varying vUv : vec2<f32>;
varying vWaveHeight : f32;
varying vFoamMask : f32;

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

  for (var i = 0; i < 4; i = i + 1) {
    value += noise2(p * freq) * amp;
    freq *= 2.02;
    amp *= 0.53;
  }

  return value;
}

fn waveDisplacement(xz: vec2<f32>, t: f32) -> vec3<f32> {
  let windAngle = uniforms.windDirection * 0.01745329251;
  let baseDir = normalize(vec2<f32>(cos(windAngle), sin(windAngle)));
  let crossDir = normalize(vec2<f32>(-baseDir.y, baseDir.x));
  let dir0 = baseDir;
  let dir1 = normalize(baseDir * 0.78 + crossDir * 0.62);
  let dir2 = normalize(baseDir * 0.4 - crossDir * 0.92);
  let dir3 = normalize(baseDir * 0.95 - crossDir * 0.3);
  let dir4 = normalize(baseDir * 0.18 + crossDir * 0.98);

  let speed = 0.55 + uniforms.windSpeed * 1.75;
  let f0 = uniforms.frequency;
  let f1 = uniforms.frequency * 1.62;
  let f2 = uniforms.frequency * 2.64;
  let f3 = uniforms.frequency * 3.85;
  let f4 = uniforms.frequency * 5.4;

  let w0 = sin(dot(dir0, xz) * f0 - t * speed) * uniforms.amplitude;
  let w1 = sin(dot(dir1, xz) * f1 - t * speed * 0.8) * uniforms.amplitude * 0.6;
  let w2 = sin(dot(dir2, xz) * f2 - t * speed * 0.6) * uniforms.amplitude * 0.4;
  let w3 = sin(dot(dir3, xz) * f3 - t * speed * 0.5) * uniforms.amplitude * 0.25;
  let w4 = sin(dot(dir4, xz) * f4 - t * speed * 0.4) * uniforms.amplitude * 0.15;

  let totalDisp = w0 + w1 + w2 + w3 + w4;
  return vec3<f32>(0.0, totalDisp, 0.0);
}

@vertex
fn main(input: VertexInputs) -> VertexOutput {
  var pos = input.position;
  let displacement = waveDisplacement(pos.xz, uniforms.time);
  pos += displacement;

  let worldPos = (sceneUniforms.world * vec4<f32>(pos, 1.0)).xyz;
  let worldNormal = normalize((sceneUniforms.world * vec4<f32>(input.normal, 0.0)).xyz);

  var output: VertexOutput;
  output.position = sceneUniforms.worldViewProjection * vec4<f32>(pos, 1.0);
  output.vWorldPos = worldPos;
  output.vNormal = worldNormal;
  output.vUv = input.uv;
  output.vWaveHeight = displacement.y;
  output.vFoamMask = max(0.0, displacement.y - 0.3) * uniforms.foamIntensity;
  output.vColor = vec4<f32>(1.0);
  return output;
}
`;

// Fragment shader - inline WGSL (truncated for brevity, full version in VisualOcean.ts)
const fragmentCode = `
uniform time : f32;
uniform cameraPosition : vec3<f32>;
uniform causticIntensity : f32;
uniform depthFadeDistance : f32;
uniform depthFadeExponent : f32;
uniform foamIntensity : f32;

@fragment
fn main(@location(0) vColor: vec4<f32>,
        @location(1) vNormal: vec3<f32>,
        @location(2) vWorldPos: vec3<f32>,
        @location(3) vUv: vec2<f32>,
        @location(4) vWaveHeight: f32,
        @location(5) vFoamMask: f32) -> @location(0) vec4<f32> {
  let n = normalize(vNormal);
  let viewDir = normalize(scene.vEyePosition.xyz - vWorldPos);
  let lightDir = normalize(vec3<f32>(0.42, 0.81, 0.25));
  
  let fresnel = pow(1.0 - dot(n, viewDir), 3.0);
  let deepColor = vec3<f32>(0.008, 0.085, 0.15);
  let shallowColor = vec3<f32>(0.08, 0.31, 0.47);
  let heightTint = clamp(0.5 + vWaveHeight * 0.07, 0.0, 1.0);
  var waterColor = mix(deepColor, shallowColor, heightTint);
  
  let caustics = sin(vWorldPos.x * 3.0 + uniforms.time) * cos(vWorldPos.z * 3.0 + uniforms.time * 0.7);
  waterColor += abs(caustics) * 0.5 * uniforms.causticIntensity * vec3<f32>(0.3, 0.4, 0.2);
  
  var finalColor = waterColor;
  finalColor = mix(finalColor, vec3<f32>(0.96, 0.98, 1.0), vFoamMask);
  finalColor = mix(finalColor, vec3<f32>(0.8, 0.9, 1.0), fresnel * 0.35);
  
  return vec4<f32>(finalColor, 1.0);
}
`;

export const gerstnerWavesDefinition: ShaderRegistryEntry = {
  id: 'gerstnerWaves',
  displayName: 'Gerstner Waves',
  description: 'High-performance wave simulation with dynamic foam and caustics',
  
  features: {
    supportsFoam: true,
    supportsCaustics: true,
    supportsCollisions: true,
    supportsWake: true,
  },
  
  shader: {
    vertex: vertexCode,
    fragment: fragmentCode,
  },
  
  babylon: {
    uniforms: [
      'time', 'amplitude', 'frequency', 'windDirection', 'windSpeed',
      'foamIntensity', 'causticIntensity', 'causticScale', 'boatPos',
      'islandCenter', 'islandRadius', 'foamDistanceScale', 'foamWidth',
      'foamNoiseFactor', 'foamCellScale', 'foamShredSlope', 'foamFizzWeight',
      'boatFoamRadius', 'wakeWidth', 'cameraNear', 'cameraFar',
      'depthFadeDistance', 'depthFadeExponent', 'collisionMode',
      'showProxySpheres', 'boatSphereCenter', 'boatSphereRadius',
      'boatSphereCrossRadius', 'islandSphereCenter', 'islandSphereRadius',
      'islandSphereCrossRadius',
    ],
    attributes: ['position', 'normal', 'uv'],
    samplers: ['sceneDepth'],
    uniformBuffers: ['Scene', 'Mesh'],
  },
  
  setup: (context: ShaderContext) => {
    console.log('🎨 Setting up Gerstner Waves shader');
    // Initialize default uniforms
    context.setUniforms({
      time: 0,
      amplitude: 2.6,
      frequency: 1.35,
      windDirection: 38,
      windSpeed: 0.72,
      foamIntensity: 0.7,
      causticIntensity: 0.85,
      depthFadeDistance: 1.15,
      depthFadeExponent: 1.65,
    });
  },
  
  update: (context: ShaderContext, deltaTime: number) => {
    // Update time uniform
    const currentTime = context.getUniform('time') || 0;
    context.setUniform('time', currentTime + deltaTime * 0.001);
  },
  
  cleanup: () => {
    console.log('🧹 Cleaning up Gerstner Waves shader');
  },
};
