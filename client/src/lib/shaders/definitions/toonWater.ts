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
  let color = vec3<f32>(0.2, 0.6, 0.9) * (0.3 + 0.7 * diff);
  return vec4<f32>(color, 1.0);
}
`;

export const toonWaterDefinition: ShaderRegistryEntry = {
  id: 'toonWater',
  displayName: 'Toon Water',
  description: 'Stylized cell-shaded water with bold colors',
  
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
    console.log('🎨 Setting up Toon Water shader');
  },
  
  update: (context: ShaderContext, deltaTime: number) => {
    // Update logic here
  },
  
  cleanup: () => {
    console.log('🧹 Cleaning up Toon Water shader');
  },
};
