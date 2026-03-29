/**
 * Tropical Waves Shader Definition
 * Vibrant Caribbean waters with shallow turquoise and deep azure tones
 */

import { ShaderContext, ShaderRegistryEntry } from '../index';

const vertexCode = `
#include<sceneUboDeclaration>
#include<meshUboDeclaration>

uniform time : f32;
uniform amplitude : f32;
uniform frequency : f32;
uniform windDirection : f32;

attribute position : vec3<f32>;
attribute normal : vec3<f32>;
attribute uv : vec2<f32>;

varying vWorldPos : vec3<f32>;
varying vNormal : vec3<f32>;
varying vUv : vec2<f32>;
varying vWaveHeight : f32;

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
  
  let w0 = sin(dot(baseDir, xz) * uniforms.frequency - t * 0.8) * uniforms.amplitude;
  let w1 = sin(dot(baseDir * 0.7, xz) * uniforms.frequency * 1.5 - t * 0.6) * uniforms.amplitude * 0.5;
  
  return vec3<f32>(0.0, w0 + w1, 0.0);
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
        @location(3) vWaveHeight: f32) -> @location(0) vec4<f32> {
  let n = normalize(vNormal);
  let viewDir = normalize(scene.vEyePosition.xyz - vWorldPos);
  let lightDir = normalize(vec3<f32>(0.42, 0.81, 0.25));
  
  let fresnel = pow(1.0 - dot(n, viewDir), 3.0);
  
  // Tropical color palette: shallow turquoise to deep azure
  let shallowColor = vec3<f32>(0.0, 0.85, 0.9);    // Bright turquoise
  let mediumColor = vec3<f32>(0.0, 0.6, 0.85);     // Medium blue-green
  let deepColor = vec3<f32>(0.0, 0.2, 0.6);        // Deep azure
  
  let depth = length(vWorldPos - scene.vEyePosition.xyz);
  let depthFade = 1.0 - smoothstep(0.0, 100.0, depth);
  
  let heightTint = clamp(0.5 + vWaveHeight * 0.1, 0.0, 1.0);
  var waterColor = mix(deepColor, mediumColor, heightTint);
  waterColor = mix(waterColor, shallowColor, depthFade * 0.5);
  
  // Specular highlight
  let halfVec = normalize(lightDir + viewDir);
  let spec = pow(max(dot(n, halfVec), 0.0), 128.0) * 0.4;
  
  // Sun reflection
  let sunReflection = vec3<f32>(1.0, 0.95, 0.8) * fresnel * 0.3;
  
  var finalColor = waterColor;
  finalColor += vec3<f32>(spec);
  finalColor += sunReflection;
  
  return vec4<f32>(finalColor, 1.0);
}
`;

export const tropicalWavesDefinition: ShaderRegistryEntry = {
  id: 'tropicalWaves',
  displayName: 'Tropical Waves',
  description: 'Vibrant Caribbean waters with shallow turquoise and deep azure tones',
  
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
    uniforms: ['time', 'amplitude', 'frequency', 'windDirection', 'cameraPosition'],
    attributes: ['position', 'normal', 'uv'],
    uniformBuffers: ['Scene', 'Mesh'],
  },
  
  setup: (context: ShaderContext) => {
    console.log('🏝️ Setting up Tropical Waves shader');
    context.setUniforms({
      time: 0,
      amplitude: 1.2,
      frequency: 0.8,
      windDirection: 45,
      cameraPosition: [0, 10, 0],
    });
  },
  
  update: (context: ShaderContext, deltaTime: number) => {
    const currentTime = context.getUniform('time') || 0;
    context.setUniform('time', currentTime + deltaTime * 0.001);
  },
  
  cleanup: () => {
    console.log('🧹 Cleaning up Tropical Waves shader');
  },
};
