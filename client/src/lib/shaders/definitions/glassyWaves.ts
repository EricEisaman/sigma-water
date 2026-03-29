/**
 * Glassy Waves Shader Definition
 * Mirror-like calm waters with perfect reflections and minimal wave activity
 */

import { ShaderContext, ShaderRegistryEntry } from '../index';

const vertexCode = `
#include<sceneUboDeclaration>
#include<meshUboDeclaration>

uniform time : f32;
uniform amplitude : f32;

attribute position : vec3<f32>;
attribute normal : vec3<f32>;
attribute uv : vec2<f32>;

varying vWorldPos : vec3<f32>;
varying vNormal : vec3<f32>;
varying vUv : vec2<f32>;

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

fn gentleWave(xz: vec2<f32>, t: f32) -> f32 {
  let wave1 = sin(xz.x * 0.3 + t * 0.3) * cos(xz.y * 0.2 + t * 0.2);
  let wave2 = sin((xz.x + xz.y) * 0.15 + t * 0.15) * 0.5;
  return (wave1 + wave2) * uniforms.amplitude * 0.3;
}

@vertex
fn main(input: VertexInputs) -> VertexOutput {
  var pos = input.position;
  pos.y += gentleWave(pos.xz, uniforms.time);
  
  let worldPos = (sceneUniforms.world * vec4<f32>(pos, 1.0)).xyz;
  let worldNormal = normalize((sceneUniforms.world * vec4<f32>(input.normal, 0.0)).xyz);
  
  var output: VertexOutput;
  output.position = sceneUniforms.worldViewProjection * vec4<f32>(pos, 1.0);
  output.vWorldPos = worldPos;
  output.vNormal = worldNormal;
  output.vUv = input.uv;
  return output;
}
`;

const fragmentCode = `
uniform time : f32;
uniform cameraPosition : vec3<f32>;

@fragment
fn main(@location(0) vWorldPos: vec3<f32>,
        @location(1) vNormal: vec3<f32>,
        @location(2) vUv: vec2<f32>) -> @location(0) vec4<f32> {
  let n = normalize(vNormal);
  let viewDir = normalize(scene.vEyePosition.xyz - vWorldPos);
  let lightDir = normalize(vec3<f32>(0.5, 0.9, 0.3));
  
  let fresnel = pow(1.0 - dot(n, viewDir), 2.0);
  
  // Glassy color palette - very clear and reflective
  let baseColor = vec3<f32>(0.1, 0.4, 0.6);         // Clear blue
  let reflectionColor = vec3<f32>(0.9, 0.95, 1.0);  // Sky white
  
  var waterColor = mix(baseColor, reflectionColor, fresnel * 0.8);
  
  // Strong specular reflection (mirror-like)
  let halfVec = normalize(lightDir + viewDir);
  let spec = pow(max(dot(n, halfVec), 0.0), 256.0) * 0.8;
  
  // Subtle caustics for depth
  let caustics = sin(vWorldPos.x * 2.0 + uniforms.time * 0.5) * 
                 cos(vWorldPos.z * 2.0 + uniforms.time * 0.3) * 0.1;
  
  var finalColor = waterColor;
  finalColor += vec3<f32>(spec);
  finalColor += vec3<f32>(0.2, 0.25, 0.3) * caustics;
  
  return vec4<f32>(finalColor, 1.0);
}
`;

export const glassyWavesDefinition: ShaderRegistryEntry = {
  id: 'glassyWaves',
  displayName: 'Glassy Waves',
  description: 'Mirror-like calm waters with perfect reflections and minimal wave activity',
  
  features: {
    supportsFoam: false,
    supportsCaustics: true,
    supportsCollisions: false,
    supportsWake: false,
  },
  
  shader: {
    vertex: vertexCode,
    fragment: fragmentCode,
  },
  
  babylon: {
    uniforms: ['time', 'amplitude', 'cameraPosition'],
    attributes: ['position', 'normal', 'uv'],
    uniformBuffers: ['Scene', 'Mesh'],
  },
  
  setup: (context: ShaderContext) => {
    console.log('✨ Setting up Glassy Waves shader');
    context.setUniforms({
      time: 0,
      amplitude: 0.5,
      cameraPosition: [0, 10, 0],
    });
  },
  
  update: (context: ShaderContext, deltaTime: number) => {
    const currentTime = context.getUniform('time') || 0;
    context.setUniform('time', currentTime + deltaTime * 0.001);
  },
  
  cleanup: () => {
    console.log('🧹 Cleaning up Glassy Waves shader');
  },
};
