import { ShaderContext } from '../ShaderContext';
import { ShaderRegistryEntry } from '../ShaderRegistry';

const vertexCode = `
#include<sceneUboDeclaration>
#include<meshUboDeclaration>

varying vWorldPos : vec3<f32>;
varying vNormal : vec3<f32>;
varying vUv : vec2<f32>;

@vertex
fn main(input: VertexInputs) -> VertexOutput {
  var output: VertexOutput;
  output.position = scene.viewProjection * mesh.world * vec4<f32>(input.position, 1.0);
  output.vWorldPos = (mesh.world * vec4<f32>(input.position, 1.0)).xyz;
  output.vNormal = (mesh.normalWorld * input.normal).xyz;
  output.vUv = input.uv;
  return output;
}
`;

const fragmentCode = `
varying vWorldPos : vec3<f32>;
varying vNormal : vec3<f32>;
varying vUv : vec2<f32>;

@fragment
fn main() -> @location(0) vec4<f32> {
  let normal = normalize(vNormal);
  let lightDir = normalize(vec3<f32>(1.0, 1.0, 1.0));
  let diff = max(dot(normal, lightDir), 0.0);
  let color = vec3<f32>(0.05, 0.15, 0.25) * (0.3 + 0.7 * diff);
  return vec4<f32>(color, 1.0);
}
`;

export const stormyWavesDefinition: ShaderRegistryEntry = {
  id: 'stormyWaves',
  displayName: 'Stormy Waves',
  description: 'Dark, turbulent waters with dramatic lighting',
  
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
    uniforms: [],
    attributes: ['position', 'normal', 'uv'],
    uniformBuffers: ['Scene', 'Mesh'],
  },
  
  setup: (context: ShaderContext) => {
    console.log('🎨 Setting up Stormy Waves shader');
  },
  
  update: (context: ShaderContext, deltaTime: number) => {
    // Update logic here
  },
  
  cleanup: () => {
    console.log('🧹 Cleaning up Stormy Waves shader');
  },
};
