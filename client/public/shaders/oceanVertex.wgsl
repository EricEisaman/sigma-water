// Babylon.js 9 WebGPU WGSL Ocean Vertex Shader - CORRECT SYNTAX
#include<sceneUboDeclaration>
#include<meshUboDeclaration>

attribute position : vec3<f32>;
attribute normal : vec3<f32>;
attribute uv : vec2<f32>;

varying vColor : vec4<f32>;
varying vNormal : vec3<f32>;
varying vWorldPos : vec3<f32>;
varying vUv : vec2<f32>;

@vertex
fn main(input : VertexInputs) -> FragmentInputs {
  // Simple wave displacement - Gerstner wave approximation
  let time = 0.0;
  let waveAmp = 0.8;
  let waveFreq = 0.5;
  
  // Three-layer wave displacement
  let wave1 = waveAmp * sin(input.position.x * waveFreq + time) * cos(input.position.z * waveFreq + time * 0.7);
  let wave2 = waveAmp * 0.6 * sin(input.position.x * waveFreq * 1.3 + time * 1.3) * cos(input.position.z * waveFreq * 1.3 + time * 0.9);
  let wave3 = waveAmp * 0.4 * sin(input.position.x * waveFreq * 2.0 + time * 0.8) * cos(input.position.z * waveFreq * 2.0 + time * 1.1);
  
  let totalWave = wave1 + wave2 + wave3;
  
  var displacedPos = input.position;
  displacedPos.y += totalWave;
  
  // CRITICAL: Transform using scene.viewProjection and mesh.world
  vertexOutputs.position = scene.viewProjection * mesh.world * vec4<f32>(displacedPos, 1.0);
  
  // Blue water color with depth gradient
  let depthFactor = clamp(displacedPos.y * 0.1 + 0.5, 0.0, 1.0);
  vertexOutputs.vColor = vec4<f32>(
    0.0,
    0.3 + depthFactor * 0.2,
    0.6 + depthFactor * 0.2,
    0.95
  );
  
  // Pass normal for lighting
  vertexOutputs.vNormal = input.normal;
  
  // Pass world position
  vertexOutputs.vWorldPos = (mesh.world * vec4<f32>(displacedPos, 1.0)).xyz;
  
  // Pass UV
  vertexOutputs.vUv = input.uv;
  
  return vertexOutputs;
}
