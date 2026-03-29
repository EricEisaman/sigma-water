/**
 * Stormy Waves Shader Definition
 * Dramatic dark waters with aggressive wave patterns and white caps
 */

import { ShaderContext, ShaderRegistryEntry } from '../index';

const vertexCode = `
#include<sceneUboDeclaration>
#include<meshUboDeclaration>

uniform time : f32;
uniform amplitude : f32;
uniform frequency : f32;
uniform windDirection : f32;
uniform windSpeed : f32;

attribute position : vec3<f32>;
attribute normal : vec3<f32>;
attribute uv : vec2<f32>;

varying vWorldPos : vec3<f32>;
varying vNormal : vec3<f32>;
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

fn waveDisplacement(xz: vec2<f32>, t: f32) -> vec3<f32> {
  let windAngle = uniforms.windDirection * 0.01745329251;
  let baseDir = normalize(vec2<f32>(cos(windAngle), sin(windAngle)));
  let crossDir = normalize(vec2<f32>(-baseDir.y, baseDir.x));
  
  let speed = 0.8 + uniforms.windSpeed * 1.5;
  let f0 = uniforms.frequency;
  let f1 = uniforms.frequency * 1.8;
  let f2 = uniforms.frequency * 3.2;
  
  let w0 = sin(dot(baseDir, xz) * f0 - t * speed) * uniforms.amplitude;
  let w1 = sin(dot(baseDir * 0.6 + crossDir * 0.8, xz) * f1 - t * speed * 0.7) * uniforms.amplitude * 0.7;
  let w2 = sin(dot(baseDir * 0.3 - crossDir * 0.95, xz) * f2 - t * speed * 0.5) * uniforms.amplitude * 0.4;
  
  return vec3<f32>(0.0, w0 + w1 + w2, 0.0);
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
  output.vFoamMask = max(0.0, displacement.y - 0.4) * 1.5;
  return output;
}
`;

const fragmentCode = `
uniform time : f32;
uniform cameraPosition : vec3<f32>;

@fragment
fn main(@location(0) vWorldPos: vec3<f32>,
        @location(1) vNormal: vec3<f32>,
        @location(2) vUv: vec2<f32>,
        @location(3) vWaveHeight: f32,
        @location(4) vFoamMask: f32) -> @location(0) vec4<f32> {
  let n = normalize(vNormal);
  let viewDir = normalize(scene.vEyePosition.xyz - vWorldPos);
  let lightDir = normalize(vec3<f32>(0.3, 0.6, 0.2));
  
  let fresnel = pow(1.0 - dot(n, viewDir), 2.5);
  
  // Dark stormy palette
  let darkColor = vec3<f32>(0.05, 0.1, 0.15);      // Very dark blue-grey
  let mediumColor = vec3<f32>(0.1, 0.15, 0.25);    // Dark slate
  let stormColor = vec3<f32>(0.08, 0.12, 0.2);     // Storm blue
  
  let heightTint = clamp(0.5 + vWaveHeight * 0.15, 0.0, 1.0);
  var waterColor = mix(darkColor, mediumColor, heightTint);
  waterColor = mix(waterColor, stormColor, fresnel * 0.3);
  
  // White caps on wave crests
  let foamColor = vec3<f32>(0.95, 0.97, 1.0);
  let foam = smoothstep(0.3, 0.8, vFoamMask);
  
  // Reduced specular (stormy sky)
  let halfVec = normalize(lightDir + viewDir);
  let spec = pow(max(dot(n, halfVec), 0.0), 80.0) * 0.15;
  
  var finalColor = waterColor;
  finalColor += vec3<f32>(spec);
  finalColor = mix(finalColor, foamColor, foam * 0.7);
  
  return vec4<f32>(finalColor, 1.0);
}
`;

export const stormyWavesDefinition: ShaderRegistryEntry = {
  id: 'stormyWaves',
  displayName: 'Stormy Waves',
  description: 'Dramatic dark waters with aggressive wave patterns and white caps',
  
  features: {
    supportsFoam: true,
    supportsCaustics: false,
    supportsCollisions: false,
    supportsWake: false,
  },
  
  shader: {
    vertex: vertexCode,
    fragment: fragmentCode,
  },
  
  babylon: {
    uniforms: ['time', 'amplitude', 'frequency', 'windDirection', 'windSpeed', 'cameraPosition'],
    attributes: ['position', 'normal', 'uv'],
    uniformBuffers: ['Scene', 'Mesh'],
  },
  
  setup: (context: ShaderContext) => {
    console.log('⛈️ Setting up Stormy Waves shader');
    context.setUniforms({
      time: 0,
      amplitude: 3.5,
      frequency: 1.8,
      windDirection: 120,
      windSpeed: 1.5,
      cameraPosition: [0, 10, 0],
    });
  },
  
  update: (context: ShaderContext, deltaTime: number) => {
    const currentTime = context.getUniform('time') || 0;
    context.setUniform('time', currentTime + deltaTime * 0.001);
  },
  
  cleanup: () => {
    console.log('🧹 Cleaning up Stormy Waves shader');
  },
};
